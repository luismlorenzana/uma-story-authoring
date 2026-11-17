// The Cyberpunk Story Sandbox's own model. Pure, and the page loads this same file. The story's format, its parser and
// its checks are the game's (packages/domain/src/story/); this adds only what reading and reviewing need on top: names
// and faces for ids from the private cast pack, where every Lead, Log File line, Anomaly and flag is touched, words and
// reading time, the interjection slot's pick, the owner's verdicts, and the story's deliverables as a checklist.
// No name or line of story is in this file.

const object = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v) => typeof v === 'string'

// --- the owner's verdicts, in the shape the sibling sandboxes write

export const VERDICTS = ['liked', 'rework', 'question']
export const NOTE_LIMIT = 4000
const ITEM = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,159}$/
const refuse = (message) => Object.assign(new Error(message), { status: 400 })

/** A verdict from the page: an item (a file, a chapter, a scene…), liked, rework, question or none, and a note. */
export function parseVerdict(input) {
  if (!object(input) || !text(input.item) || !ITEM.test(input.item) || input.item.includes('..')) throw refuse('A verdict names its item')
  if (!(input.status === null || VERDICTS.includes(input.status))) throw refuse(`A verdict is ${VERDICTS.join(', ')} or none`)
  if (!text(input.note) || input.note.length > NOTE_LIMIT) throw refuse(`A note is text of at most ${NOTE_LIMIT} characters`)
  return { item: input.item, status: input.status, note: input.note }
}

export function parseReviews(value) {
  if (value === null || value === undefined) return { schemaVersion: 1, items: {} }
  if (!object(value) || !object(value.items)) throw new Error('reviews.json isn’t a verdicts file')
  return { schemaVersion: 1, items: value.items }
}

/** The verdicts with one item set; no verdict and no note removes it. Items stay sorted. */
export function withVerdict(reviews, input, now) {
  const items = { ...reviews.items }
  if (input.status === null && !input.note.trim()) delete items[input.item]
  else items[input.item] = { status: input.status, note: input.note, updatedAt: now }
  return { schemaVersion: 1, items: Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b))) }
}

// --- the cast pack: names and pictures for ids, private, built by import-pack from the Ranker's plan

export const PACK_KIND = 'cyber-cast-pack'
const IMAGE = /^images\/[A-Za-z0-9._-]+\.(png|webp|jpg)$/
const HEROINE_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/

export function parseCastPack(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== PACK_KIND || !Array.isArray(value.umas) || !Array.isArray(value.heroines)) {
    throw new Error(`Not a cast pack (kind ${PACK_KIND}, schemaVersion 1)`)
  }
  if (!text(value.id) || !/^[a-z0-9-]{1,60}$/.test(value.id)) throw new Error('Invalid pack id')
  const images = (c) => { for (const path of Object.values(c.images ?? {})) if (!text(path) || !IMAGE.test(path)) throw new Error('Invalid image path in the pack') }
  for (const u of value.umas) { if (!object(u) || !Number.isSafeInteger(u.outfit) || !text(u.name) || !u.name.trim()) throw new Error('Invalid Uma in the pack'); images(u) }
  for (const h of value.heroines) { if (!object(h) || !text(h.id) || !HEROINE_ID.test(h.id) || !text(h.name) || !h.name.trim()) throw new Error('Invalid heroine in the pack'); images(h) }
  return value
}

// --- the foes: the Standard and one kit per faction, private, written by the story session in content/stories/foes/

/** The franchise factions, in the order the Circuit meets them (six since D36). */
export const FOE_ORDER = ['neon-commission', 'tideline-armada', 'sevenfold-envoys', 'starward-contractors', 'lantern-wardens', 'ember-bastion']
export const FOE_RANKS = ['boss', 'key', 'regular']
const HEX = /^#[0-9A-Fa-f]{6}$/

/** A colour the page may paint with: a six-digit hex, else nothing. */
export const hexOrNull = (value) => (text(value) && HEX.test(value) ? value : null)

/** A foe file: the Standard every foe shares (`foe-standard`), or one faction's kit, variants and ranked units
 * (`foe-faction`). Checked for the shape the Foes page reads; the rest is shown as text. */
export function parseFoeFile(value) {
  if (!object(value) || value.schemaVersion !== 1 || (value.kind !== 'foe-standard' && value.kind !== 'foe-faction')) {
    throw new Error('Not a foe file (kind foe-standard or foe-faction, schemaVersion 1)')
  }
  if (value.kind === 'foe-faction') {
    if (!text(value.id) || !/^[a-z0-9-]{1,40}$/.test(value.id) || !text(value.title) || !object(value.palette) || !Array.isArray(value.variants) || !Array.isArray(value.units)) {
      throw new Error('A faction needs an id, a title, a palette, variants and units')
    }
    for (const u of value.units) {
      if (!object(u) || !text(u.id) || !HEROINE_ID.test(u.id) || !FOE_RANKS.includes(u.rank)) throw new Error('A foe unit needs a board id and a rank')
    }
  }
  return value
}

