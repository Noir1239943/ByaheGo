/** Tunable thresholds and wording for the on-device ID checks. Everything lives here so it's easy to adjust. */

/** Face match between the live face and the license photo (Human "faceres" similarity, 0..1). */
export const FACE_MATCH_MIN = 0.5
/** Matches within this margin above the minimum are shown as a warning ("borderline"). */
export const FACE_MATCH_BORDERLINE = 0.05

/** Minimum anti-spoof ("is this a real face, not a screen or print") and liveness scores, 0..1. */
export const ANTISPOOF_MIN = 0.6
export const LIVENESS_MIN = 0.6

/** Smallest face (px, shorter side of the box) accepted in the live selfie frame. */
export const SELFIE_MIN_FACE_PX = 140
/** Face detector confidence needed on stills and live frames. */
export const FACE_MIN_CONFIDENCE = 0.5
/** On the license front, the main face must be this many times bigger than any other detected face (ghost image). */
export const LICENSE_GHOST_FACE_RATIO = 2.5

/** Blink length window (ms) that counts as a real blink. */
export const BLINK_MIN_MS = 10
export const BLINK_MAX_MS = 800
/** Give up on the liveness challenge after this long. */
export const LIVENESS_TIMEOUT_MS = 45_000

/** Keywords expected somewhere on the front of a Philippine license. Fuzzy, case-insensitive. */
export const LICENSE_KEYWORDS = [
  'REPUBLIC OF THE PHILIPPINES',
  'LAND TRANSPORTATION OFFICE',
  "DRIVER'S LICENSE",
  'DEPARTMENT OF TRANSPORTATION',
  'LICENSE NO',
  'EXPIRATION DATE',
  'DATE OF BIRTH',
  'RESTRICTIONS',
]
/** How many of the keywords must be found on the front (fewer = hard fail). */
export const KEYWORD_MIN_HITS = 2
/** Keyword is "found" when this share of its characters match the best window in the OCR text (0..1). */
export const KEYWORD_FUZZY_MIN = 0.78

/** Typed license number / name must reach this similarity with the OCR text (0..1), otherwise a warning. */
export const NUMBER_MATCH_MIN = 0.85
export const NAME_MATCH_MIN = 0.6

/** Words usually printed on the back; finding none is only a warning. */
export const BACK_KEYWORDS = ['RESTRICTIONS', 'CONDITIONS', 'EXPIRATION', 'AGENCY CODE', 'BLOOD TYPE', 'EYES COLOR', 'DL CODES', 'SIGNATURE', 'LICENSE']
/** Back of license: minimum amount of readable text (alphanumeric characters). */
export const BACK_MIN_TEXT_CHARS = 25
/** Back vs front: 64-bit difference hash distance at or below this means "same photo". */
export const BACK_DUPLICATE_MAX_DISTANCE = 10

/** Where the model files and OCR assets are served from (copied into /public). */
export const MODEL_BASE_PATH = '/models/'
export const TESSERACT_WORKER_PATH = '/tesseract/worker.min.js'
export const TESSERACT_CORE_PATH = '/tesseract'
export const TESSERACT_LANG_PATH = '/tesseract/lang'

/** Longest side (px) used when running detection / OCR on a photo. */
export const ANALYSIS_MAX_DIM = 1600
