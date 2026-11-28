// The story as Uma Quest reads it, for the "In the game" page. Three parts, each read in place from the local
// uma-quest checkout and never copied:
//   - the game's own story parsers (`packages/domain/src/story/pack.ts` and `script.ts`, TypeScript, run through the
//     hub's tsx), so the checks are the game's, not the sandbox's;
//   - the story pack the game last had exported here (`content/story/index.json` and its hash-named files), read by
//     those parsers;
//   - what `stories:export-game` would write from the stories now (`tools/story-delivery/lib/game-pack.mjs`):
//     every chapter marked `scripted`, with the steps the game would play and those it would narrate or skip.
// Never throws: each part comes back with `ok` and either its result or the error.
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PARSERS = { pack: 'packages/domain/src/story/pack.ts', script: 'packages/domain/src/story/script.ts' }
const DELIVERY = 'tools/story-delivery/lib/game-pack.mjs'
const PACK = 'content/story'
const message = (e) => (e instanceof Error ? e.message : String(e))

async function load(root, file) {
  const path = join(root, file)
  const v = (await stat(path)).mtimeMs.toFixed(0)
  return import(`${pathToFileURL(path).href}?v=${v}`)
}

/** How a scene's steps play in the game: the steps it plays, and those narrated for now or skipped, with why. */
export function playable(looseSteps, steps, where) {
  const r = looseSteps(steps, where)
  const kinds = {}
  for (const st of r.steps) kinds[st.kind] = (kinds[st.kind] ?? 0) + 1
  return { played: r.steps.length, kinds, narrated: r.issues.filter((i) => /narration/.test(i)).length, skipped: r.issues.filter((i) => !/narration/.test(i)).length, issues: r.issues }
}

/** Reads the exported pack with the game's parsers: what landed in each slot, and every problem the game would note. */
async function readPack(root, parsers) {
  const dir = join(root, PACK)
  let raw
  try { raw = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')) } catch (e) {
    return { ok: false, error: e.code === 'ENOENT' ? 'No story pack exported yet (stories:export-game writes it).' : message(e) }
  }
  let index
  try { index = parsers.pack.parseStoryIndex(raw) } catch (e) { return { ok: false, error: `The game can't read the index: ${message(e)}` } }
  const file = async (f) => JSON.parse(await readFile(join(root, 'content', f.path), 'utf8'))
  const out = { ok: true, builtAt: index.builtAt, cast: null, opening: null, world: null, chapters: [], problems: [] }
  const note = (where, issues) => { for (const i of issues) out.problems.push({ where, issue: i }) }
  const slot = async (name, f, parse) => {
    if (!f) return null
    try { const r = parse(await file(f)); note(f.path, r.issues ?? []); return r } catch (e) { note(f.path, [message(e)]); return null }
  }
  const cast = await slot('cast', index.cast, parsers.pack.parseCast)
  if (cast) out.cast = { count: cast.cast.length, ways: cast.cast.reduce((m, e) => ({ ...m, [e.way]: (m[e.way] ?? 0) + 1 }), {}), intros: cast.cast.filter((e) => e.intro).length, recruits: cast.cast.filter((e) => e.recruit).length }
  const opening = await slot('opening', index.opening, parsers.pack.parseOpening)
  if (opening?.opening) out.opening = { scenes: opening.opening.scenes.map((s) => ({ id: s.id, steps: s.steps })) }
  const world = await slot('world', index.world, parsers.pack.parseWorldNames)
  if (world) out.world = { places: Object.keys(world.world.places).length }
  for (const [id, f] of Object.entries(index.chapters ?? {})) {
    try {
      const ch = await file(f)
      const scenes = (Array.isArray(ch.scenes) ? ch.scenes : []).map((s, i) => ({ id: s?.id ?? `scene-${i + 1}`, place: s?.place ?? null, ...playable(parsers.script.looseSteps, s?.steps, `${id}.scenes[${i}]`) }))
      out.chapters.push({ id, lead: ch.lead ?? null, order: ch.order ?? null, title: ch.title ?? null, scenes })
    } catch (e) { note(f.path, [message(e)]) }
  }
  return out
}

/** What the export would write from the stories now: the scripted chapters, as the game would play them. */
async function wouldExport(root, parsers, bundles, pack) {
  let delivery
  try { delivery = await load(root, DELIVERY) } catch (e) { return { ok: false, error: `The export helpers didn't load: ${message(e)}` } }
  try {
    const { chapters, issues } = delivery.chaptersFromBundles(bundles, pack)
    return {
      ok: true, issues,
      chapters: chapters.map((ch) => ({
        id: ch.id, lead: ch.lead, order: ch.order, title: ch.title ?? null, town: ch.town ?? null, dungeon: ch.dungeon ?? null, boss: ch.boss ?? null,
        problems: delivery.chapterProblems(ch),
        scenes: ch.scenes.map((s, i) => ({ id: s.id, place: s.place, trigger: s.trigger, ...(parsers ? playable(parsers.script.looseSteps, s.steps, `${ch.id}.scenes[${i}]`) : {}) })),
      })),
    }
  } catch (e) { return { ok: false, error: message(e) } }
}

/** The whole "In the game" read. `root` is the uma-quest checkout; `bundles` and `pack` are the sandbox's. */
export async function questGame(root, { bundles = [], pack = null } = {}) {
  const out = { root, parsers: { ok: false }, pack: { ok: false }, export: { ok: false } }
  let parsers = null
  try {
    parsers ={ pack: await load(root, PARSERS.pack), script: await load(root, PARSERS.script) }
    out.parsers = { ok: true, lineMax: parsers.script.LINE_MAX ?? null }
  } catch (e) {
    out.parsers = { ok: false, error: `The game's story parsers didn't load from ${root}: ${message(e)}` }
  }
  out.pack = parsers ? await readPack(root, parsers) : { ok: false, error: 'Needs the game\'s parsers.' }
  out.export = await wouldExport(root, parsers, bundles.map((b) => b.bundle ?? b), pack)
  return out
}
