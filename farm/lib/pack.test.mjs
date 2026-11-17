// The cast pack, on invented records only: no real names.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packUmas, parseCastPack } from './pack.mjs'

const pack = {
  schemaVersion: 1, kind: 'story-pack', id: 'ss-2026-01-02', franchises: [{ id: 'umas' }, { id: 'sea' }],
  characters: [
    { id: 'h1', name: 'Hero One', role: 'hero', images: { face: 'images/h1-face.png' }, sources: { pageUrl: 'x' }, profile: { summary: 'x' } },
    { id: 'b1', name: 'Boss One', role: 'boss', images: {} },
  ],
}

test('a cast pack: its kind, its id and safe image paths', () => {
  assert.equal(parseCastPack(pack), pack)
  assert.throws(() => parseCastPack({ ...pack, kind: 'tier-export' }), /story-pack/)
  assert.throws(() => parseCastPack({ ...pack, id: '../x' }), /pack id/)
  assert.throws(() => parseCastPack({ ...pack, characters: [{ id: 'h1', name: 'H', images: { face: '../secret.png' } }] }), /image path/)
})

test('only the Umas, with the served image paths and no sources', () => {
  assert.deepEqual(packUmas(pack), [{ id: 'h1', name: 'Hero One', role: 'hero', images: { face: '/img/ss-2026-01-02/h1-face.png' } }])
})
