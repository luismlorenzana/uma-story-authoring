// The Sprites page's model: sheet names, layouts, timing and the cell measures (invented data only).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { animations, cellRect, expectedSheets, latestSheets, measure, parseSheetName, sheetFindings, SHEETS, SHEET_ORDER, TIMES } from './sprites.mjs'

test('sheet names read the request’s pattern and nothing else', () => {
  assert.deepEqual(parseSheetName('9000001-combat-walk-fb-helmet-v3.png'), { outfit: 9000001, sheet: 'walk-fb', helmet: true, take: 3, file: '9000001-combat-walk-fb-helmet-v3.png' })
  assert.deepEqual(parseSheetName('9000001-combat-identity-v1.png')?.helmet, false)
  for (const bad of ['9000001-combat-identity.png', '9000001-combat-run-v1.png', 'x-combat-front-v1.png', '../9000001-combat-front-v1.png', '9000001-combat-front-v1.png.txt']) assert.equal(parseSheetName(bad), null, bad)
})

test('the latest take of each sheet wins, sorted by Uma, helmet last, request order', () => {
  const got = latestSheets(['9000002-combat-identity-v1.png', '9000001-combat-front-v1.png', '9000001-combat-identity-v2.png', '9000001-combat-identity-v1.png', '9000001-combat-identity-helmet-v1.png', 'notes.txt'])
  assert.deepEqual(got.map((s) => [s.outfit, s.sheet, s.helmet, s.take]), [[9000001, 'identity', false, 2], [9000001, 'front', false, 1], [9000001, 'identity', true, 1], [9000002, 'identity', false, 1]])
  assert.deepEqual(got[0].takes, [1, 2])
})

test('every sheet’s cells fill its grid, and the frame counts are the request’s 73', () => {
  let frames = 0
  for (const id of SHEET_ORDER) {
    const s = SHEETS[id]
    assert.equal(s.cells.length, s.cols * s.rows, id)
    assert.equal(s.w / s.cols, 512, id)
    assert.equal(s.h / s.rows, 512, id)
    frames += s.cells.filter(Boolean).length
  }
  assert.equal(frames, 73)
})

test('animations group each action and view with its times', () => {
  const walk = animations('walk-lr')
  assert.deepEqual(walk.map((a) => [a.action, a.view, a.cells.length]), [['walk', 'left', 6], ['walk', 'right', 6]])
  assert.deepEqual(walk[0].ms, TIMES.walk)
  const front = animations('front')
  assert.deepEqual(front.map((a) => a.action), ['act', 'hurt', 'guard', 'kneel', 'victory'])
  assert.deepEqual(front.at(-1).cells, [10, 11, 12, 13])
})

test('cell rectangles divide the image as it came back', () => {
  assert.deepEqual(cellRect('identity', 4, 1536, 1024), { x: 512, y: 512, w: 512, h: 512 })
  assert.deepEqual(cellRect('identity', 4, 768, 512), { x: 256, y: 256, w: 256, h: 256 })
})

/** An invented cell: a w × h alpha channel with an opaque box. */
function cell(w, h, box) {
  const a = new Uint8Array(w * h)
  if (box) for (let y = box.top; y < box.bottom; y++) for (let x = box.left; x < box.right; x++) a[y * w + x] = 255
  return a
}

test('measure reads the figure’s box at the 512 cell’s scale', () => {
  const m = measure(cell(256, 256, { top: 32, bottom: 240, left: 100, right: 156 }), 256, 256)
  assert.equal(m.empty, false)
  assert.equal(m.height, 416)
  assert.equal(m.bottom, 480)
  assert.equal(m.centre, 256)
  assert.equal(m.touching, 0)
  assert.equal(measure(cell(64, 64), 64, 64).empty, true)
  assert.ok(measure(cell(64, 64, { top: 0, bottom: 64, left: 0, right: 64 }), 64, 64).coverage > 0.99)
})

test('findings flag missing figures, filled backgrounds, off-line feet and mixed scales', () => {
  const good = measure(cell(128, 128, { top: 16, bottom: 120, left: 50, right: 78 }), 128, 128)
  const short = measure(cell(128, 128, { top: 30, bottom: 120, left: 50, right: 78 }), 128, 128)
  const empty = measure(cell(128, 128), 128, 128)
  const filled = measure(cell(128, 128, { top: 0, bottom: 128, left: 0, right: 128 }), 128, 128)
  assert.deepEqual(sheetFindings('identity', [good, good, good, good, good, empty]), [])
  const bad = sheetFindings('identity', [good, empty, filled, short, good, good])
  assert.ok(bad.some((f) => f.index === 1 && f.level === 'error'))
  assert.ok(bad.some((f) => f.index === 2 && /transparent/.test(f.message)))
  assert.ok(bad.some((f) => f.index === 5 && /empty/.test(f.message)))
  assert.ok(bad.some((f) => f.index === null && /4%/.test(f.message)))
})

test('each Uma expects fourteen sheets', () => {
  const list = expectedSheets(9000001, latestSheets(['9000001-combat-identity-v1.png']))
  assert.equal(list.length, 14)
  assert.equal(list[0].got?.take, 1)
  assert.equal(list[7].helmet, true)
  assert.equal(list.filter((s) => s.got).length, 1)
})
