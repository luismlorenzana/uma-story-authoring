// The Farm Story Sandbox's model (tools/story-sandbox/README.md): chapter drafts, story beats and conversation
// templates from docs/story/, checked against the game's story as built (lib/game.mjs). The town's people are Umas in the
// town's roles, named from master data at run time, and the farm's Umas speak only in roles the game fills at run time,
// so no Uma's name is in this code. The sample crew below is invented, one Uma a temperament.

const object = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const int = (v) => Number.isSafeInteger(v)

export const CHAPTER_COUNT = 8
/** A chapter's depth: its one line, an outline of its two scenes, the scenes scripted here, or built in the game. */
export const LAYERS = ['line', 'outline', 'scripted', 'built']
/** The longest line a scene's text box takes (chapter 1's longest is 118); one line to a tap. */
export const SCENE_LINE_LIMIT = 120
/** The longest line a bubble over a working Uma takes (conversations and story beats). */
export const BUBBLE_LINE_LIMIT = 80
export const BEAT_HEARTS = [2, 4, 6, 8, 10]
export const BOND_HEARTS = [1, 2, 3, 4, 5]
export const DISTANCES = ['sprint', 'mile', 'medium', 'long']
/** The conversations' authoring target per bond heart: 20 templates for any place, and 2 for each place Umas work
 * (map rows 1–5). */
export const CONVERSATION_TARGET = { any: 20, place: 2 }
const PLACEHOLDERS = { scene: ['name'], beat: ['name', 'farm'], conversation: ['a', 'b', 'place', 'item', 'farm'] }

/** Who may speak a scene's beat. `game` marks the kinds uma-farm's scene players fill today (the ring bench's, `story/bench.ts`). */
export const SPEAKERS = {
  cast: { game: true, uma: false, about: 'One of the town’s roles, by id: the Uma who plays it (her master-data name and bust in the game)' },
  narrator: { game: true, uma: false, about: 'Narration: no speaker, in italics' },
  'first-hand': { game: true, uma: true, about: 'Your first hands (index 0–2), the start’s three. The line is left empty: she says her temperament’s hello' },
  'newest-hand': { game: false, uma: true, about: 'Your newest hand: the last to join (the game plays no chapter scenes now)' },
  best: { game: false, uma: true, about: 'Your best at an activity: the highest rank in it, then talent' },
  closest: { game: false, uma: true, about: 'The Uma you’re closest to: the highest affinity' },
  team: { game: false, uma: true, about: 'Your team (index 0–2): a festival’s three' },
}

/** An invented crew, one a temperament, that fills the roles when a scene plays here. The page lets you rename them. */
export const SAMPLE_CREW = [
  { id: 'sample-1', name: 'Breezy', temperament: 'breezy', calling: 'vegetables', distance: 'sprint', best: 'foraging' },
  { id: 'sample-2', name: 'Steady', temperament: 'steady', calling: 'wood', distance: 'long', best: 'farming' },
  { id: 'sample-3', name: 'Bold', temperament: 'bold', calling: 'metal', distance: 'mile', best: 'mining' },
  { id: 'sample-4', name: 'Gritty', temperament: 'gritty', calling: 'stone', distance: 'medium', best: 'ranch' },
  { id: 'sample-5', name: 'Clever', temperament: 'clever', calling: 'fish', distance: 'medium', best: 'cooking' },
]

