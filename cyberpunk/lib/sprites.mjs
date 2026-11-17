// The combat sprite sheets of D24's request (docs/design/combat-sprites-request.md): their layouts, the file names
// ChatGPT saves them under, the poses' timing, and the measures the Sandbox's Sprites page checks each cell with.
// Nameless: Umas are outfit ids. Shared by the server (to list and serve files) and the page (to cut and check cells).

/** The request's working cell: a 512 cell, the figure about 416 px from ear tips to soles, feet on y 480, centred. */
export const CELL = 512
export const FIGURE = 416
export const FOOT = 480
export const CENTRE = 256
/** The Umas the request names. */
export const REQUESTED = [106801, 112901]
export const VIEWS = ['front', 'back', 'left', 'right']

const seq = (action, n, view) => Array.from({ length: n }, (_, frame) => ({ action, view, frame }))
const pad = (cells, n) => [...cells, ...Array(Math.max(0, n - cells.length)).fill(null)]
const reactions = (view, victory) => pad([
  ...seq('act', 3, view), ...seq('hurt', 2, view), ...seq('guard', 2, view), ...seq('kneel', 3, view),
  ...(victory ? seq('victory', 4, view) : []),
], victory ? 16 : 12)

/** Each sheet: its id in the file name, its label, the canvas and grid asked for, and what each cell holds (row-major). */
export const SHEETS = {
  identity: { label: 'S1 · Identity', w: 1536, h: 1024, cols: 3, rows: 2, cells: [{ action: 'key', view: 'key', frame: 0 }, ...VIEWS.map((view) => ({ action: 'stand', view, frame: 0 })), null] },
  'walk-fb': { label: 'S2 · Walk front and back', w: 2048, h: 1536, cols: 4, rows: 3, cells: [...seq('walk', 6, 'front'), ...seq('walk', 6, 'back')] },
  'walk-lr': { label: 'S3 · Walk left and right', w: 2048, h: 1536, cols: 4, rows: 3, cells: [...seq('walk', 6, 'left'), ...seq('walk', 6, 'right')] },
  front: { label: 'S4 · Front reactions', w: 2048, h: 2048, cols: 4, rows: 4, cells: reactions('front', true) },
  back: { label: 'S5 · Back reactions', w: 2048, h: 1536, cols: 4, rows: 3, cells: reactions('back', false) },
  left: { label: 'S6 · Left reactions', w: 2048, h: 1536, cols: 4, rows: 3, cells: reactions('left', false) },
  right: { label: 'S7 · Right reactions', w: 2048, h: 1536, cols: 4, rows: 3, cells: reactions('right', false) },
}
export const SHEET_ORDER = Object.keys(SHEETS)

/** Frame times in ms at 1×: the walk is v1's; the rest follow the board's beats (D24). The last frame of a held pose is long. */
export const TIMES = { walk: [110, 110, 110, 110, 110, 110], act: [150, 120, 220], hurt: [90, 220], guard: [120, 420], kneel: [140, 180, 800], victory: [150, 170, 220, 700] }
/** Poses whose figure stands: their height and feet are compared with the figure's. */
const STANDING = new Set(['key', 'stand', 'walk', 'act', 'hurt', 'guard', 'victory'])

const NAME = /^(\d{5,7})-combat-(identity|walk-fb|walk-lr|front|back|left|right)(-helmet)?-v(\d{1,3})\.png$/

/** A sheet's file name, read: `<outfitId>-combat-<sheet>[-helmet]-v<take>.png`, or null. */
export function parseSheetName(file) {
  const m = NAME.exec(String(file))
  if (!m) return null
  return { outfit: Number(m[1]), sheet: m[2], helmet: Boolean(m[3]), take: Number(m[4]), file: String(file) }
}

/** The key of one sheet of one Uma, helmet or not. */
export const sheetKey = (s) => `${s.outfit}/${s.sheet}${s.helmet ? '-helmet' : ''}`

/** File names to sheets, the latest take of each, with the takes there are; sorted by Uma, helmet last, then the request's order. */
export function latestSheets(files) {
  const by = new Map()
  for (const f of files) {
    const s = parseSheetName(f)
    if (!s) continue
    const key = sheetKey(s), have = by.get(key)
    if (!have) by.set(key, { ...s, takes: [s.take] })
    else { have.takes.push(s.take); if (s.take > have.take) Object.assign(have, s, { takes: have.takes }) }
  }
  for (const s of by.values()) s.takes.sort((a, b) => a - b)
  return [...by.values()].sort((a, b) => a.outfit - b.outfit || Number(a.helmet) - Number(b.helmet) || SHEET_ORDER.indexOf(a.sheet) - SHEET_ORDER.indexOf(b.sheet))
}

