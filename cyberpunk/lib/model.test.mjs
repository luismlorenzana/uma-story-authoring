// The Cyberpunk Story Sandbox's own model, on invented records only (Umas 9000001–9000004, heroine `stand-in-1`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  castIndex, countWords, deliverables, enemyWords, hexOrNull, PACK_KIND, packImages, parseCastPack, parseFoeFile, parseReviews, parseTies, parseVerdict, slotLine, storyIndex, walk, withVerdict,
} from './model.mjs'

test('a ties file pairs an Uma’s outfit id with a boss’s board id, of a known kind and a heat of 1 to 3', () => {
  const ties = { schemaVersion: 1, kind: 'uma-foe-ties', kinds: [{ id: 'rival' }], ties: [{ uma: 9000001, foe: 'stand-in-1', kind: 'rival', heat: 2 }] }
  assert.equal(parseTies(ties), ties)
  assert.throws(() => parseTies({ ...ties, kind: 'other' }), /Not a ties file/)
  assert.throws(() => parseTies({ ...ties, ties: [{ uma: '9000001', foe: 'stand-in-1', kind: 'rival', heat: 2 }] }), /needs an Uma/)
  assert.throws(() => parseTies({ ...ties, ties: [{ uma: 9000001, foe: 'stand-in-1', kind: 'feud', heat: 2 }] }), /known kind/)
  assert.throws(() => parseTies({ ...ties, ties: [{ uma: 9000001, foe: 'stand-in-1', kind: 'rival', heat: 4 }] }), /heat of 1 to 3/)
})

test('a foe file is the Standard or a faction, with board ids and ranks; colours are six-digit hexes only', () => {
  const faction = { schemaVersion: 1, kind: 'foe-faction', id: 'f1', title: 'Faction One', palette: { base: ['Base', '#112233'] }, variants: [], units: [{ id: 'stand-in-1', rank: 'boss' }] }
  assert.equal(parseFoeFile(faction), faction)
  assert.equal(parseFoeFile({ schemaVersion: 1, kind: 'foe-standard' }).kind, 'foe-standard')
  assert.throws(() => parseFoeFile({ schemaVersion: 1, kind: 'other' }), /Not a foe file/)
  assert.throws(() => parseFoeFile({ ...faction, id: 'Bad Id' }), /needs an id/)
  assert.throws(() => parseFoeFile({ ...faction, units: [{ id: 'stand-in-1', rank: 'captain' }] }), /board id and a rank/)
  assert.throws(() => parseFoeFile({ ...faction, units: [{ id: '../x', rank: 'boss' }] }), /board id and a rank/)
  assert.equal(hexOrNull('#A1b2C3'), '#A1b2C3')
  assert.equal(hexOrNull('red;background:url(x)'), null)
  assert.equal(hexOrNull('#FFF'), null)
})

const pack = () => ({
  casting: {
    schemaVersion: 1, leads: [{ outfit: 9000001, world: 'w1' }, { outfit: 9000002, world: 'w2' }], crewOrder: [9000001, 9000002, 9000003],
    heroines: [{ board: 'stand-in-1', faction: 'f1', hold: 'collar' }], minor: ['w1-guard'], labels: { 9000001: 'Lead A' },
  },
  worlds: { w1: { schemaVersion: 1, id: 'w1', locations: [], factions: [] }, w2: { schemaVersion: 1, id: 'w2', locations: [], factions: [] } },
  chapters: {
    'w1-ch1': {
      schemaVersion: 1, id: 'w1-ch1', world: 'w1', leads: [9000001], number: 1, danger: 1, needs: [],
      scenes: [{ id: 'w1-s1', place: 'w1-dock', trigger: { arrive: 'w1-dock' }, cast: [], steps: [
        { kind: 'narrate', text: 'One two three' },
        { kind: 'choice', options: [{ text: 'Ask', lead: 'w1-lead-a', then: [{ kind: 'file', file: 'w1-file', line: 0 }, { kind: 'line', speaker: 'w1-guard', text: 'Four five' }] }, { text: 'Leave', then: [] }] },
        { kind: 'anomaly', anomaly: 'w1-odd', open: true },
        { kind: 'flag', flag: 'w1-met', set: true },
        { kind: 'join', outfit: 9000003 },
        { kind: 'aboard', outfit: 9000001 },
      ] }],
      missions: [{ id: 'w1-m1', place: 'w1-dock', objective: { kind: 'defeat-all' }, brief: '', enemies: [], fixedSquad: null, side: [{ kind: 'hack', gives: 'w1-lead-b' }] }],
      debrief: { steps: [{ kind: 'slot', lines: { 9000002: 'Six seven' }, fallback: 'Eight' }] },
    },
  },
  files: { 'w1-file': { schemaVersion: 1, id: 'w1-file', lines: [{ text: 'x', redacted: true }] } },
  calls: {},
})

test('a verdict is checked, set, sorted and removed when empty', () => {
  assert.deepEqual(parseVerdict({ item: 'chapters/w1-ch1.json#w1-s1', status: 'rework', note: 'Too long' }), { item: 'chapters/w1-ch1.json#w1-s1', status: 'rework', note: 'Too long' })
  for (const bad of [null, {}, { item: '../x', status: 'liked', note: '' }, { item: 'a', status: 'loved', note: '' }, { item: 'a', status: 'liked' }, { item: 'a', status: null, note: 'x'.repeat(4001) }])
    assert.throws(() => parseVerdict(bad), (e) => e.status === 400)
  let reviews = parseReviews(null)
  reviews = withVerdict(reviews, { item: 'worlds/w1.json', status: 'liked', note: '' }, 't1')
  reviews = withVerdict(reviews, { item: 'casting.json', status: null, note: 'Why her?' }, 't2')
  assert.deepEqual(Object.keys(reviews.items), ['casting.json', 'worlds/w1.json'])
  assert.deepEqual(withVerdict(reviews, { item: 'casting.json', status: null, note: ' ' }, 't3').items, { 'worlds/w1.json': { status: 'liked', note: '', updatedAt: 't1' } })
  assert.throws(() => parseReviews({ schemaVersion: 1 }))
})

