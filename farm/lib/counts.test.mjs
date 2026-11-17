// The story's counts, on invented records only: no real names.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storyCounts } from './counts.mjs'

const cast = { umas: [
  { characterId: 'u1', calling: 'farming', arrives: { kind: 'festival', festival: 'flower-show' } },
  { characterId: 'u2', calling: 'farming', arrives: { kind: 'beds', dormLevel: 4 } },
  { characterId: 'u3', calling: 'fishing', arrives: { kind: 'festival', festival: 'fishing-derby' } },
] }
const tag = (characterId, favouriteLine, season, festival, loved) => ({ characterId, favouriteLine, season, festival, loved })
const tags = { tags: [tag('u1', 'farming', 'spring', 'flower-show', 'apple'), tag('u2', 'cooking', 'spring', 'cooking-contest', 'apple')] }
const ties = { ties: [
  { a: 'u1', b: 'u2', strength: 3, source: 'real' }, { a: 'u1', b: 'u3', strength: 2, source: 'story' }, { a: 'u2', b: 'u3', strength: 1 },
] }
const rungs = ['arrival', 'f1', 'f2']

test('counts by calling, arrival and tag, each with its Umas, the biggest first', () => {
  const c = storyCounts({ cast, tags, ties, rungs })
  assert.equal(c.umas, 3)
  assert.deepEqual(c.byCalling, { farming: ['u1', 'u2'], fishing: ['u3'] })
  assert.deepEqual(c.arrivals, { festival: ['u1', 'u3'], beds: ['u2'] })
  assert.equal(c.tagged, 2)
  assert.deepEqual(c.bySeason, { spring: ['u1', 'u2'] })
  assert.deepEqual(c.byLoved, { apple: ['u1', 'u2'] })
  assert.deepEqual(c.byLine, { cooking: ['u2'], farming: ['u1'] })
})

test('ties an Uma, the least tied first, and the sources', () => {
  const c = storyCounts({ cast, tags, ties, rungs })
  assert.deepEqual(c.ties, { total: 3, real: 1, story: 1, unsourced: 1 })
  assert.deepEqual(c.tiesPer.map((t) => [t.id, t.ties, t.strong]), [['u3', 2, 0], ['u1', 2, 1], ['u2', 2, 1]])
})

test('once bibles and routes exist: gifts, pair conversations and events scripted of the route', () => {
  const bibles = [{ characterId: 'u1', gifts: { liked: ['pear', 'plum', 'fig'], disliked: ['slate', 'basalt'] } }, { characterId: 'u2', gifts: { liked: ['pear', 'kiwi', 'lime'], disliked: ['slate', 'tin-ore'] } }]
  const routes = [{ characterId: 'u1', events: [{ id: 'arrival' }, { id: 'f1' }, { id: 'f9' }] }]
  const pairs = [{ a: 'u1', b: 'u2', levels: [] }]
  const c = storyCounts({ cast, tags, ties, bibles, routes, pairs, rungs })
  assert.equal(c.bibles, 2)
  assert.deepEqual(c.liked.pear, ['u1', 'u2'])
  assert.deepEqual(c.disliked.slate, ['u1', 'u2'])
  assert.deepEqual(c.eventsPer, [{ id: 'u1', bible: true, scripted: 2, of: 3 }, { id: 'u2', bible: true, scripted: 0, of: 3 }, { id: 'u3', bible: false, scripted: 0, of: 3 }])
  assert.deepEqual(c.pairsPer.map((p) => [p.id, p.written, p.of]), [['u1', 1, 2], ['u2', 1, 2], ['u3', 0, 2]])
})

test('counts an open cast: a character with only her id is in the cast, and in no group', () => {
  const c = storyCounts({ cast: { umas: [...cast.umas, { characterId: 'u4' }] }, rungs })
  assert.equal(c.umas, 4)
  assert.deepEqual(c.byCalling, { farming: ['u1', 'u2'], fishing: ['u3'] })
  assert.deepEqual(c.arrivals, { festival: ['u1', 'u3'], beds: ['u2'] })
  assert.deepEqual(c.eventsPer.find((e) => e.id === 'u4'), { id: 'u4', bible: false, scripted: 0, of: 3 })
})