/** The Uma-to-boss ties (`content/stories/ties.json`, private): each Uma (an outfit id) with a boss (a board id), a kind,
 * a heat of 1 to 3, a world, and the conflict and its turn as text. Checked for the shape the Ties page reads. */
export function parseTies(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'uma-foe-ties' || !Array.isArray(value.ties) || !Array.isArray(value.kinds)) {
    throw new Error('Not a ties file (kind uma-foe-ties, schemaVersion 1)')
  }
  const kinds = new Set(value.kinds.map((k) => k?.id))
  for (const t of value.ties) {
    if (!object(t) || !Number.isSafeInteger(t.uma) || !text(t.foe) || !HEROINE_ID.test(t.foe) || !kinds.has(t.kind) || ![1, 2, 3].includes(t.heat)) {
      throw new Error('A tie needs an Uma’s outfit id, a boss’s board id, a known kind and a heat of 1 to 3')
    }
  }
  return value
}

/** Every image file a pack lists. */
export function packImages(pack) {
  return new Set([...pack.umas, ...pack.heroines].flatMap((c) => Object.values(c.images ?? {})))
}

const initials = (label) => String(label).replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

/**
 * Who an id is. An Uma is her outfit id, a heroine her board id, a minor character a slug. The name comes from the cast
 * pack; without one, from the casting's own `labels` (the stand-in's); without either, the id itself.
 */
export function castIndex(pack, casting) {
  const umas = new Map((pack?.umas ?? []).map((u) => [String(u.outfit), u]))
  const heroines = new Map((pack?.heroines ?? []).map((h) => [h.id, h]))
  const labels = casting?.labels ?? {}
  const minor = new Set(casting?.minor ?? [])
  const who = (id) => {
    const key = String(id)
    const uma = umas.get(key), heroine = heroines.get(key)
    const kind = uma ? 'uma' : heroine ? 'heroine' : minor.has(key) ? 'minor' : /^[0-9]+$/.test(key) ? 'uma' : 'unknown'
    const record = uma ?? heroine ?? null
    const name = record?.name ?? labels[key] ?? key
    return { id: key, kind, name, known: Boolean(record || labels[key] || minor.has(key)), initials: initials(name), face: record?.images?.face ?? null, art: record?.images?.art ?? null, record }
  }
  return { who, name: (id) => who(id).name, umas, heroines }
}

// --- words and reading time

export const words = (value) => (text(value) ? value.trim().split(/\s+/).filter(Boolean).length : 0)

/** Every step, with the steps inside a choice's options, each with where it sits. */
export function* walk(steps, path = 'steps') {
  for (const [i, step] of (steps ?? []).entries()) {
    const at = `${path}[${i}]`
    yield { step, path: at }
    if (step.kind === 'choice') for (const [j, option] of step.options.entries()) yield* walk(option.then, `${at}.choice[${j}].then`)
  }
}

/** The words a step shows: its own text, a slot's lines and fallback, a choice's options. */
export function stepWords(step) {
  if (step.kind === 'slot') return words(step.fallback) + Object.values(step.lines).reduce((n, line) => n + words(line), 0)
  if (step.kind === 'choice') return step.options.reduce((n, o) => n + words(o.text), 0)
  return words(step.text)
}
export const countWords = (steps) => { let n = 0; for (const { step } of walk(steps)) n += stepWords(step); return n }

/** The line an interjection slot plays: the first lead in the crew's order who is in the squad and has one, else the fallback. */
export function slotLine(slot, squad, crewOrder) {
  const inSquad = new Set((squad ?? []).map(String))
  const speaker = (crewOrder ?? []).map(String).find((id) => inSquad.has(id) && text(slot.lines[id]))
  return speaker ? { speaker, text: slot.lines[speaker] } : { speaker: null, text: slot.fallback }
}

// --- where things are touched

const push = (map, key, value) => { (map[key] ??= []).push(value) }

/**
 * The story by its cross references: chapters by world and by lead, every scene and mission by id, and for every Lead,
 * Log File line, Anomaly, flag, Call, join and coming aboard, the scenes that touch it.
 */
