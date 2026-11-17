// The Farm Story Sandbox's model, on invented records; and the repo's own drafts against the game's story as built,
// where this Node reads TypeScript (Node 22.18+, or --experimental-strip-types).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { gameRoot } from '../../workspace.mjs'
import { chooseConversation, crossCheck, parseBeats, parseChapter, parseConversations, seedOf } from './model.mjs'

const game = {
  ok: true,
  cast: [{ id: 'mayor', name: 'Mayor Ann Lee', from: 1 }, { id: 'smith', name: 'Bo Kent', from: 2 }, { id: 'cook', name: 'Cy Moss', from: 3 }],
  hello: { quick: '“I’m {name}!”', calm: '“{name}, at your service.”' },
  scenes: {},
  sceneFiles: {},
  places: [{ id: 'field', row: 1 }, { id: 'pen', row: 2 }, { id: 'gate', row: 7 }],
  temperaments: ['quick', 'calm'],
  callings: ['wood', 'fish'],
  activities: ['farming', 'ranch'],
}
const say = (id, line) => ({ speaker: { kind: 'cast', id }, line })
const narrate = (line) => ({ speaker: { kind: 'narrator' }, line })
const newest = (line = '“I’m {name}. May I stay?”') => ({ speaker: { kind: 'newest-hand' }, line })
const outline = ['One.', 'Two.', 'Three.']
const chapter = (change = {}, scenes = {}) => ({
  schemaVersion: 1, kind: 'farm-chapter', chapter: 2, title: 'A Title', layer: 'outline', opens: 'The pen', brings: ['smith'],
  goals: ['Goal one', 'Goal two', 'Goal three'], reward: '1,000g',
  scenes: [{ id: 'scene:2:open', title: 'Open', outline, ...scenes.open }, { id: 'scene:2:close', title: 'Close', outline, ...scenes.close }],
  ...change,
})

test('an outlined chapter passes, and a file that isn’t one throws', () => {
  const { chapter: c, issues } = parseChapter(chapter(), game)
  assert.deepEqual(issues, [])
  assert.deepEqual(c.scenes.map((s) => s.source), ['outline', 'outline'])
  assert.throws(() => parseChapter({ ...chapter(), kind: 'story-bundle' }, game), /farm-chapter/)
  assert.throws(() => parseChapter({ ...chapter(), chapter: 9 }, game), /1–8/)
})

test('the outline and goals are checked', () => {
  const { issues } = parseChapter(chapter({ goals: ['Only one'], brings: ['nobody'] }, { open: { outline: ['Too short'] } }), game)
  assert.ok(issues.some((i) => /Three to six goals/.test(i)))
  assert.ok(issues.some((i) => /nobody/.test(i)))
  assert.ok(issues.some((i) => /opening scene: an outline/.test(i)))
})

test('a scripted scene’s beats keep the game’s rules', () => {
  const beats = [
    narrate('Morning.'),
    say('smith', 'No quotes here.'),
    say('cook', '“Too early for me.”'),
    say('mayor', '“Hello, {name}.”'),
    { speaker: { kind: 'first-hand', index: 0 }, line: '“A line she won’t say.”' },
    { speaker: { kind: 'best', activity: 'sailing' }, line: '“Ahoy.”' },
    narrate('“Narration in quotes.”'),
    say('mayor', '“{nope}”'),
  ]
  const { issues } = parseChapter(chapter({ layer: 'scripted' }, { open: { beats }, close: { beats: [narrate('Night.'), newest()] } }), game)
  assert.ok(issues.some((i) => /beat 2: a spoken line is “quoted”/.test(i)))
  assert.ok(issues.some((i) => /beat 3: Cy Moss speaks in chapter 2, before chapter 3/.test(i)))
  assert.ok(issues.some((i) => /beat 4: \{name\} is an Uma’s name/.test(i)))
  assert.ok(issues.some((i) => /beat 5: a first hand says her temperament’s hello/.test(i)))
  assert.ok(issues.some((i) => /beat 6: best at what/.test(i)))
  assert.ok(issues.some((i) => /beat 7: narration isn’t quoted/.test(i)))
  assert.ok(issues.some((i) => /beat 8: unknown placeholder \{nope\}/.test(i)))
  assert.equal(issues.filter((i) => /closing scene/.test(i)).length, 0)
})

