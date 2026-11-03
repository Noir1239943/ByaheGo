import { BACK_KEYWORDS, LICENSE_GHOST_FACE_RATIO } from './config'
import { dHash, detectStill, photoToCanvas } from './human'
import { findKeywords, normalizeText, readText } from './ocr'
import type { BackAnalysis, FrontAnalysis } from './types'

/** Looks at the front of a license: the ID photo (face) and the printed text. Nothing leaves the browser. */
export async function analyzeFront(file: File): Promise<FrontAnalysis> {
  const canvas = await photoToCanvas(file)
  const faces = await detectStill(canvas)
  const main = faces[0] ?? null
  // Licenses carry a small "ghost" copy of the portrait; only count faces that are similar in size to the main one.
  const significant = main ? faces.filter((f) => f.area * LICENSE_GHOST_FACE_RATIO >= main.area) : []
  const ocrText = await readText(canvas)
  return {
    faceCount: significant.length,
    box: main?.box ?? null,
    embedding: main?.embedding ?? null,
    ocrText,
    keywordHits: findKeywords(ocrText),
    hash: dHash(canvas),
  }
}

/** Looks at the back of a license: it should be readable text with no face on it. */
export async function analyzeBack(file: File): Promise<BackAnalysis> {
  const canvas = await photoToCanvas(file)
  const faces = await detectStill(canvas)
  const ocrText = await readText(canvas)
  const textChars = normalizeText(ocrText).split(' ').filter((w) => w.length >= 3).join('').length
  return { faceCount: faces.length, ocrText, textChars, keywordHits: findKeywords(ocrText, BACK_KEYWORDS), hash: dHash(canvas) }
}
