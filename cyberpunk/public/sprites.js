// The Sprites page (D24): ChatGPT's combat sprite sheets as the owner reviews them at the request's gates. Each sheet is
// cut by the request's grid in the browser, measured (feet, height, transparency), and shown three ways: playing on a
// night tile at the size the phone draws it, as a solid silhouette, and cell by cell. Her approved chibi stands beside
// it for scale. Nothing here names anyone: names come from the cast pack.
import { animations, cellRect, CELL, expectedSheets, measure, sheetFindings, SHEETS } from '/sprites-model.js'
import { D, h } from '/views.js'

/** The phone draws a 256-texel cell at 85⅓ pt (one texel a device pixel at DPR 3), so a 512 sheet cell shows at that size. */
const BOARD = 256 / 3
const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
const name = (outfit) => D.cast?.name(outfit) ?? String(outfit)
/** "Name · id", or the id alone when there's no cast pack to name her. */
const title = (outfit) => (name(outfit) === String(outfit) ? String(outfit) : `${name(outfit)} · ${outfit}`)
const pill = (cls, text) => h('span', { class: `pill ${cls}`, text })

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  return data
}

function image(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Couldn't load ${src}`))
    img.src = src
  })
}

/** A canvas sized in CSS pixels, drawn at the screen's density. */
function canvas(w, ht, cls) {
  const c = document.createElement('canvas')
  c.width = Math.round(w * DPR); c.height = Math.round(ht * DPR)
  c.style.cssText = `width:${w}px;height:${ht}px`
  if (cls) c.className = cls
  const ctx = c.getContext('2d')
  ctx.scale(DPR, DPR)
  ctx.imageSmoothingQuality = 'high'
  return [c, ctx]
}

/** A night tile: the board's ground at 35°, a tile 128 texels wide (about 43 pt), the squad's cyan ring under her feet. */
function nightTile(ctx, w, h, footY) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0b0d1a'); g.addColorStop(1, '#1a1f3d')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  const tw = 128 / 3, td = (128 * Math.sin((35 * Math.PI) / 180)) / 3
  ctx.fillStyle = '#232a4f'; ctx.fillRect(w / 2 - tw / 2, footY - td / 2, tw, td)
  ctx.strokeStyle = 'rgba(79,227,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(w / 2 - tw / 2 + 0.5, footY - td / 2 + 0.5, tw - 1, td - 1)
  ctx.strokeStyle = '#4fe3ff'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.ellipse(w / 2, footY, tw * 0.38, td * 0.32, 0, 0, Math.PI * 2); ctx.stroke()
}

/** One cell of a sheet drawn into a square of `size` CSS px at (x, y). */
function drawCell(ctx, img, rect, x, y, size) { ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, x, y, size, size) }

/** A cell filled solid black: LK8's silhouette check. */
function silhouette(img, rect, size) {
  const [c, ctx] = canvas(size, size, 'sprite-sil')
  drawCell(ctx, img, rect, 0, 0, size)
  ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size)
  return c
}

/** A cell's alpha channel at its size on the sheet. */
function alphaOf(img, rect) {
  const w = Math.round(rect.w), hh = Math.round(rect.h)
  const c = document.createElement('canvas'); c.width = w; c.height = hh
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, hh)
  const data = ctx.getImageData(0, 0, w, hh).data, a = new Uint8Array(w * hh)
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3]
  return { a, w, h: hh }
}