/** Consecutive cells of one action and view, with their times: what the page plays as a loop or a beat. */
export function animations(sheet) {
  const groups = []
  SHEETS[sheet].cells.forEach((cell, index) => {
    if (!cell) return
    const last = groups.at(-1)
    if (last && last.action === cell.action && last.view === cell.view) last.cells.push(index)
    else groups.push({ action: cell.action, view: cell.view, cells: [index] })
  })
  return groups.map((g) => ({ ...g, ms: g.cells.map((_, i) => (TIMES[g.action] ?? [])[i] ?? 400) }))
}

/** A cell's rectangle on the image as it came back, whatever its size: the grid divides it evenly. */
export function cellRect(sheet, index, width, height) {
  const { cols, rows } = SHEETS[sheet]
  const w = width / cols, h = height / rows
  return { x: (index % cols) * w, y: Math.floor(index / cols) * h, w, h }
}

/**
 * What a cell's alpha says, scaled to the 512 cell: the opaque box (alpha ≥ 128), its height, its feet row and centre, how
 * many opaque pixels touch the 14 px border, and how much of the cell is covered (a filled background covers it all).
 * `alpha` is the cell's alpha channel, row-major, `w` × `h`.
 */
export function measure(alpha, w, h) {
  const k = CELL / w
  let top = h, bottom = -1, left = w, right = -1, opaque = 0, touching = 0, any = 0
  const border = 14 / k
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = alpha[y * w + x]
      if (a > 0) any++
      if (a < 128) continue
      opaque++
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
      if (x < border || y < border || x >= w - border || y >= h - border) touching++
    }
  }
  if (!opaque) return { empty: true, coverage: any / (w * h) }
  return {
    empty: false, top: top * k, bottom: (bottom + 1) * k, left: left * k, right: (right + 1) * k,
    height: (bottom + 1 - top) * k, centre: ((left + right + 1) / 2) * k, touching, coverage: any / (w * h),
  }
}

/** The page's findings for a sheet from its cells' measures: missing figures, a filled background, figures off the cell's line. */
export function sheetFindings(sheet, measures) {
  const spec = SHEETS[sheet], out = []
  const say = (level, index, message) => out.push({ level, index, message })
  const standing = []
  spec.cells.forEach((cell, i) => {
    const m = measures[i]
    if (!m) return
    if (!cell) { if (!m.empty) say('warn', i, 'This cell should be empty'); return }
    if (m.empty) { say('error', i, 'No figure in this cell'); return }
    if (m.coverage > 0.6) say('error', i, 'The background isn’t transparent')
    if (m.touching > 0) say('warn', i, 'The figure reaches the 14 px border')
    if (STANDING.has(cell.action)) {
      standing.push({ i, m })
      if (Math.abs(m.bottom - FOOT) > 12) say('warn', i, `Feet on y ${Math.round(m.bottom)}, not ${FOOT}`)
      // Profiles trail a tail behind them, so only the front, back and key views are held to the centre line.
      if (!['left', 'right'].includes(cell.view) && Math.abs(m.centre - CENTRE) > 40) say('warn', i, `Centred on x ${Math.round(m.centre)}, not ${CENTRE}`)
    }
  })
  // Scale: the standing figures of a sheet agree within 4%, and sit near the request's height (arms up may add a little).
  const still = standing.filter(({ i }) => ['key', 'stand', 'walk'].includes(spec.cells[i].action))
  if (still.length > 1) {
    const hs = still.map(({ m }) => m.height), lo = Math.min(...hs), hi = Math.max(...hs)
    if (hi - lo > FIGURE * 0.04) say('warn', null, `Standing heights run ${Math.round(lo)}–${Math.round(hi)} px: more than 4% apart`)
    const mid = hs.reduce((a, b) => a + b, 0) / hs.length
    if (Math.abs(mid - FIGURE) > FIGURE * 0.1) say('warn', null, `Standing figures are about ${Math.round(mid)} px, not about ${FIGURE}`)
  }
  return out
}

/** The request's fourteen sheets for an Uma, with what came back. */
export function expectedSheets(outfit, sheets) {
  const have = new Map(sheets.filter((s) => s.outfit === outfit).map((s) => [sheetKey(s), s]))
  return [false, true].flatMap((helmet) => SHEET_ORDER.map((sheet) => {
    const key = sheetKey({ outfit, sheet, helmet })
    return { key, outfit, sheet, helmet, label: `${SHEETS[sheet].label}${helmet ? ' · helmet' : ''}`, got: have.get(key) ?? null }
  }))
}
