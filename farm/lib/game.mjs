// The story as the game has it: @farm/domain's TypeScript read in place with Node's type stripping. The farm has no
// global chapters and plays no town scene of its own: the opening's lines are the pack's `opening.json` (else the
// game's three, `placeholders.ts`), so no chapter scene loads here. It reads the town's roles (each played by an Uma:
// `town.json`'s, else master data's), the farm's places, the temperaments and the activities. Nothing is copied: edit a story file and the next request reads it again. Needs Node's type stripping
// (`--experimental-strip-types` before Node 22.18; `pnpm stories` passes it).
import { register } from 'node:module'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

register('./resolve-ts.mjs', import.meta.url)

const SCENE_ID = /^scene:(\d+):(open|close)$/
const isScene = (v) => v && typeof v === 'object' && typeof v.id === 'string' && SCENE_ID.test(v.id) && typeof v.title === 'string' && Array.isArray(v.beats)

/** The files the sandbox reads, relative to the domain's `src/`. */
const FIXED = {
  cast: 'story/cast.ts', places: 'farm/places.ts', talents: 'farm/talents.ts', ranks: 'farm/ranks.ts', lines: 'items/lines.ts', authored: 'story/authored.ts', pack: 'story/pack.ts',
  placeholders: 'story/placeholders.ts', complete: 'story/complete.ts',
}

async function version(src, files) {
  const times = await Promise.all(files.map((f) => stat(join(src, f)).then((s) => s.mtimeMs, () => 0)))
  return Math.max(0, ...times).toFixed(0)
}

/** Loads the game's story from `src` (the domain's `src/` folder). Never throws: a failure comes back as `{ ok: false }`. */
export async function loadGame(src) {
  if (!process.features?.typescript) {
    return { ok: false, error: 'This Node reads no TypeScript: start the sandbox with `pnpm stories` (it passes --experimental-strip-types).' }
  }
  try {
    const chapters = (await readdir(join(src, 'story'))).filter((n) => n === 'opening.ts')
    const files = [...Object.values(FIXED), ...chapters.map((n) => `story/${n}`)]
    const v = await version(src, files)
    const load = (file) => import(`${pathToFileURL(join(src, file)).href}?v=${v}`)
    const [cast, places, talents, ranks, lines, authored, pack, placeholders, complete] = await Promise.all(Object.values(FIXED).map(load))
    const scenes = {}
    let hello = null
    const fileOf = {}
    for (const name of chapters) {
      const mod = await load(`story/${name}`)
      if (mod.HELLO_LINES) hello = mod.HELLO_LINES
      for (const value of Object.values(mod)) {
        const found = isScene(value) ? [value] : value && typeof value === 'object' ? Object.values(value).filter(isScene) : []
        for (const scene of found) { scenes[scene.id] = structuredClone(scene); fileOf[scene.id] = `packages/domain/src/story/${name}` }
      }
    }
    return {
      ok: true,
      version: v,
      // The town's roles; a role's name here is its words ("The smith"): the Uma who plays it is the pack's.
      cast: Object.values(cast.CAST).map((c) => ({ ...c, name: c.role })),
      hello: hello ? { ...hello } : {},
      scenes,
      sceneFiles: fileOf,
      places: places.FARM_PLACES.map(({ id, name, group, row, col, blurb, opens }) => ({ id, name, group, row, col, blurb, opens: { ...opens } })),
      temperaments: [...talents.TEMPERAMENTS],
      statTemperament: { ...talents.STAT_TEMPERAMENT },
      activities: [...ranks.ACTIVITIES],
      callings: [...lines.MATERIAL_LINES],
      /** The authored format: its vocabulary for the page, and the game's own reader the server runs (never sent as JSON). */
      authored: {
        rungs: [...authored.RUNGS], places: [...authored.STORY_PLACES], festivals: [...authored.FESTIVALS], tieKinds: [...authored.TIE_KINDS],
        dateGames: [...authored.DATE_GAMES], tones: [...authored.TONES], emotes: [...authored.EMOTES], callings: [...authored.CALLINGS], triggers: [...authored.TRIGGER_KINDS],
        spots: [...authored.SPOT_IDS],
        defaults: {
          meet: { ...placeholders.DEFAULT_MEET }, chapters: placeholders.DEFAULT_CHAPTERS.map((c) => ({ title: c.title, events: [...c.events] })), welcome: placeholders.DEFAULT_WELCOME,
        },
      },
      validator: {
        readStoryPack: pack.readStoryPack, tagNotes: authored.tagNotes, bibleTagNotes: authored.bibleTagNotes, unscriptedBeats: authored.unscriptedBeats,
        writtenOf: placeholders.writtenOf, townOf: placeholders.townOf,
        // The world as the game plays it: the pack's world.json, else the game's own words.
        worldWrittenOf: placeholders.worldWrittenOf, worldNamesOf: placeholders.worldNamesOf, historyOf: placeholders.historyOf, festivalsOf: placeholders.festivalsOf,
        placeWordsOf: placeholders.placeWordsOf, seasonLineOf: placeholders.seasonLineOf, townNotesOf: placeholders.townNotesOf, storyDaysOf: placeholders.storyDaysOf,
        // A complete Uma: each piece hers, the default ("draft": "default") or missing, and the marker's notes.
        umaStatus: complete.umaStatus, leftWords: complete.leftWords, draftNotes: complete.draftNotes,
      },
    }
  } catch (error) {
    return { ok: false, error: `The game's story didn't load: ${error.message.split('\n')[0]}` }
  }
}