test('a scripted chapter needs beats, and its closing scene a recruit', () => {
  const { issues } = parseChapter(chapter({ layer: 'scripted' }, { close: { beats: [narrate('Night.'), say('smith', '“Good work.”')] } }), game)
  assert.ok(issues.some((i) => /opening scene: scripted, but no beats/.test(i)))
  assert.ok(issues.some((i) => /every chapter ends with a recruit/.test(i)))
})

test('the game’s scenes win, and a draft that differs from them is flagged', () => {
  const built = { 'scene:2:open': { id: 'scene:2:open', title: 'Built open', beats: [narrate('Built.')] }, 'scene:2:close': { id: 'scene:2:close', title: 'Built close', beats: [newest()] } }
  const withGame = { ...game, scenes: built, sceneFiles: { 'scene:2:open': 'story/chapter-2.ts', 'scene:2:close': 'story/chapter-2.ts' } }
  const draftOpen = { beats: [narrate('A draft.')] }
  const { chapter: c, issues } = parseChapter(chapter({ layer: 'built' }, { open: draftOpen }), withGame)
  assert.equal(c.scenes[0].title, 'Built open')
  assert.equal(c.scenes[0].beats[0].line, 'Built.')
  assert.deepEqual(issues, ['The opening scene: the draft’s beats differ from the game’s (story/chapter-2.ts)'])
  assert.ok(parseChapter(chapter(), withGame).issues.some((i) => /mark the chapter built/.test(i)))
  assert.ok(parseChapter(chapter({ layer: 'built' }), game).issues.some((i) => /doesn’t play both its scenes/.test(i)))
})

test('story beats: ids, hearts, lines and bubbles', () => {
  const items = parseBeats({ schemaVersion: 1, kind: 'farm-story-beats', beats: [
    { id: 'beat.quick.2', temperament: 'quick', hearts: 2, title: 'T', premise: 'P.' },
    { id: 'beat.calm.4', temperament: 'calm', hearts: 4, title: 'T', premise: 'P.', lines: [{ by: 'her', text: 'Hi.' }, { by: 'you', text: '“Hi.”' }, { by: 'her', text: 'Bye, {who}.' }] },
    { id: 'beat.calm.5', temperament: 'calm', hearts: 5, title: 'T', premise: 'P.' },
  ] }, game)
  assert.deepEqual(items.map((x) => x.beat.layer), ['outline', 'scripted', 'outline'])
  assert.deepEqual(items[0].issues, [])
  assert.ok(items[1].issues.some((i) => /Line 2: a bubble isn’t quoted/.test(i)))
  assert.ok(items[1].issues.some((i) => /Line 3: unknown placeholder \{who\}/.test(i)))
  assert.ok(items[2].issues.some((i) => /Hearts are 2, 4, 6, 8, 10/.test(i)))
})

const template = (id, place, hearts, a = {}, b = {}) => ({ id, place, hearts, a, b, lines: [{ by: 'a', text: 'One.' }, { by: 'b', text: 'Two.' }, { by: 'a', text: 'Three.' }] })

test('conversations: places, filters and lines', () => {
  const items = parseConversations({ schemaVersion: 1, kind: 'farm-conversations', templates: [
    template('conv.field.1.any.a', 'field', 1),
    template('conv.moon.1.x', 'moon', 1, { mood: 'calm' }, { temperament: 'sleepy' }),
    { ...template('conv.any.2.x', 'any', 2), lines: [{ by: 'a', text: 'Alone.' }] },
  ] }, game)
  assert.deepEqual(items[0].issues, [])
  assert.ok(items[1].issues.some((i) => /not moon/.test(i)))
  assert.ok(items[1].issues.some((i) => /not mood/.test(i)))
  assert.ok(items[1].issues.some((i) => /b.temperament is one of quick, calm/.test(i)))
  assert.ok(items[2].issues.some((i) => /Three to six lines/.test(i)))
  assert.ok(items[2].issues.some((i) => /Both a and b speak/.test(i)))
})

