import type { Worker } from 'tesseract.js'
import { KEYWORD_FUZZY_MIN, LICENSE_KEYWORDS, TESSERACT_CORE_PATH, TESSERACT_LANG_PATH, TESSERACT_WORKER_PATH } from './config'

// tesseract.js is only imported on the verification page; its worker, core and language data are served from /tesseract.
let worker: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('eng', 1, { workerPath: TESSERACT_WORKER_PATH, corePath: TESSERACT_CORE_PATH, langPath: TESSERACT_LANG_PATH, gzip: true })
    })()
    worker.catch(() => { worker = null })
  }
  return worker
}

/** Reads the text on a photo. Runs entirely in the browser. */
export async function readText(canvas: HTMLCanvasElement): Promise<string> {
  const w = await getWorker()
  const { data } = await w.recognize(canvas)
  return data.text ?? ''
}

export async function releaseOcr() {
  if (!worker) return
  const pending = worker
  worker = null
  try {
    await (await pending).terminate()
  } catch {
    /* already gone */
  }
}

// ---------- fuzzy matching helpers ----------

export const normalizeText = (s: string) => s.toUpperCase().replace(/[’`´]/g, "'").replace(/[^A-Z0-9']+/g, ' ').replace(/\s+/g, ' ').trim()

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

const similarity = (a: string, b: string) => (a || b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 1)

/** Best similarity (0..1) of `needle` against any same-sized stretch of `haystack`. */
function bestWindow(haystack: string, needle: string): number {
  if (!needle) return 0
  if (haystack.length < needle.length - 2) return similarity(haystack, needle)
  let best = 0
  for (const len of [needle.length, needle.length - 1, needle.length + 1]) {
    for (let i = 0; i + len <= haystack.length; i++) {
      best = Math.max(best, similarity(haystack.slice(i, i + len), needle))
      if (best === 1) return 1
    }
  }
  return best
}

/** Which of the expected license keywords appear in the OCR text (case-insensitive, tolerant of small OCR errors). */
export function findKeywords(ocrText: string, keywords: string[] = LICENSE_KEYWORDS): string[] {
  const text = normalizeText(ocrText)
  return keywords.filter((k) => bestWindow(text, normalizeText(k)) >= KEYWORD_FUZZY_MIN)
}

/** OCR commonly swaps look-alike characters, so fold them together before comparing license numbers. */
const fold = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2')

/** How well the typed license number shows up in the OCR text (0..1); spaces and dashes are ignored. */
export function numberMatch(typed: string, ocrText: string): number {
  const needle = fold(typed)
  if (needle.length < 5) return 0
  return bestWindow(fold(ocrText), needle)
}

/** Share of the typed name's words that appear (fuzzily) in the OCR text (0..1). */
export function nameMatch(typed: string, ocrText: string): number {
  const words = normalizeText(typed).split(' ').filter((w) => w.length > 1)
  if (!words.length) return 0
  const text = normalizeText(ocrText)
  const found = words.filter((w) => bestWindow(text, w) >= (w.length <= 3 ? 0.99 : 0.75))
  return found.length / words.length
}
