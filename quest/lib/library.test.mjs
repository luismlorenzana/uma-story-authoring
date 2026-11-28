// The Quest library's index, on invented records only: no real names, no story text.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildSearch, chapterKey, chaptersOf, chapterState, deskRows, findContent, libraryRows, parseInline, parseKey, parseMarkdown, placeOf,
  snippet, speakersOf, tiersOf, titleOfMarkdown, verdictCounts,
} from './library.mjs'

const ids = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`)
const pack = {
  batches: [{ batch: 1, tier: 'T1', heroes: ids('a', 10) }, { batch: 2, tier: 'T2', heroes: ids('b', 7) }],
  characters: [...ids('a', 10), ...ids('b', 7)].map((id) => ({ id, role: 'hero', name: `Hero ${id}`, tier: id[0] === 'a' ? 'T1' : 'T2' })),
}
const scene = (id, chapter, change = {}) => ({ id, chapter, title: `Scene ${id}`, place: 'warrior-1', cast: ['a1', 'x-elder'], steps: [
  { t: 'title', text: 'A card', sub: 'A place' },
  { t: 'line', speaker: 'a1', text: 'One two three.' },
  { t: 'choice', prompt: 'Pick', options: [{ text: 'Left', reply: { speaker: 'x-elder', text: 'Fine then.' } }, { text: 'Right' }] },
], ...change })
const bundle = {
  hero: 'a1', status: 'bible', shape: 'tourney', title: 'An invented road', logline: 'A lantern goes out.',
  chapters: [{ n: 1, title: 'First', summary: 'It starts.', beats: ['One.'], scripted: true }, { n: 2, title: 'Second' }, { n: 3 }, { n: 4 }, { n: 5 }],
  scenes: [scene('s1', 1), scene('s2', 1, { place: undefined }), scene('s3', 2), scene('loose', undefined)],
}
const data = {
  pack, bundles: [{ bundle, issues: ['an invented check'] }, { bundle: { hero: 'a2', status: 'placeholder', chapters: [], scenes: [] }, issues: [] }],
  reviews: { items: { a1: { status: 'liked', note: 'Good.' }, [chapterKey('a1', 1)]: { status: 'rework', note: 'Shorter.' } } },
  world: { towns: [{ id: 'warrior-1', epithet: 'The lantern town', dungeons: { a: { name: 'The Lantern Wood', blurb: 'Trees.' } } }], circuit: [{ id: 'cup', name: 'The Invented Cup', month: 3, blurb: 'A race.' }] },
  setting: { cities: [{ id: 'warrior-1', name: 'Lanternford' }] },
  bibles: [{ name: 'voices', text: '# Voices\n\nHow the lantern keepers talk.' }],
}

test('tiers come in waves of five, in the board order', () => {
  const tiers = tiersOf(pack)
  assert.deepEqual(tiers.map((t) => t.waves.map((w) => [w.wave, w.heroes.length])), [[[1, 5], [2, 5]], [[3, 5], [4, 2]]])
  assert.deepEqual(placeOf(pack, 'a7'), { tier: 'T1', batch: 1, wave: 2, place: 7 })
  assert.deepEqual(placeOf(pack, 'b6'), { tier: 'T2', batch: 2, wave: 4, place: 6 })
  assert.equal(placeOf(pack, 'nobody'), null)
})

test('a story\'s chapters carry their scenes, words and what the game still needs', () => {
  const chapters = chaptersOf(bundle)
  assert.equal(chapters.length, 6)
  assert.deepEqual(chapters.map((c) => [c.n, c.scenes.length, chapterState(c)]), [[1, 2, 'scripted-unplaced'], [2, 1, 'written'], [3, 0, 'empty'], [4, 0, 'empty'], [5, 0, 'empty'], [null, 1, 'written']])
  assert.equal(chapters[0].unplaced, 1)
  assert.equal(chapters[0].words, 2 * 12)
  assert.deepEqual(speakersOf(bundle.scenes[0]), ['a1', 'x-elder'])
})

test('the library and the review desk follow the Ranker, with verdicts by story and by chapter', () => {
  const rows = libraryRows(data)
  assert.equal(rows.length, 17)
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.hero, r.wave, r.status, r.scenes]), [['a1', 1, 'bible', 4], ['a2', 1, 'placeholder', 0]])
  const desk = deskRows(data)
  assert.deepEqual(desk.map((r) => [r.key, r.verdict]), [['a1', 'liked'], ['a1.c1', 'rework'], ['a1.c2', 'unreviewed']])
  assert.deepEqual(verdictCounts(desk), { liked: 1, rework: 1, question: 0, unreviewed: 1 })
  assert.deepEqual(parseKey('s100301.c4'), { hero: 's100301', chapter: 4 })
  assert.deepEqual(parseKey('a1'), { hero: 'a1', chapter: null })
})

test('search finds stories, chapters, lines, places, tourneys and bibles, titles first', () => {
  const index = buildSearch(data, (id) => (id === 'x-elder' ? 'The Elder' : id))
  assert.deepEqual(findContent(index, 'lantern').map((r) => r.kind).sort(), ['bible', 'place', 'place', 'story'])
  assert.equal(findContent(index, 'fine then', 'scene').length, 4)
  assert.equal(findContent(index, 'elder', 'scene').length, 4)
  assert.equal(findContent(index, 'invented cup')[0].kind, 'tourney')
  assert.deepEqual(findContent(index, '   '), [])
  assert.equal(snippet('a long line where the word lantern sits', 'lantern', 6), '…word lantern sits')
})

test('Markdown becomes plain blocks, and only local links stay links', () => {
  const blocks = parseMarkdown('# Title\n\nA **bold** start\nthat wraps.\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> quoted\n\n```\ncode <b>\n```\n\n---')
  assert.deepEqual(blocks.map((b) => b.type), ['h', 'p', 'list', 'table', 'quote', 'code', 'hr'])
  assert.equal(blocks[1].text, 'A **bold** start that wraps.')
  assert.deepEqual(blocks[3], { type: 'table', head: ['A', 'B'], rows: [['1', '2']] })
  assert.equal(blocks[5].text, 'code <b>')
  assert.deepEqual(parseInline('see [here](#/world) and [there](https://example.com) with `x`'), [
    { type: 'text', text: 'see ' }, { type: 'link', text: 'here', href: '#/world' }, { type: 'text', text: ' and ' }, { type: 'text', text: 'there' },
    { type: 'text', text: ' with ' }, { type: 'code', text: 'x' }])
  assert.equal(titleOfMarkdown('intro\n## The Title\n'), 'The Title')
})