/** A loop on a night tile at board size (and magnified), with her chibi in the same view beside it for scale. */
function player(img, sheet, anim, chibi) {
  const pad = 10, W = BOARD + pad * 2, H = BOARD + 18, footY = (480 / CELL) * BOARD + 6
  const [small, sctx] = canvas(W * (chibi ? 2 : 1), H, 'sprite-tile')
  const big = 3, [large, lctx] = canvas(BOARD * big, BOARD * big, 'sprite-big')
  let i = 0
  const tick = () => {
    if (!small.isConnected && i > 0) return
    const rect = cellRect(sheet, anim.cells[i], img.naturalWidth, img.naturalHeight)
    sctx.clearRect(0, 0, small.width, small.height)
    nightTile(sctx, W, H, footY)
    drawCell(sctx, img, rect, pad, footY - (480 / CELL) * BOARD, BOARD)
    if (chibi) {
      sctx.save(); sctx.translate(W, 0); nightTile(sctx, W, H, footY)
      sctx.drawImage(chibi, pad, footY - (240 / 256) * BOARD, BOARD, BOARD); sctx.restore()
    }
    lctx.clearRect(0, 0, BOARD * big, BOARD * big)
    drawCell(lctx, img, rect, 0, 0, BOARD * big)
    const ms = anim.ms[i]
    i = (i + 1) % anim.cells.length
    setTimeout(tick, anim.cells.length === 1 ? 1000 : ms)
  }
  tick()
  return h('figure', { class: 'sprite-anim' },
    h('div', { class: 'sprite-pair' }, small, large),
    h('figcaption', { text: `${anim.action} · ${anim.view} · ${anim.cells.length} frame${anim.cells.length === 1 ? '' : 's'}${chibi ? ' · her chibi beside, for scale' : ''}` }))
}

/** The list: each Uma's fourteen sheets, what's back, and her chibi stills on the night board for reference. */
export function spritesView() {
  const box = h('div', { class: 'sprites' }, h('p', { class: 'loading', text: 'Reading the sheets…' }))
  getJson('/api/sprites').then(async (data) => {
    const parts = [h('h1', { text: 'Combat sprites' }),
      h('p', { class: 'muted', text: `D24's request: each Uma's chibi in her combat armor, helmet off then on, as fourteen pose sheets. ChatGPT saves them in ${data.dir}/<outfit>/; this page reads them as they land. Open a sheet to see it at the phone's size, as silhouettes, and cell by cell.` })]
    for (const outfit of data.outfits) {
      const list = expectedSheets(outfit, data.sheets)
      const back = list.filter((s) => s.got).length
      const stills = h('div', { class: 'sprite-stills' })
      if (data.chibi[outfit]) {
        for (const view of ['key', 'front', 'back', 'left', 'right']) {
          const W = BOARD + 20, H = BOARD + 18, footY = (480 / CELL) * BOARD + 6
          const [c, ctx] = canvas(W, H, 'sprite-tile')
          image(`/chibi/${outfit}/${view}.png`).then((img) => { nightTile(ctx, W, H, footY); ctx.drawImage(img, 10, footY - (240 / 256) * BOARD, BOARD, BOARD) }).catch(() => {})
          stills.append(h('figure', { class: 'sprite-still' }, c, h('figcaption', { text: view })))
        }
      }
      parts.push(h('section', { class: 'card' },
        h('h2', { text: title(outfit) }),
        h('p', { class: 'muted', text: `${back} of 14 sheets back.${data.chibi[outfit] ? ' Her approved chibi, as the board draws it today:' : ' Her approved chibi set isn’t on this machine.'}` }),
        stills,
        h('div', { class: 'sprite-sheets' }, list.map((s) => h('a', { class: `sprite-sheet${s.got ? '' : ' missing'}`, href: s.got ? `#/sprites/${outfit}/${s.sheet}${s.helmet ? '-helmet' : ''}` : null },
          h('b', { text: s.label }), s.got ? pill('ok', `take ${s.got.take}`) : pill('muted', 'not yet'))))))
    }
    box.replaceChildren(...parts)
  }).catch((error) => box.replaceChildren(h('div', { class: 'error-box', text: error.message })))
  return box
}

