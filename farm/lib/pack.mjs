// The cast pack: the Studio's tier export as uma-quest's import makes it, with each character's face and art.
// The sandbox uses it only to show the Umas' pictures beside the private story files; the cast is
// `content/story/cast.json`.
// Names, images and profiles are private content in the ignored content/story/pack/; this code holds none of them.

const object = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const IMAGE = /^images\/[A-Za-z0-9._-]+\.(png|webp|jpg)$/

/** A cast pack (uma-quest's `story-pack`): its boards and characters, each image a file in its images/ folder. */
export function parseCastPack(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-pack' || !Array.isArray(value.characters) || !Array.isArray(value.franchises)) {
    throw new Error('Not a cast pack (kind story-pack, schemaVersion 1)')
  }
  if (typeof value.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(value.id)) throw new Error('Invalid pack id')
  for (const c of value.characters) {
    if (!object(c) || !ID.test(c.id) || typeof c.name !== 'string' || !c.name.trim()) throw new Error('Invalid pack character')
    for (const path of Object.values(c.images ?? {})) if (typeof path !== 'string' || !IMAGE.test(path)) throw new Error(`Invalid image path for ${c.id}`)
  }
  return value
}

/** A character as the page shows her: her id, name and pictures (their paths as the server serves them). */
const shown = (pack) => ({ sources, profile, ...c }) => ({
  ...c, images: Object.fromEntries(Object.entries(c.images ?? {}).map(([k, p]) => [k, `/img/${pack.id}/${p.slice(7)}`])),
})

/** The pack's Umas only (boss boards aren't in the farm's story), with their image paths as the server serves them. */
export function packUmas(pack) {
  return pack.characters.filter((c) => c.role === 'hero').map(shown(pack))
}

/** Every character of the pack, any board's: the town's people are found among them by id. */
export function packPeople(pack) {
  return pack.characters.map(shown(pack))
}
