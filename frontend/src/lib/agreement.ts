export type AgreementSection = { title: string; body: string[] }

export type AgreementPreview = {
  version: string
  title: string
  sections: AgreementSection[]
  text: string
  hash: string
  signer_name: string
  free_cancellation_until: string
}

/** Same rule as the server: same words in any order, ignoring case, accents and punctuation. */
export function namesMatch(typed: string, verified: string): boolean {
  const tokens = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z ]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ')
  const a = tokens(typed)
  return a !== '' && a === tokens(verified)
}

/** Turns a stored plain-text agreement back into titled sections. */
export function parseAgreementText(text: string): AgreementSection[] {
  const [, ...blocks] = text.trim().split(/\n\s*\n/)
  return blocks.map((block) => {
    const [title, ...body] = block.split('\n').map((l) => l.trim()).filter(Boolean)
    return { title, body }
  })
}
