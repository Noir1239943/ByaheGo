import { useLayoutEffect, type RefObject } from 'react'

type Anchors = RefObject<HTMLElement | null>[]

type Options = {
  /** Line up with the anchor's left edge, or centre on it. */
  align?: 'start' | 'center'
  /** Make the popover exactly as wide as the anchor (but at least this many px). */
  matchWidth?: number
  /**
   * Never cover the anchor: open below, or above when there's more room there, and shrink to fit (for lists under a
   * text box, so what you type stays visible). Without it a popover too tall for either side is centred on screen.
   */
  shrink?: boolean
  /** Below this screen width the popover is laid out by its own CSS (e.g. a bottom sheet) and left alone. */
  sheetBelow?: number
}

/** The smallest box around all the anchors (e.g. the pick-up and return fields together). */
export function anchorRect(anchors: Anchors) {
  const rects = anchors.map((a) => a.current?.getBoundingClientRect()).filter((r): r is DOMRect => !!r)
  if (!rects.length) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}

/**
 * Keeps a position:fixed popover next to its anchor and inside the visible part of the screen (on phones that's the part
 * above the on-screen keyboard). Fixed positioning lets it float out of dialogs and scrolling boxes without being cut off.
 * The popover should start with style={{ visibility: 'hidden' }}; it is shown once placed, before the browser paints.
 */
export function useAnchoredPopover(open: boolean, anchors: Anchors, popRef: RefObject<HTMLElement | null>, { align = 'start', matchWidth, shrink = false, sheetBelow = 0 }: Options = {}) {
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const p = popRef.current
      const a = anchorRect(anchors)
      if (!p || !a) return
      if (window.innerWidth < sheetBelow) {
        Object.assign(p.style, { top: '', left: '', width: '', maxHeight: '', visibility: 'visible' })
        return
      }
      const vv = window.visualViewport
      const viewTop = vv?.offsetTop ?? 0
      const viewBottom = viewTop + (vv?.height ?? window.innerHeight)
      const viewWidth = vv?.width ?? window.innerWidth
      const gap = 6
      const edge = 8
      if (matchWidth !== undefined) p.style.width = `${Math.min(Math.max(a.width, matchWidth), viewWidth - edge * 2)}px`
      p.style.maxHeight = '' // measure at the size its CSS allows
      const w = p.offsetWidth
      const h = p.offsetHeight
      const below = viewBottom - a.bottom - gap - edge
      const above = a.top - viewTop - gap - edge
      let top: number
      if (h <= below) top = a.bottom + gap
      else if (h <= above) top = a.top - gap - h
      else if (shrink) {
        const room = Math.max(below, above, 96)
        p.style.maxHeight = `${room}px`
        top = below >= above ? a.bottom + gap : a.top - gap - Math.min(h, room)
      } else top = Math.max(viewTop + edge, viewTop + (viewBottom - viewTop - h) / 2)
      const want = align === 'center' ? a.left + a.width / 2 - w / 2 : a.left
      const left = Math.max(edge, Math.min(want, viewWidth - w - edge))
      Object.assign(p.style, { top: `${top}px`, left: `${left}px`, visibility: 'visible' })
    }
    place()
    const ro = new ResizeObserver(place)
    if (popRef.current) ro.observe(popRef.current) // (setting the same max-height again doesn't re-trigger it)
    anchors.forEach((a) => a.current && ro.observe(a.current))
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
    // anchors is a new array each render; the refs inside it are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, popRef, align, matchWidth, shrink, sheetBelow])
}