test('the cast pack is checked, and gives names and faces by id with the casting’s labels as a fallback', () => {
  const raw = { schemaVersion: 1, kind: PACK_KIND, id: 'ranker-2026-11-13',
    umas: [{ outfit: 900000201, name: 'Runner Two', images: { face: 'images/9000002-face.png' } }], heroines: [{ id: 'stand-in-1', name: 'Foe One', images: {} }] }
  const cast = parseCastPack(raw)
  assert.deepEqual([...packImages(cast)], ['images/9000002-face.png'])
  for (const bad of [{ ...raw, kind: 'story-pack' }, { ...raw, umas: [{ outfit: 'x', name: 'n' }] }, { ...raw, heroines: [{ id: '../x', name: 'n' }] }, { ...raw, umas: [{ outfit: 1, name: 'n', images: { face: '../secret.png' } }] }])
    assert.throws(() => parseCastPack(bad))
  const { who } = castIndex(cast, pack().casting)
  assert.deepEqual([who(900000201).name, who(900000201).kind, who(900000201).face], ['Runner Two', 'uma', 'images/9000002-face.png'])
  assert.deepEqual([who('stand-in-1').name, who('stand-in-1').kind], ['Foe One', 'heroine'])
  assert.deepEqual([who(9000001).name, who(9000001).known], ['Lead A', true])
  assert.deepEqual([who('w1-guard').kind, who('w1-guard').name], ['minor', 'w1-guard'])
  assert.deepEqual([who(9000009).name, who(9000009).known, who(9000009).initials], ['9000009', false, '9'])
  assert.equal(castIndex(null, null).who('x').name, 'x')
})

test('words, steps and the interjection slot’s pick', () => {
  const steps = pack().chapters['w1-ch1'].scenes[0].steps
  assert.deepEqual([...walk(steps)].map((s) => s.path), ['steps[0]', 'steps[1]', 'steps[1].choice[0].then[0]', 'steps[1].choice[0].then[1]', 'steps[2]', 'steps[3]', 'steps[4]', 'steps[5]'])
  assert.equal(countWords(steps), 3 + 2 + 2)
  const slot = { kind: 'slot', lines: { 9000002: 'From B', 9000003: 'From C' }, fallback: 'Nobody' }
  assert.deepEqual(slotLine(slot, [9000001, 9000003, 9000002], [9000001, 9000002, 9000003]), { speaker: '9000002', text: 'From B' })
  assert.deepEqual(slotLine(slot, [9000003], [9000001, 9000002, 9000003]), { speaker: '9000003', text: 'From C' })
  assert.deepEqual(slotLine(slot, [9000001], [9000001, 9000002]), { speaker: null, text: 'Nobody' })
  assert.equal(enemyWords({ slot: 'boss', pool: ['a', 'b'] }, (id) => id.toUpperCase()), 'Boss: A or B')
  assert.equal(enemyWords({ slot: 'regular', job: 'gunner', count: 3, faction: 'f1' }, String), '3 × gunner (f1)')
})

test('the story index says where every Lead, File line, Anomaly, flag, join and pickup is', () => {
  const ix = storyIndex(pack())
  assert.deepEqual(ix.leads['w1-lead-a'], [{ chapter: 'w1-ch1', scene: 'w1-s1', how: 'choice' }])
  assert.deepEqual(ix.leads['w1-lead-b'], [{ chapter: 'w1-ch1', scene: null, mission: 'w1-m1', how: 'side' }])
  assert.deepEqual(ix.fileLines['w1-file'], { 0: [{ chapter: 'w1-ch1', scene: 'w1-s1' }] })
  assert.deepEqual(ix.anomalies['w1-odd'], { opened: [{ chapter: 'w1-ch1', scene: 'w1-s1' }], closed: [] })
  assert.deepEqual(ix.flags['w1-met'], [{ chapter: 'w1-ch1', scene: 'w1-s1', set: true }])
  assert.deepEqual([ix.joins['9000003'].scene, ix.aboard['9000001'].scene], ['w1-s1', 'w1-s1'])
  assert.equal(ix.kinds.slot, 1)
  assert.deepEqual(ix.totals, { worlds: 2, leads: 2, chapters: 1, scenes: 1, missions: 1, files: 1, calls: 0, words: 7 + 3 })
  assert.deepEqual(storyIndex(null).totals.chapters, 0)
})

test('the deliverables are read off the files, and the stand-in delivers nothing', () => {
  const p = pack()
  const state = (layers, standIn) => deliverables(p, layers, standIn).map((d) => d.state)
  assert.deepEqual(state({}, true), ['manual', 'todo', 'todo', 'todo', 'todo'])
  assert.deepEqual(state({ 'chapter:w1-ch1': 'skeleton' }, false), ['manual', 'done', 'started', 'started', 'todo'])
  assert.deepEqual(state({ 'chapter:w1-ch1': 'scripted' }, false), ['manual', 'done', 'done', 'started', 'todo'])
})
