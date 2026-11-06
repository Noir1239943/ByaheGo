import {
  ANTISPOOF_MIN, BACK_DUPLICATE_MAX_DISTANCE, BACK_MIN_TEXT_CHARS, FACE_MATCH_BORDERLINE, FACE_MATCH_MIN, KEYWORD_MIN_HITS, LIVENESS_MIN,
  NAME_MATCH_MIN, NUMBER_MATCH_MIN, SELFIE_MIN_FACE_PX,
} from './config'
import { hashDistance } from './human'
import { nameMatch, numberMatch } from './ocr'
import type { BackAnalysis, CheckStatus, ClientCheck, ClientChecks, FrontAnalysis, SelfieAnalysis } from './types'

export interface CheckInput {
  front: FrontAnalysis | null
  back: BackAnalysis | null
  selfie: SelfieAnalysis | null
  licenseNumber: string
  fullName: string
}

const MSG = {
  noFace: "We couldn't find the photo on your license. Retake it in good light with the whole card visible.",
  manyFaces: 'We found more than one face on this photo. Retake it with only the front of your license in view.',
  fewKeywords: "This doesn't look like the front of a driver's license. Retake it flat on a table, in good light, with all the text readable.",
  noBackText: "We couldn't read any text on this photo. Retake the back of your license in good light so the printed text is sharp.",
  backFace: 'This looks like the front of the license (a face was found). Please photograph the back of the card.',
  backDuplicate: 'The back photo looks like the same picture as the front. Please photograph the back of your license.',
  selfieDuplicate: 'Your selfie looks like the same picture as your license photo. Please take a new live selfie.',
}

const pct = (n: number) => `${Math.round(n * 100)}%`

