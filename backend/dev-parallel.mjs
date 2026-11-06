// Local API server that answers several requests at the same time on Windows.
//
//   node dev-parallel.mjs            -> http://localhost:8000 (same address as `php artisan serve`), 4 workers
//   node dev-parallel.mjs 8000 6     -> port 8000, 6 workers
//
// PHP's built-in server (what `php artisan serve` uses) handles ONE request at a time on Windows, so a page that asks for
// five things waits for them one after the other. This starts a few of them on private ports and shares the requests out.
// Development only; production (Apache on Render) already serves requests in parallel.
import { spawn } from 'node:child_process'
import http from 'node:http'

const port = Number(process.argv[2] || 8000)
const workers = Math.max(1, Math.min(12, Number(process.argv[3] || 4)))
const base = port + 100
const targets = Array.from({ length: workers }, (_, i) => base + i)

const children = targets.map((p) => {
  const child = spawn('php', ['-S', `127.0.0.1:${p}`, '-t', 'public'], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, DB_PERSISTENT: process.env.DB_PERSISTENT ?? 'true' } })
  child.on('exit', (code) => { if (code) console.error(`worker on ${p} stopped (${code})`) })
  return child
})

let next = 0
const proxy = http.createServer((req, res) => {
  const target = targets[next++ % targets.length]
  const out = http.request({ host: '127.0.0.1', port: target, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${port}` } }, (back) => {
    res.writeHead(back.statusCode ?? 502, back.headers)
    back.pipe(res)
  })
  out.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"message":"A local worker is not ready yet. Try again."}') })
  req.pipe(out)
})
proxy.listen(port, () => console.log(`API on http://localhost:${port}  (${workers} PHP workers on ports ${targets[0]}-${targets.at(-1)}). Ctrl+C stops everything.`))

const stop = () => { children.forEach((c) => c.kill()); proxy.close(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
