// The "In the game" read, against an invented game checkout: its parsers, its exported pack and its export helpers
// are stand-ins written here, so the test needs no uma-quest checkout and holds no story.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { playable, questGame } from './game.mjs'

const looseSteps = (steps) => ({
  steps: steps.filter((s) => s.t === 'line' || s.t === 'narrate').map((s) => ({ kind: s.t, text: s.text })),
  issues: steps.filter((s) => s.t !== 'line' && s.t !== 'narrate').map((s) => (s.text ? `${s.t} plays as narration until the game builds it` : `${s.t} is skipped`)),
})

async function fakeGame() {
  const root = await mkdtemp(join(tmpdir(), 'quest-game-'))
  const write = async (path, text) => { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), text) }
  await write('packages/domain/src/story/script.ts', `export const LINE_MAX = 160\nexport ${looseSteps.toString().replace(/^\(steps\) =>/, 'function looseSteps(steps) { return')} }\n`)
  await write('packages/domain/src/story/pack.ts', [
    'export function parseStoryIndex(v) { if (v.schema !== 1) throw new Error("not an index"); return v }',
    'export function parseCast(v) { return { cast: v, issues: [] } }',
    'export function parseOpening(v) { return { opening: { scenes: v.scenes }, issues: ["title plays as narration until the game builds it"] } }',
    'export function parseWorldNames(v) { return { world: { places: v.places }, issues: [] } }',
  ].join('\n'))
  await write('tools/story-delivery/lib/game-pack.mjs', [
    'export function chaptersFromBundles(bundles) { return { issues: [], chapters: bundles.filter((b) => b.scripted).map((b) => ({ id: `${b.hero}-1`, lead: 1, order: 1, scenes: b.scenes })) } }',
    'export function chapterProblems() { return [] }',
  ].join('\n'))
  await write('content/story/index.json', JSON.stringify({ schema: 1, builtAt: '2026-01-01T00:00:00Z', cast: { path: 'story/cast.x.json' }, opening: { path: 'story/opening.x.json' }, world: { path: 'story/world.x.json' },
    chapters: { 'h-1': { path: 'story/chapters/h-1.x.json' } } }))
  await write('content/story/cast.x.json', JSON.stringify([{ outfitId: 1, way: 'mage', intro: 'Hi.' }, { outfitId: 2, way: 'mage' }]))
  await write('content/story/opening.x.json', JSON.stringify({ scenes: [{ id: 'o', steps: [{ kind: 'narrate', text: 'Once.' }] }] }))
  await write('content/story/world.x.json', JSON.stringify({ places: { hub: { name: 'A city' } } }))
  await write('content/story/chapters/h-1.x.json', JSON.stringify({ lead: 1, order: 1, title: 'One', scenes: [{ id: 'a', steps: [{ t: 'line', text: 'Hi' }, { t: 'boss', text: 'Her' }, { t: 'walk' }] }] }))
  return root
}

test('a missing checkout never throws: each part says why it is empty', async () => {
  const r = await questGame(join(tmpdir(), 'no-such-quest-checkout'))
  assert.equal(r.parsers.ok, false)
  assert.equal(r.pack.ok, false)
  assert.equal(r.export.ok, false)
})

test('the exported pack is read by the game\'s parsers, and the scripted chapters by its export helpers', async () => {
  const root = await fakeGame()
  try {
    const r = await questGame(root, { bundles: [{ hero: 'h', scripted: true, scenes: [{ id: 'z', steps: [{ t: 'narrate', text: 'x' }, { t: 'letter', text: 'y' }] }] }, { hero: 'g' }] })
    assert.deepEqual(r.parsers, { ok: true, lineMax: 160 })
    assert.equal(r.pack.ok, true)
    assert.deepEqual(r.pack.cast, { count: 2, ways: { mage: 2 }, intros: 1, recruits: 0 })
    assert.equal(r.pack.world.places, 1)
    assert.deepEqual(r.pack.chapters.map((c) => [c.id, c.scenes[0].played, c.scenes[0].narrated, c.scenes[0].skipped]), [['h-1', 1, 1, 1]])
    assert.deepEqual(r.pack.problems.map((p) => p.where), ['story/opening.x.json'])
    assert.deepEqual(r.export.chapters.map((c) => [c.id, c.scenes[0].played, c.scenes[0].narrated]), [['h-1', 1, 1]])
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('playable counts what the game plays, narrates and skips', () => {
  assert.deepEqual(playable(looseSteps, [{ t: 'line', text: 'a' }, { t: 'line', text: 'b' }, { t: 'title', text: 'c' }], 'x'),
    { played: 2, kinds: { line: 2 }, narrated: 1, skipped: 0, issues: ['title plays as narration until the game builds it'] })
})
