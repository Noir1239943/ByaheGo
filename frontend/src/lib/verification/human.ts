import type { Config, FaceResult, Human } from '@vladmandic/human'
import { ANALYSIS_MAX_DIM, FACE_MIN_CONFIDENCE, MODEL_BASE_PATH } from './config'
import type { FaceBox } from './types'

// Human (face detection / description / liveness / antispoof) is only imported on the verification page.
let instance: Promise<Human> | null = null

const BASE_CONFIG = {
  cacheSensitivity: 0.01,
  modelBasePath: MODEL_BASE_PATH,
  filter: { enabled: true, equalization: true },
  debug: false,
  face: {
    enabled: true,
    detector: { rotation: true, return: false, mask: false },
    description: { enabled: true }, // faceres descriptor, used for face matching
    iris: { enabled: true }, // needed for gaze / blink gestures
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: true },
} as unknown as Partial<Config>

/** Per-call settings: still photos (license) need a fresh read every time and no live/antispoof models. */
const STILL = {
  cacheSensitivity: 0,
  face: {
    detector: { maxDetected: 6, minConfidence: FACE_MIN_CONFIDENCE, rotation: true },
    iris: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  gesture: { enabled: false },
} as unknown as Partial<Config>

const LIVE = {
  cacheSensitivity: 0.01,
  face: {
    detector: { maxDetected: 3, minConfidence: FACE_MIN_CONFIDENCE, rotation: true },
    iris: { enabled: true },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  gesture: { enabled: true },
} as unknown as Partial<Config>

export function loadHuman(): Promise<Human> {
  if (!instance) {
    instance = (async () => {
      const { Human: HumanLib } = await import('@vladmandic/human')
      let human = new HumanLib(BASE_CONFIG)
      try {
        await human.load()
        await human.warmup()
      } catch {
        // No WebGL (some VMs / old phones): fall back to the slower CPU backend.
        human = new HumanLib({ ...BASE_CONFIG, backend: 'cpu' } as Partial<Config>)
        await human.load()
      }
      return human
    })()
    instance.catch(() => { instance = null })
  }
  return instance
}

export interface DetectedFace {
  box: FaceBox
  area: number
  score: number
  embedding: number[] | null
  real: number | null
  live: number | null
}

const toBox = (f: FaceResult): FaceBox => ({ x: f.boxRaw[0], y: f.boxRaw[1], w: f.boxRaw[2], h: f.boxRaw[3] })

export function toDetected(f: FaceResult): DetectedFace {
  const box = toBox(f)
  return { box, area: box.w * box.h, score: f.faceScore || f.boxScore || f.score || 0, embedding: f.embedding?.length ? f.embedding : null, real: f.real ?? null, live: f.live ?? null }
}

/** Draws a photo onto a canvas capped at ANALYSIS_MAX_DIM (EXIF rotation applied by the browser). */
export async function photoToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, ANALYSIS_MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Finds faces (largest first) in a still photo. */
export async function detectStill(canvas: HTMLCanvasElement): Promise<DetectedFace[]> {
  const human = await loadHuman()
  const res = await human.detect(canvas, STILL)
  return res.face.map(toDetected).sort((a, b) => b.area - a.area)
}

/** Detects on a live video frame; returns raw results so the caller can read gestures. */
export async function detectLive(source: HTMLVideoElement | HTMLCanvasElement) {
  const human = await loadHuman()
  const res = await human.detect(source, LIVE)
  return { faces: res.face.map(toDetected).sort((a, b) => b.area - a.area), gestures: Object.values(res.gesture).map((g) => g.gesture as string) }
}

/** Compares two face descriptors with the settings Human recommends for its faceres model (0..1). */
export async function faceSimilarity(a: number[], b: number[]): Promise<number> {
  const human = await loadHuman()
  return human.match.similarity(a, b, { order: 2, multiplier: 25, min: 0.2, max: 0.8 })
}

/** Quick 64-bit difference hash of a canvas, used to spot "same photo" resubmissions on the device. */
export function dHash(source: CanvasImageSource): string {
  const c = document.createElement('canvas')
  c.width = 9
  c.height = 8
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return ''
  ctx.drawImage(source, 0, 0, 9, 8)
  const px = ctx.getImageData(0, 0, 9, 8).data
  const gray = (x: number, y: number) => { const i = (y * 9 + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] }
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray(x, y) > gray(x + 1, y) ? '1' : '0'
  return bits
}

export function hashDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}

export async function releaseHuman() {
  if (!instance) return
  const pending = instance
  instance = null
  try {
    const human = await pending
    human.tf.engine().disposeVariables()
  } catch {
    /* nothing to release */
  }
}