test('the conversations’ choosing rule: the place, then temperaments, then line and distance, either order, the same pair the same', () => {
  const quick = { id: 'u1', temperament: 'quick', calling: 'wood', distance: 'mile' }
  const calm = { id: 'u2', temperament: 'calm', calling: 'fish', distance: 'long' }
  const templates = [
    template('conv.any.1.any.a', 'any', 1),
    template('conv.field.1.any.a', 'field', 1),
    template('conv.any.1.calm-quick.a', 'any', 1, { temperament: 'calm' }, { temperament: 'quick' }),
    template('conv.field.1.calm-wood.a', 'field', 1, { temperament: 'calm' }, { line: 'wood' }),
    template('conv.field.1.quick-quick.a', 'field', 1, { temperament: 'quick' }, { temperament: 'quick' }),
    template('conv.field.2.any.a', 'field', 2),
  ]
  const ranked = chooseConversation(templates, [quick, calm], 'field', 1)
  assert.deepEqual(ranked.map((r) => [r.template.id, r.score]), [
    ['conv.field.1.calm-wood.a', 6], ['conv.any.1.calm-quick.a', 4], ['conv.field.1.any.a', 3], ['conv.any.1.any.a', 0],
  ])
  assert.equal(ranked[0].a.id, 'u2', 'the calm one speaks first: the pair is tried both ways')
  assert.deepEqual(chooseConversation(templates, [calm, quick], 'field', 1).map((r) => r.template.id), ranked.map((r) => r.template.id))
  const tie = [template('conv.any.1.any.a', 'any', 1), template('conv.any.1.any.b', 'any', 1)]
  const first = chooseConversation(tie, [quick, calm], 'pen', 1)[0].template.id
  assert.equal(chooseConversation(tie, [calm, quick], 'pen', 1)[0].template.id, first)
  assert.equal(seedOf('abc'), seedOf('abc'))
})

test('across the files: every chapter once, and the coverage; the town\'s people are named at run time, never checked by name', () => {
  const one = parseChapter({ ...chapter({ chapter: 1, layer: 'scripted', brings: ['mayor'] }), scenes: [
    { id: 'scene:1:open', title: 'O', outline, beats: [say('mayor', '“Welcome.”')] },
    { id: 'scene:1:close', title: 'C', outline, beats: [newest(), say('mayor', '“Someone will come.”')] },
  ] }, game).chapter
  const two = parseChapter(chapter(), game).chapter
  const cross = crossCheck([one, two], [{ temperament: 'quick', hearts: 2, layer: 'outline' }, { temperament: 'quick', hearts: 2, layer: 'scripted' }],
    [template('conv.any.1.any.a', 'any', 1), template('conv.field.1.x', 'field', 1), template('conv.field.1.x', 'field', 1), template('conv.gate.1.x2', 'gate', 1)], game)
  assert.ok(cross.issues.includes('No draft for chapter 3'))
  assert.ok(!cross.issues.some((i) => /doesn’t name/.test(i)))
  assert.ok(cross.issues.includes('Two story beats for quick at 2 hearts'))
  assert.ok(cross.issues.includes('Two conversations with the id conv.field.1.x'))
  const [h1] = cross.conversations
  assert.deepEqual({ any: h1.any, places: h1.places, other: h1.other, catchAll: h1.catchAll, counted: h1.counted, target: h1.target },
    { any: 1, places: { field: 2, pen: 0 }, other: 1, catchAll: true, counted: 3, target: 24 })
})

const repo = gameRoot('farm')
const skipGameTest = !process.features?.typescript ? 'this Node reads no TypeScript' : !existsSync(join(repo, 'packages/domain/src')) && 'Farm checkout is unavailable'
test('the repo’s drafts pass their checks against the game’s story as built', { skip: skipGameTest }, async () => {
  const { loadGame } = await import('./game.mjs')
  const built = await loadGame(join(repo, 'packages/domain/src'))
  assert.equal(built.error, undefined)
  assert.deepEqual(built.scenes, {}, 'no chapter scene: the opening is the pack\'s opening.json')
  const folder = join(repo, 'docs/story')
  const read = async (path) => JSON.parse(await readFile(path, 'utf8'))
  const chapters = []
  for (const name of (await readdir(join(folder, 'chapters'))).filter((n) => n.endsWith('.json'))) {
    const { chapter: c, issues } = parseChapter(await read(join(folder, 'chapters', name)), built)
    assert.deepEqual(issues, [], name)
    chapters.push(c)
  }
  const beats = parseBeats(await read(join(folder, 'beats.json')), built)
  for (const b of beats) assert.deepEqual(b.issues, [], b.beat.id)
  const conversations = parseConversations(await read(join(folder, 'conversations.json')), built)
  for (const c of conversations) assert.deepEqual(c.issues, [], c.template.id)
  assert.deepEqual(crossCheck(chapters, beats.map((b) => b.beat), conversations.map((c) => c.template), built).issues, [])
})