/** One sheet: findings, the loops on the night tile, the silhouettes, and every cell with its measures. */
export function sheetView(outfit, which) {
  const helmet = which.endsWith('-helmet'), sheet = helmet ? which.slice(0, -7) : which
  const box = h('div', { class: 'sprites' }, h('p', { class: 'loading', text: 'Cutting the sheet…' }))
  const spec = SHEETS[sheet]
  if (!spec) { box.replaceChildren(h('div', { class: 'error-box', text: `No sheet called ${which}` })); return box }
  getJson('/api/sprites').then(async (data) => {
    const got = data.sheets.find((s) => s.outfit === Number(outfit) && s.sheet === sheet && s.helmet === helmet)
    if (!got) throw new Error('That sheet isn’t back yet.')
    const img = await image(`/sheet/${outfit}/${got.file}?t=${Date.now()}`)
    const chibis = {}
    if (data.chibi[outfit]) for (const view of ['front', 'back', 'left', 'right', 'key']) chibis[view] = await image(`/chibi/${outfit}/${view}.png`).catch(() => null)
    const rects = spec.cells.map((_, i) => cellRect(sheet, i, img.naturalWidth, img.naturalHeight))
    const measures = rects.map((r) => { const { a, w, h: hh } = alphaOf(img, r); return measure(a, w, hh) })
    const findings = sheetFindings(sheet, measures)
    const size = img.naturalWidth === spec.w && img.naturalHeight === spec.h
    const at = (i) => (i === null ? 'Sheet' : `Cell ${i}${spec.cells[i] ? ` (${spec.cells[i].action} ${spec.cells[i].frame}, ${spec.cells[i].view})` : ''}`)
    box.replaceChildren(
      h('p', {}, h('a', { href: '#/sprites', text: '← Combat sprites' })),
      h('h1', { text: `${title(outfit)} · ${spec.label}${helmet ? ' · helmet' : ''}` }),
      h('p', { class: 'muted', text: `${got.file} · take ${got.take}${got.takes.length > 1 ? ` (takes ${got.takes.join(', ')})` : ''} · ${img.naturalWidth} × ${img.naturalHeight}${size ? '' : `, not the ${spec.w} × ${spec.h} asked for (cut evenly anyway)`}` }),
      h('section', { class: 'card' }, h('h2', { text: 'What the page measured' }),
        findings.length ? h('ul', { class: 'findings' }, findings.map((f) => h('li', { class: f.level }, h('b', { text: `${at(f.index)}: ` }), f.message)))
          : h('p', { class: 'ok', text: 'Every cell has its figure, the background is clear, the feet sit on the line and the standing heights agree.' }),
        h('p', { class: 'muted', text: 'Measured on the alpha channel; the face, the armor and the accessory sides are yours to judge against her chibi and her approved look.' })),
      h('section', { class: 'card' }, h('h2', { text: 'On the board' }),
        h('p', { class: 'muted', text: 'Each pose plays on a night tile at the size the phone draws it (about 69 pt tall), with a 3× view beside it.' }),
        h('div', { class: 'sprite-anims' }, animations(sheet).map((anim) => player(img, sheet, anim, chibis[anim.view] ?? null)))),
      h('section', { class: 'card' }, h('h2', { text: 'Silhouettes' }),
        h('p', { class: 'muted', text: 'Filled black at board size: each should still read as her in armor (LK8).' }),
        h('div', { class: 'sprite-sils' }, spec.cells.map((cell, i) => (cell ? silhouette(img, rects[i], BOARD) : null)))),
      h('section', { class: 'card' }, h('h2', { text: 'Every cell' }),
        h('div', { class: 'sprite-cells' }, spec.cells.map((cell, i) => {
          const [c, ctx] = canvas(192, 192, 'sprite-cell')
          drawCell(ctx, img, rects[i], 0, 0, 192)
          const m = measures[i]
          return h('figure', { class: 'sprite-still' }, c, h('figcaption', { text: cell ? `${i} · ${cell.action} ${cell.frame} · ${cell.view}${m.empty ? ' · empty' : ` · feet ${Math.round(m.bottom)} · ${Math.round(m.height)} px`}` : `${i} · empty` }))
        }))),
    )
  }).catch((error) => box.replaceChildren(h('p', {}, h('a', { href: '#/sprites', text: '← Combat sprites' })), h('div', { class: 'error-box', text: error.message })))
  return box
}