const SPOKEN = /^“[\s\S]*”$/
const placeholdersIn = (line) => [...line.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1])
export const lineWords = (line) => (line.match(/[A-Za-z0-9’']+/g) ?? []).length

/** Problems with one line's placeholders and quotes. `spoken` lines are “quoted” as the game's are; bubbles aren't. */
function lineIssues(line, where, { kind, uma, spoken }) {
  const issues = []
  for (const p of placeholdersIn(line)) {
    if (!PLACEHOLDERS[kind].includes(p)) issues.push(`${where}: unknown placeholder {${p}} (${PLACEHOLDERS[kind].map((x) => `{${x}}`).join(', ')})`)
    else if (kind === 'scene' && p === 'name' && !uma) issues.push(`${where}: {name} is an Uma’s name, so only an Uma’s line may use it`)
  }
  if (spoken === true && !SPOKEN.test(line)) issues.push(`${where}: a spoken line is “quoted”, as the game’s are`)
  if (spoken === false && /^“/.test(line)) issues.push(`${where}: ${kind === 'scene' ? 'narration' : 'a bubble'} isn’t quoted`)
  return issues
}

/** Problems with a scene's beats (the game's `Beat`: a speaker and a line). */
export function sceneIssues(beats, { chapter, cast, activities }, label) {
  const issues = []
  const castById = new Map((cast ?? []).map((c) => [c.id, c]))
  beats.forEach((beat, i) => {
    const where = `${label}, beat ${i + 1}`
    const sp = beat?.speaker
    if (!object(beat) || !object(sp) || !SPEAKERS[sp.kind]) { issues.push(`${where}: unknown speaker`); return }
    if (typeof beat.line !== 'string') { issues.push(`${where}: no line`); return }
    if (sp.kind === 'cast') {
      const c = castById.get(sp.id)
      if (!c) issues.push(`${where}: ${sp.id} isn’t in the town’s cast`)
      else if (c.from > chapter) issues.push(`${where}: ${c.name} speaks in chapter ${chapter}, before chapter ${c.from} brings them in (a line may name them)`)
    }
    if ((sp.kind === 'first-hand' || sp.kind === 'team') && ![0, 1, 2].includes(sp.index)) issues.push(`${where}: ${sp.kind} takes an index 0–2`)
    if (sp.kind === 'best' && !(activities ?? []).includes(sp.activity)) issues.push(`${where}: best at what? (${(activities ?? []).join(', ')})`)
    if (sp.kind === 'first-hand') {
      if (beat.line !== '') issues.push(`${where}: a first hand says her temperament’s hello, so her line stays empty`)
      return
    }
    if (!text(beat.line, 1000)) { issues.push(`${where}: an empty line`); return }
    issues.push(...lineIssues(beat.line, where, { kind: 'scene', uma: SPEAKERS[sp.kind].uma, spoken: sp.kind !== 'narrator' }))
  })
  return issues
}

const sameBeats = (a, b) => a.length === b.length && a.every((x, i) => JSON.stringify(x.speaker) === JSON.stringify(b[i].speaker) && x.line === b[i].line)

/** A chapter draft, merged with the game's scenes when the game plays them. Throws on a file that isn't a chapter. */
export function parseChapter(raw, game) {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.kind !== 'farm-chapter') throw new Error('Not a chapter draft (kind farm-chapter, schemaVersion 1)')
  if (!int(raw.chapter) || raw.chapter < 1 || raw.chapter > CHAPTER_COUNT) throw new Error(`chapter must be 1–${CHAPTER_COUNT}`)
  const n = raw.chapter
  const issues = []
  const castIds = new Set((game?.cast ?? []).map((c) => c.id))
  if (!text(raw.title, 200)) issues.push('No title')
  if (!LAYERS.includes(raw.layer)) issues.push(`layer is one of ${LAYERS.join(', ')}`)
  if (!text(raw.opens, 300)) issues.push('No “opens” line: what the chapter opens')
  const brings = Array.isArray(raw.brings) ? raw.brings : []
  if (!brings.length) issues.push('No “brings”: the cast member who opens it')
  if (game?.ok) for (const id of brings) if (!castIds.has(id)) issues.push(`brings ${id}, who isn’t in the town’s cast`)
  const goals = Array.isArray(raw.goals) ? raw.goals : []
  if (goals.length < 3 || goals.length > 6 || !goals.every((g) => text(g, 200))) issues.push('Three to six goals, each a line')
  if (!text(raw.reward, 300)) issues.push('No reward line')
  const scenes = []
  for (const kind of ['open', 'close']) {
    const id = `scene:${n}:${kind}`
    const draft = (Array.isArray(raw.scenes) ? raw.scenes : []).find((s) => s?.id === id) ?? null
    const built = game?.scenes?.[id] ?? null
    const label = kind === 'open' ? 'The opening scene' : 'The closing scene'
    const outline = Array.isArray(draft?.outline) ? draft.outline : []
    const draftBeats = Array.isArray(draft?.beats) ? draft.beats : null
    if (raw.layer !== 'line' && (outline.length < 3 || outline.length > 6 || !outline.every((o) => text(o, 600)))) issues.push(`${label}: an outline of three to six beats`)
    if ((raw.layer === 'scripted') && !draftBeats?.length) issues.push(`${label}: scripted, but no beats`)
    if (draftBeats) issues.push(...sceneIssues(draftBeats, { chapter: n, cast: game?.cast, activities: game?.activities }, label))
    if (built && draftBeats && !sameBeats(draftBeats, built.beats)) issues.push(`${label}: the draft’s beats differ from the game’s (${game.sceneFiles?.[id] ?? 'the game'})`)
    const beats = built?.beats ?? draftBeats ?? []
    if (kind === 'close' && beats.length && !beats.some((b) => b.speaker?.kind === 'newest-hand')) issues.push(`${label}: every chapter ends with a recruit, so your newest hand speaks`)
    scenes.push({
      id, kind, title: built?.title ?? draft?.title ?? label, place: draft?.place ?? null, outline, beats,
      source: built ? 'game' : draftBeats ? 'draft' : 'outline', file: built ? game.sceneFiles?.[id] : null,
    })
  }
  const inGame = scenes.filter((s) => s.source === 'game').length
  if (raw.layer === 'built' && inGame < 2) issues.push('Marked built, but the game doesn’t play both its scenes yet')
  if (raw.layer !== 'built' && inGame === 2) issues.push('The game plays both scenes: mark the chapter built')
  const chapter = {
    chapter: n, title: raw.title, layer: raw.layer, opens: raw.opens, brings, place: raw.place ?? null, goals,
    teaches: Array.isArray(raw.teaches) ? raw.teaches : null, reward: raw.reward, item: raw.item ?? null, source: raw.source ?? null, scenes,
  }
  return { chapter, issues, words: chapterWords(chapter, game) }
}

function chapterWords(chapter, game) {
  let n = 0
  for (const s of chapter.scenes) for (const b of s.beats) n += lineWords(b.speaker?.kind === 'first-hand' ? Object.values(game?.hello ?? {})[0] ?? '' : b.line)
  return n
}

/** The story beats file (the game's `StoryBeat` shape, with a title and a premise for the outline layer). */
export function parseBeats(raw, game) {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.kind !== 'farm-story-beats' || !Array.isArray(raw.beats)) throw new Error('Not a story beats file (kind farm-story-beats, schemaVersion 1)')
  const temperaments = game?.temperaments ?? []
  return raw.beats.map((beat, i) => {
    const issues = []
    if (!object(beat)) return { beat: { id: `#${i + 1}` }, issues: ['Not a beat'] }
    if (game?.ok && !temperaments.includes(beat.temperament)) issues.push(`Temperament is one of ${temperaments.join(', ')}`)
    if (!BEAT_HEARTS.includes(beat.hearts)) issues.push(`Hearts are ${BEAT_HEARTS.join(', ')}`)
    if (beat.id !== `beat.${beat.temperament}.${beat.hearts}`) issues.push(`The id is beat.<temperament>.<hearts>: beat.${beat.temperament}.${beat.hearts}`)
    if (!text(beat.title, 120)) issues.push('No title')
    if (!text(beat.premise, 600)) issues.push('No premise: one line on what happens')
    const lines = Array.isArray(beat.lines) ? beat.lines : null
    if (lines) {
      if (lines.length < 3 || lines.length > 6) issues.push('Three to six lines')
      lines.forEach((l, k) => {
        if (!object(l) || !['her', 'you'].includes(l.by) || !text(l.text, 1000)) issues.push(`Line ${k + 1}: by her or you, with its text`)
        else issues.push(...lineIssues(l.text, `Line ${k + 1}`, { kind: 'beat', spoken: false }))
      })
    }
    return { beat: { ...beat, layer: lines ? 'scripted' : 'outline' }, issues }
  })
}

const WHO_KEYS = { temperament: 'temperaments', line: 'callings', distance: 'distances' }

/** The conversation templates file (the game's `ConversationTemplate` shape; a `narrator` line is sandbox-first). */
export function parseConversations(raw, game) {
  if (!object(raw) || raw.schemaVersion !== 1 || raw.kind !== 'farm-conversations' || !Array.isArray(raw.templates)) throw new Error('Not a conversations file (kind farm-conversations, schemaVersion 1)')
  const allowed = { temperaments: game?.temperaments ?? [], callings: game?.callings ?? [], distances: DISTANCES }
  const places = new Set(['any', ...(game?.places ?? []).map((p) => p.id)])
  return raw.templates.map((t, i) => {
    const issues = []
    if (!object(t)) return { template: { id: `#${i + 1}` }, issues: ['Not a template'] }
    if (game?.ok && !places.has(t.place)) issues.push(`Place is a farm place or any, not ${t.place}`)
    if (!BOND_HEARTS.includes(t.hearts)) issues.push('Hearts are 1–5')
    if (typeof t.id !== 'string' || !t.id.startsWith(`conv.${t.place}.${t.hearts}.`)) issues.push(`The id starts conv.${t.place}.${t.hearts}.`)
    for (const side of ['a', 'b']) {
      const who = t[side]
      if (!object(who)) { issues.push(`${side}: the speaker’s filters ({} matches anyone)`); continue }
      for (const [k, v] of Object.entries(who)) {
        if (!WHO_KEYS[k]) issues.push(`${side}: filters are temperament, line and distance, not ${k}`)
        else if (game?.ok && !allowed[WHO_KEYS[k]].includes(v)) issues.push(`${side}.${k} is one of ${allowed[WHO_KEYS[k]].join(', ')}`)
      }
    }
    const lines = Array.isArray(t.lines) ? t.lines : []
    if (lines.length < 3 || lines.length > 6) issues.push('Three to six lines')
    if (!lines.some((l) => l?.by === 'a') || !lines.some((l) => l?.by === 'b')) issues.push('Both a and b speak')
    lines.forEach((l, k) => {
      if (!object(l) || !['a', 'b', 'narrator'].includes(l.by) || !text(l.text, 1000)) issues.push(`Line ${k + 1}: by a, b or narrator, with its text`)
      else issues.push(...lineIssues(l.text, `Line ${k + 1}`, { kind: 'conversation', spoken: false }))
    })
    return { template: t, issues }
  })
}

/** A small stable hash (FNV-1a), for the choosing rule's seeded tie-break. */
export function seedOf(value) {
  let h = 0x811c9dc5
  for (const ch of String(value)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  return h
}

/** How well a template fits a pair in one order, or null when a filter doesn't match (2 a temperament, 1 a line or a
 * distance). */
function fit(t, a, b) {
  let score = 0
  for (const [who, uma] of [[t.a ?? {}, a], [t.b ?? {}, b]]) {
    for (const [k, v] of Object.entries(who)) {
      const have = k === 'line' ? uma.calling : uma[k]
      if (have !== v) return null
      score += k === 'temperament' ? 2 : 1
    }
  }
  return score
}

/** The conversations' choosing rule: of the templates for these hearts at this place or any, score 3 for the place,
 * 2 a temperament and 1 a line or distance matched, trying both orders of the pair; the best wins, ties broken by a
 * seed from the two ids, so the same pair always gets the same conversation. Returns every eligible template, best
 * first. */
export function chooseConversation(templates, pair, place, hearts) {
  const [x, y] = pair
  const key = [x.id, y.id].sort().join('|')
  const ranked = []
  for (const t of templates) {
    if (t.hearts !== hearts || (t.place !== place && t.place !== 'any')) continue
    const xy = fit(t, x, y), yx = fit(t, y, x)
    if (xy === null && yx === null) continue
    const order = yx !== null && (xy === null || yx > xy) ? 'yx' : 'xy'
    const score = (t.place === place ? 3 : 0) + (order === 'xy' ? xy : yx)
    ranked.push({ template: t, score, order, a: order === 'xy' ? x : y, b: order === 'xy' ? y : x, seed: seedOf(`${key}|${t.id}`) })
  }
  ranked.sort((p, q) => q.score - p.score || q.seed - p.seed)
  return ranked
}

/** The work places of the conversations' target: the map's first five rows (gathering, the stations, the ranch, the
 * workshops). */
export const workPlaces = (places) => places.filter((p) => p.row <= 5).map((p) => p.id)

/** Checks across the files, and how far the beats and conversations have come. */
export function crossCheck(chapters, beats, templates, game) {
  const issues = []
  const byNumber = new Map()
  for (const c of chapters) {
    if (byNumber.has(c.chapter)) issues.push(`Chapter ${c.chapter} has two drafts`)
    byNumber.set(c.chapter, c)
  }
  for (let n = 1; n <= CHAPTER_COUNT; n++) if (!byNumber.has(n)) issues.push(`No draft for chapter ${n}`)
  for (const id of Object.keys(game?.scenes ?? {})) {
    const n = Number(id.split(':')[1])
    if (!byNumber.has(n)) issues.push(`The game plays ${id}, but chapter ${n} has no draft`)
  }
  // The town's people are named from master data at run time, so a draft's lines aren't checked for their names.
  const seen = new Map()
  for (const b of beats) {
    const k = `${b.temperament}.${b.hearts}`
    if (seen.has(k)) issues.push(`Two story beats for ${b.temperament} at ${b.hearts} hearts`)
    seen.set(k, b)
  }
  const ids = new Set()
  for (const t of templates) { if (ids.has(t.id)) issues.push(`Two conversations with the id ${t.id}`); ids.add(t.id) }
  const work = workPlaces(game?.places ?? [])
  const conversations = BOND_HEARTS.map((hearts) => {
    const at = templates.filter((t) => t.hearts === hearts)
    const places = Object.fromEntries(work.map((p) => [p, at.filter((t) => t.place === p).length]))
    const other = at.filter((t) => t.place !== 'any' && !work.includes(t.place)).length
    const any = at.filter((t) => t.place === 'any').length
    const catchAll = at.some((t) => t.place === 'any' && !Object.keys(t.a ?? {}).length && !Object.keys(t.b ?? {}).length)
    const target = CONVERSATION_TARGET.any + CONVERSATION_TARGET.place * work.length
    const counted = Math.min(any, CONVERSATION_TARGET.any) + Object.values(places).reduce((n, v) => n + Math.min(v, CONVERSATION_TARGET.place), 0)
    return { hearts, any, places, other, catchAll, total: at.length, counted, target }
  })
  return {
    issues,
    beats: { scripted: beats.filter((b) => b.layer === 'scripted').length, outlined: beats.filter((b) => b.layer === 'outline').length, target: (game?.temperaments?.length ?? 5) * BEAT_HEARTS.length },
    conversations,
  }
}