export function storyIndex(pack) {
  const out = {
    chaptersByWorld: {}, chaptersByLead: {}, scenes: {}, missions: {},
    leads: {}, fileLines: {}, anomalies: {}, flags: {}, calls: {}, joins: {}, aboard: {}, kinds: {},
    totals: { worlds: 0, leads: 0, chapters: 0, scenes: 0, missions: 0, files: 0, calls: 0, words: 0 },
  }
  if (!pack) return out
  const chapters = Object.values(pack.chapters).sort((a, b) => a.danger - b.danger || a.number - b.number || a.id.localeCompare(b.id))
  for (const chapter of chapters) {
    push(out.chaptersByWorld, chapter.world, chapter)
    for (const lead of chapter.leads) push(out.chaptersByLead, String(lead), chapter)
    for (const mission of chapter.missions) {
      out.missions[mission.id] = { chapter, mission }
      for (const side of mission.side ?? []) if (side.gives) push(out.leads, side.gives, { chapter: chapter.id, scene: null, mission: mission.id, how: 'side' })
    }
    const parts = [...chapter.scenes.map((scene) => ({ id: scene.id, steps: scene.steps, scene })), { id: 'debrief', steps: chapter.debrief.steps, scene: null }]
    for (const part of parts) {
      if (part.scene) out.scenes[part.id] = { chapter, scene: part.scene }
      const at = { chapter: chapter.id, scene: part.id }
      for (const { step } of walk(part.steps)) {
        out.kinds[step.kind] = (out.kinds[step.kind] ?? 0) + 1
        out.totals.words += stepWords(step)
        if (step.kind === 'lead') push(out.leads, step.lead, { ...at, how: 'step' })
        if (step.kind === 'choice') for (const option of step.options) if (option.lead) push(out.leads, option.lead, { ...at, how: 'choice' })
        if (step.kind === 'file') push((out.fileLines[step.file] ??= {}), String(step.line), at)
        if (step.kind === 'anomaly') push((out.anomalies[step.anomaly] ??= { opened: [], closed: [] }), step.open ? 'opened' : 'closed', at)
        if (step.kind === 'flag') push(out.flags, step.flag, { ...at, set: step.set })
        if (step.kind === 'call') push(out.calls, step.call, at)
        if (step.kind === 'join') out.joins[String(step.outfit)] = at
        if (step.kind === 'aboard') out.aboard[String(step.outfit)] = at
      }
    }
  }
  out.totals.worlds = Object.keys(pack.worlds).length
  out.totals.leads = pack.casting.leads.length
  out.totals.chapters = chapters.length
  out.totals.scenes = chapters.reduce((n, c) => n + c.scenes.length, 0)
  out.totals.missions = chapters.reduce((n, c) => n + c.missions.length, 0)
  out.totals.files = Object.keys(pack.files).length
  out.totals.calls = Object.keys(pack.calls).length
  return out
}

// --- what the story session delivers (the story brief's SB9), as a checklist read off the files

/** Each of SB9's five deliverables with where it stands. `standIn`: no story is in content/stories/ yet. */
export function deliverables(pack, layers, standIn) {
  const real = pack && !standIn
  const worlds = real ? Object.keys(pack.worlds) : []
  const scriptedFirst = real ? Object.values(pack.chapters).filter((c) => c.number === 1 && layers[`chapter:${c.id}`] === 'scripted') : []
  const firstWorlds = new Set(scriptedFirst.map((c) => c.world))
  const casting = real && pack.casting.leads.length > 0
  const state = (done, started) => (done ? 'done' : started ? 'started' : 'todo')
  return [
    { n: 1, what: 'The world outline: the worlds and their order, the ship, the main thread, the mystery’s layers, the factions’ places; nameless', where: 'docs/design/world.md, in git', state: 'manual', detail: 'Read on its own page; this folder can’t tell whether it’s rewritten' },
    { n: 2, what: 'The casting: the leads and their worlds, talents, rooms and role tags; the crew order; the heroines by faction and Hold; guests', where: 'content/stories/casting.json', state: state(casting, false), detail: casting ? `${pack.casting.leads.length} leads, ${pack.casting.heroines.length} heroines` : 'Not written yet' },
    { n: 3, what: 'The first world and its lead’s Chapter 1', where: 'content/stories/worlds/, chapters/', state: state(firstWorlds.size >= 1, worlds.length >= 1), detail: `${worlds.length} world${worlds.length === 1 ? '' : 's'}, ${scriptedFirst.length} scripted Chapter 1${scriptedFirst.length === 1 ? '' : 's'}` },
    { n: 4, what: 'The second world and its Chapter 1', where: 'content/stories/worlds/, chapters/', state: state(firstWorlds.size >= 2, worlds.length >= 2), detail: firstWorlds.size >= 2 ? 'The pickup can be proven' : 'After the first' },
    { n: 5, what: 'Then a world at a time, with its chapters, Files and Calls', where: 'content/stories/', state: state(false, firstWorlds.size >= 2 && worlds.length > 2), detail: `${worlds.length} of about eight worlds` },
  ]
}

/** A mission's enemy slot in words, with names where the cast knows them. */
export function enemyWords(slot, name) {
  return slot.slot === 'boss' ? `Boss: ${slot.pool.map(name).join(' or ')}` : `${slot.count} × ${slot.job} (${slot.faction})`
}