/** Runs every on-device check we can for the photos taken so far. Missing steps are `not_checked`, never green. */
export function evaluateChecks({ front, back, selfie, licenseNumber, fullName }: CheckInput): ClientCheck[] {
  const out: ClientCheck[] = []
  const add = (key: string, label: string, status: CheckStatus, detail: string, value?: number | null) => out.push({ key, label, status, detail, value: value ?? null })
  const pending = 'Not checked yet.'

  // ----- Front of license -----
  if (!front) {
    add('front_face', 'Face on license photo', 'not_checked', pending)
    add('front_keywords', 'License wording found (OCR)', 'not_checked', pending)
  } else {
    add('front_face', 'Face on license photo', front.faceCount === 1 ? 'pass' : 'fail', front.faceCount === 0 ? MSG.noFace : front.faceCount > 1 ? MSG.manyFaces : 'Found one face on the license.', front.faceCount)
    add('front_keywords', 'License wording found (OCR)', front.keywordHits.length >= KEYWORD_MIN_HITS ? 'pass' : 'fail',
      front.keywordHits.length >= KEYWORD_MIN_HITS ? `Found ${front.keywordHits.length}: ${front.keywordHits.join(', ')}.` : MSG.fewKeywords, front.keywordHits.length)
  }
  const num = licenseNumber.trim()
  if (front && num) {
    const m = numberMatch(num, front.ocrText)
    add('front_number', 'License number matches the photo (OCR)', m >= NUMBER_MATCH_MIN ? 'pass' : 'warn',
      m >= NUMBER_MATCH_MIN ? `${num} was found on the card.` : `We couldn't confirm ${num} on the card. Text reading can miss digits, so double-check what you typed.`, m)
  } else add('front_number', 'License number matches the photo (OCR)', 'not_checked', pending)
  const name = fullName.trim()
  if (front && name) {
    const m = nameMatch(name, front.ocrText)
    add('front_name', 'Name matches the photo (OCR)', m >= NAME_MATCH_MIN ? 'pass' : 'warn',
      m >= NAME_MATCH_MIN ? 'Your name was found on the card.' : "We couldn't find your name on the card. Text reading can miss words, so double-check what you typed.", m)
  } else add('front_name', 'Name matches the photo (OCR)', 'not_checked', pending)

  // ----- Back of license -----
  if (!back) {
    add('back_text', 'Readable text on the back (OCR)', 'not_checked', pending)
    add('back_no_face', 'No face on the back', 'not_checked', pending)
    add('back_keywords', 'Back-of-license wording', 'not_checked', pending)
    add('back_duplicate', 'Back differs from the front', 'not_checked', pending)
  } else {
    add('back_text', 'Readable text on the back (OCR)', back.textChars >= BACK_MIN_TEXT_CHARS ? 'pass' : 'fail', back.textChars >= BACK_MIN_TEXT_CHARS ? 'Printed text is readable.' : MSG.noBackText, back.textChars)
    add('back_no_face', 'No face on the back', back.faceCount === 0 ? 'pass' : 'fail', back.faceCount === 0 ? 'No face on the back, as expected.' : MSG.backFace, back.faceCount)
    add('back_keywords', 'Back-of-license wording', back.keywordHits.length ? 'pass' : 'warn', back.keywordHits.length ? `Found: ${back.keywordHits.join(', ')}.` : "We didn't recognise typical back-of-license wording. Make sure the photo is sharp.", back.keywordHits.length)
    if (front) {
      const d = hashDistance(front.hash, back.hash)
      add('back_duplicate', 'Back differs from the front', d > BACK_DUPLICATE_MAX_DISTANCE ? 'pass' : 'fail', d > BACK_DUPLICATE_MAX_DISTANCE ? 'Front and back are different photos.' : MSG.backDuplicate, d)
    } else add('back_duplicate', 'Back differs from the front', 'not_checked', pending)
  }

  // ----- Live selfie -----
  if (!selfie) {
    for (const [k, l] of [['selfie_face', 'Face in live selfie'], ['selfie_challenge', 'Blink and head-turn challenge'], ['selfie_liveness', 'Liveness score'], ['selfie_antispoof', 'Anti-spoof score (not a screen or print)'], ['face_match', 'Selfie matches the license photo'], ['selfie_license_face', 'License held next to face'], ['selfie_duplicate', 'Selfie differs from license photos']] as const) add(k, l, 'not_checked', pending)
  } else {
    add('selfie_face', 'Face in live selfie', selfie.faceCount >= 1 ? 'pass' : 'fail', selfie.faceCount >= 1 ? 'A clear face was captured.' : 'We could not find your face in the selfie. Retake it facing the camera.', selfie.faceCount)
    add('selfie_challenge', 'Blink and head-turn challenge', selfie.blinked && selfie.turned ? 'pass' : 'fail', selfie.blinked && selfie.turned ? 'Blinked and turned left and right.' : 'The blink and head-turn challenge was not completed.')
    add('selfie_liveness', 'Liveness score', selfie.liveness >= LIVENESS_MIN ? 'pass' : 'fail', selfie.liveness >= LIVENESS_MIN ? `Live person detected (${pct(selfie.liveness)}).` : `We couldn't confirm a live person (${pct(selfie.liveness)}). Retake the selfie in good light.`, selfie.liveness)
    add('selfie_antispoof', 'Anti-spoof score (not a screen or print)', selfie.antispoof >= ANTISPOOF_MIN ? 'pass' : 'fail', selfie.antispoof >= ANTISPOOF_MIN ? `Real face detected (${pct(selfie.antispoof)}).` : `This looks like a photo or screen, not a real face (${pct(selfie.antispoof)}). Use your live camera.`, selfie.antispoof)
    if (selfie.similarity === null) add('face_match', 'Selfie matches the license photo', 'not_checked', 'No license photo to compare with.')
    else if (selfie.similarity < FACE_MATCH_MIN) add('face_match', 'Selfie matches the license photo', 'fail', `Your face doesn't match the photo on the license (${pct(selfie.similarity)}). Retake both photos in good light.`, selfie.similarity)
    else if (selfie.similarity < FACE_MATCH_MIN + FACE_MATCH_BORDERLINE) add('face_match', 'Selfie matches the license photo', 'warn', `Borderline match (${pct(selfie.similarity)}). A reviewer will take a closer look.`, selfie.similarity)
    else add('face_match', 'Selfie matches the license photo', 'pass', `Faces match (${pct(selfie.similarity)}).`, selfie.similarity)
    add('selfie_license_face', 'License held next to face', selfie.licenseFaceSeen ? 'pass' : 'warn', selfie.licenseFaceSeen ? 'The license photo was visible next to your face.' : 'We could not see your license next to your face. A reviewer will check the photo.')
    const dups = [front, back].flatMap((p) => (p ? [hashDistance(p.hash, selfie.hash)] : []))
    const closest = dups.length ? Math.min(...dups) : null
    if (closest === null) add('selfie_duplicate', 'Selfie differs from license photos', 'not_checked', pending)
    else add('selfie_duplicate', 'Selfie differs from license photos', closest > BACK_DUPLICATE_MAX_DISTANCE ? 'pass' : 'fail', closest > BACK_DUPLICATE_MAX_DISTANCE ? 'Selfie is a different photo.' : MSG.selfieDuplicate, closest)
  }
  return out
}

/** Package the results for the backend. Face descriptors and images are never included. */
export function buildClientChecks(input: CheckInput): ClientChecks {
  const { front, back, selfie } = input
  return {
    version: 1,
    checks: evaluateChecks(input),
    face_similarity: selfie?.similarity ?? null,
    liveness: selfie?.liveness ?? null,
    antispoof: selfie?.antispoof ?? null,
    ocr_keyword_hits: front?.keywordHits ?? [],
    ocr_text: { front: front?.ocrText.slice(0, 4000) ?? '', back: back?.ocrText.slice(0, 4000) ?? '' },
    faces: { license: front?.box ?? null, selfie: selfie?.box ?? null },
    thresholds: { face_match_min: FACE_MATCH_MIN, liveness_min: LIVENESS_MIN, antispoof_min: ANTISPOOF_MIN, keyword_min_hits: KEYWORD_MIN_HITS, selfie_min_face_px: SELFIE_MIN_FACE_PX },
  }
}

export const hardFails = (checks: ClientCheck[]) => checks.filter((c) => c.status === 'fail')
