// Local API server that answers several requests at the same time on Windows.
//
//   node dev-parallel.mjs            -> http://localhost:8000 (same address as `php artisan serve`), 4 workers
//   node dev-parallel.mjs 8000 6     -> port 8000, 6 workers
//
// PHP's built-in server (what `php artisan serve` uses) handles ONE request at a time on Windows, so a page that asks for
// five things waits for them one after the other. This starts a few of them on private ports and shares the requests out.
// If a worker stops for any reason, it is restarted automatically and requests go to the workers that are still running,
// so the browser does not get "502 Bad Gateway" (which it reports as a CORS error) for the requests that reach it.
// Development only; production (Apache on Render) already serves requests in parallel.
import { spawn } from 'node:child_process'
import http from 'node:http'

const port = Number(process.argv[2] || 8000)
const workers = Math.max(1, Math.min(12, Number(process.argv[3] || 4)))
const base = port + 100
const targets = Array.from({ length: workers }, (_, i) => base + i)
const ready = new Set() // workers that are accepting connections right now
const children = new Map()
let stopping = false

const running = (c) => c.exitCode === null && c.signalCode === null
// Windows reports crashes as big numbers such as 3221225477; show them as 0xC0000005 so they can be looked up.
const reason = (code, signal) => (signal ? `signal ${signal}` : code > 255 ? `code 0x${(code >>> 0).toString(16).toUpperCase()}` : `code ${code}`)

function startWorker(p, restarts = 0) {
  const startedAt = Date.now()
  const child = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', 'public'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, DB_PERSISTENT: process.env.DB_PERSISTENT ?? 'true' } })
  children.set(p, child)
  // Show PHP's log as before, and only send requests to a worker once it prints "Development Server ... started".
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk)
    if (!ready.has(p) && children.get(p) === child && String(chunk).includes('started')) ready.add(p)
  })
  child.on('error', (err) => console.error(`worker on ${p} could not start: ${err.message} (is PHP installed and on PATH?)`))
  child.on('exit', (code, signal) => {
    ready.delete(p)
    if (stopping) return
    // Restart quickly, but back off if a worker keeps dying straight away (e.g. the port is taken).
    const n = Date.now() - startedAt > 30_000 ? 0 : restarts + 1
    const wait = Math.min(10_000, 250 * 2 ** n)
    console.error(`worker on ${p} stopped (${reason(code, signal)}); restarting it in ${(wait / 1000).toFixed(1)}s`)
    setTimeout(() => { if (!stopping) startWorker(p, n) }, wait)
  })
}
targets.forEach((p) => startWorker(p))

let next = 0
function pickWorker(tried) {
  for (let i = 0; i < targets.length; i++) {
    const p = targets[next++ % targets.length]
    if (ready.has(p) && !tried.has(p)) return p
  }
  return null
}

// Errors made here (not by Laravel) still need a CORS header, or the browser hides the real problem behind a CORS error.
function fail(req, res, status, message) {
  if (res.headersSent) return res.destroy()
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify({ message }))
}

const safeToRepeat = new Set(['GET', 'HEAD', 'OPTIONS'])

function forward(req, res, body, tried, deadline = Date.now() + 10_000) {
  const target = pickWorker(tried)
  if (target === null) {
    // Every worker is starting or restarting (e.g. right after launch): wait a little instead of failing at once.
    if (Date.now() < deadline && !res.destroyed) return setTimeout(() => forward(req, res, body, tried, deadline), 250)
    return fail(req, res, 503, 'The local API is starting or restarting. Try again in a few seconds.')
  }
  tried.add(target)
  const out = http.request({ host: '127.0.0.1', port: target, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${port}` } }, (back) => {
    res.writeHead(back.statusCode ?? 502, back.headers)
    back.pipe(res)
  })
  out.on('error', (err) => {
    if (res.headersSent) return res.destroy()
    // The worker is gone: try another one. A request that may already have changed data (POST, PUT, ...) is only
    // repeated if the worker never received it.
    if (err.code === 'ECONNREFUSED' || (err.code === 'ECONNRESET' && safeToRepeat.has(req.method))) {
      ready.delete(target)
      const child = children.get(target)
      if (child && running(child)) setTimeout(() => { if (children.get(target) === child && running(child)) ready.add(target) }, 1000) // still running: give it another chance soon
      return forward(req, res, body, tried, deadline)
    }
    fail(req, res, 502, `The local API worker failed (${err.code}). Check the terminal running dev-parallel.mjs.`)
  })
  out.end(body)
}

const proxy = http.createServer((req, res) => {
  // Read the whole request first so it can be sent again to another worker if the first one is down.
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => forward(req, res, Buffer.concat(chunks), new Set()))
  req.on('error', () => res.destroy())
})
proxy.listen(port, () => console.log(`API on http://localhost:${port}  (${workers} PHP workers on ports ${targets[0]}-${targets.at(-1)}). Ctrl+C stops everything.`))
proxy.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE' ? `Port ${port} is already in use. Is dev-parallel.mjs (or php artisan serve) already running in another terminal?` : err.message)
  stop(1)
})

function stop(code = 0) {
  stopping = true
  children.forEach((c) => c.kill())
  proxy.close()
  process.exit(code)
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
