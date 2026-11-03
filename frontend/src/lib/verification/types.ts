export type CheckStatus = 'pass' | 'warn' | 'fail' | 'not_checked'

/** One on-device check. Reported by the browser, so the admin treats it as supporting evidence only. */
export interface ClientCheck {
  key: string
  label: string
  status: CheckStatus
  /** Score or measured value (similarity 0..1, keyword hits, …) when it makes sense. */
  value?: number | null
  /** Short human-readable detail. For failures this is the retake instruction shown to the user. */
  detail: string
}

/** Face box as fractions (0..1) of the uploaded image, so it survives any resize. */
export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
}

/** What we send to the backend with the verification request (`client_checks`). */
export interface ClientChecks {
  version: 1
  checks: ClientCheck[]
  face_similarity: number | null
  liveness: number | null
  antispoof: number | null
  ocr_keyword_hits: string[]
  ocr_text: { front: string; back: string }
  faces: { license: FaceBox | null; selfie: FaceBox | null }
  thresholds: Record<string, number>
}

export interface FrontAnalysis {
  faceCount: number
  /** Main (largest) face on the card. */
  box: FaceBox | null
  /** Face descriptor; stays in the browser, never uploaded. */
  embedding: number[] | null
  ocrText: string
  keywordHits: string[]
  hash: string
}

export interface BackAnalysis {
  faceCount: number
  ocrText: string
  textChars: number
  keywordHits: string[]
  hash: string
}

export interface SelfieAnalysis {
  /** Faces in the capture frame (the user, plus optionally the small license photo). */
  faceCount: number
  box: FaceBox
  similarity: number | null
  liveness: number
  antispoof: number
  blinked: boolean
  turned: boolean
  licenseFaceSeen: boolean
  hash: string
}
