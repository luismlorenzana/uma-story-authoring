// The Story Sandbox's data model: the cast pack (from the Studio's board export), the setting, and story bundles.
// No character, place or story text lives here: all of it is private content under content/stories/.

const object = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const optText = (v, max = 4000) => v === undefined || v === null || text(v, max)
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

/** Step kinds a scene may use. `game` marks the ones uma-quest's runner plays today (docs/technical/story.md). */
export const STEPS = {
  title: { game: false, about: 'A chapter or act title card' },
  narrate: { game: false, about: 'Narration in the text box, with no speaker' },
  line: { game: true, about: 'A spoken line with her portrait and name (≤ 160 characters in the game)' },
  thought: { game: false, about: 'An inner line, shown in italics' },
  emote: { game: true, about: 'An emote and/or bubble over her head' },
  flashback: { game: false, about: 'Starts or ends a flashback: the stage tints and the box changes' },
  letter: { game: false, about: 'A letter, notice or page read in full' },
  choice: { game: false, about: 'A flavour choice: each option gets its own reply, then the scene goes on as one' },
  boss: { game: false, about: 'The boss card: her name and epithet across the screen before the fight' },
  stage: { game: false, about: 'A stage direction in words (stands in for walk, face, camera and wait)' },
  walk: { game: true, about: 'She walks to a tile (shown here as a direction)' },
  face: { game: true, about: 'She turns (shown here as a direction)' },
  camera: { game: true, about: 'A camera beat (shown here as a direction)' },
  wait: { game: true, about: 'A pause' },
  flag: { game: true, about: 'Sets or clears a story flag' },
}
export const EMOTES = ['nod', 'surprise', 'laugh', 'sad', 'angry', 'wave']
export const BUBBLES = ['!', '?', '…', '♪', 'sweat', 'anger', 'heart', 'zzz']
export const GAME_LINE_LIMIT = 160
/** A story's layers, first to last. `placeholder` (SC3) holds every section, empty and marked to write, so the sandbox
 *  shows every Uma of the cast before her story is picked up. */
export const STATUSES = ['placeholder', 'skeleton', 'outline', 'bible', 'scripted']
export const CHAPTERS = 5
/** The sections every bundle carries; a placeholder has each one present and empty. */
export const SECTIONS = ['title', 'theme', 'tone', 'tale', 'logline', 'premise', 'heroBible', 'bosses', 'links', 'crossings', 'extras', 'chapters', 'scenes']
export const HERO_BIBLE = ['epithet', 'look', 'background', 'motivation', 'goals', 'objectives', 'virtue', 'flaw', 'voice', 'careerEchoes']
const LISTS = new Set(['goals', 'objectives', 'careerEchoes'])
/** The Ranker's batches: tiers T1–T10, one art batch each (uma-platform AP25). */
export const BATCH_TIERS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10']
/** The game's five Ways, by region id (spec §3). Her Way comes from her story class (SC7, Q58), not her running style. */
export const WAY_IDS = ['warrior', 'spellblade', 'mage', 'summoner', 'healer']
/** The game's 76 places (uma-quest's Q22): the Hub, 25 towns `<region>-<band>`, 50 dungeons `<town>a` and `<town>b`. A
 *  scene bound for the game plays at one of them. */
export const PLACE_IDS = new Set(['hub', ...WAY_IDS.flatMap((r) => [1, 2, 3, 4, 5].flatMap((b) => [`${r}-${b}`, `${r}-${b}a`, `${r}-${b}b`]))])
export const isDungeonId = (id) => typeof id === 'string' && /^[a-z]+-[1-5][ab]$/.test(id)
/** The town markers a `talk` trigger can name (the game's own). */
export const TALK_MARKERS = ['inn', 'shop', 'chapter', 'world-map']
/** When a scene plays in the game (uma-quest's Q89): talking at a town marker, arriving in its place, or walking into the
 *  dungeon's boss. Null when the trigger reads, else what's wrong. */
export function triggerProblem(t) {
  if (!object(t)) return 'a trigger is { kind: talk, marker }, { kind: arrive } or { kind: boss }'
  if (t.kind === 'talk') return TALK_MARKERS.includes(t.marker) ? null : `a talk trigger names a marker (${TALK_MARKERS.join(', ')})`
  return t.kind === 'arrive' || t.kind === 'boss' ? null : `unknown trigger ${t.kind}`
}
/** The game's eight starting classes (spec SP21, SP22) a story class maps to. */
export const STARTING_CLASSES = ['Brawler', 'Arms Spellblade', 'Tome Spellblade', 'Sorcerer', 'Tome Summoner', 'Arms Summoner', 'Cleric', 'Paladin']
/** The game's eight face types (D38) a personality maps to. */
export const FACE_TYPES = ['cheery', 'timid', 'serious', 'proud', 'laid-back', 'fiery', 'gentle', 'mischievous']
/** The three tag sets (SC5): each Uma has one tag in each. */
export const TAG_SETS = ['class', 'personality', 'story']
/** No town hosts more than this many stories' chapters, so the stories spread over the whole world (SB16). */
export const TOWN_LIMIT = 4
/** A story's shape (SB20): `racing` is the D36–D44 drafts, whose chapters follow the real careers race by race;
 *  `tourney` is the shape since D45: chapter 1 the junior circuit, chapter 2 the career's climax as a great
 *  tourney, chapters 3–5 new stories. A bundle without a shape is a racing draft. */
export const SHAPES = ['racing', 'tourney']
/** Where a tourney is held: a town of the setting, or beyond the rim, sailing from a band-5 port. */
export const BEYOND = 'beyond'

/** Builds the private pack from the Studio's SS export: its manifest and its board files. */
export function buildPack(manifest, boards, { importedAt, source }) {
  if (!object(manifest) || manifest.schemaVersion !== 1 || manifest.kind !== 'tier-ss-export' || !Array.isArray(manifest.files)) {
    throw new Error('Not a Studio tier export (manifest kind tier-ss-export, schemaVersion 1).')
  }
  const exportedAt = String(manifest.exportedAt ?? '')
  const tier = String(manifest.tier ?? 'SS')
  const id = `${tier.toLowerCase()}-${exportedAt.slice(0, 10) || 'undated'}`
  const franchises = [], characters = [], seen = new Set()
  for (const entry of manifest.files) {
    const board = boards.get(entry.file)
    if (!object(board) || board.kind !== 'tier-board-ss-export' || !Array.isArray(board.characters)) throw new Error(`Missing or invalid board file ${entry.file}`)
    const franchise = board.characters[0]?.franchiseId ?? board.board
    if (!ID.test(franchise)) throw new Error(`Invalid franchise id in ${entry.file}`)
    const role = board.board === 'umas' ? 'hero' : 'boss'
    franchises.push({ id: franchise, board: board.board, title: String(board.franchise ?? entry.franchise ?? franchise), boardTitle: String(board.title ?? entry.title ?? ''), role, count: board.characters.length })
    for (const c of board.characters) {
      if (!object(c) || typeof c.id !== 'string' || !ID.test(c.id) || !text(c.name, 200)) throw new Error(`Invalid character in ${entry.file}`)
      if (seen.has(c.id)) throw new Error(`Duplicate character id ${c.id}`)
      seen.add(c.id)
      characters.push({
        id: c.id, franchise, role, rank: Number(c.rank) || 0, name: c.name,
        ...(c.nameJa ? { nameJa: String(c.nameJa) } : {}),
        details: Array.isArray(c.details) ? c.details.filter((d) => typeof d === 'string').slice(0, 8) : [],
        ...(c.playstyle ? { playstyle: String(c.playstyle) } : {}),
        ...(c.characterId ? { characterId: Number(c.characterId) } : {}),
        ...(object(c.leadOutfit) ? { outfit: { id: Number(c.leadOutfit.outfitId), title: String(c.leadOutfit.title ?? '') } } : {}),
        sources: { publicUrl: String(c.publicUrl ?? ''), pageUrl: String(c.pageUrl ?? ''), imageUrls: object(c.imageUrls) ? { face: String(c.imageUrls.face ?? ''), art: String(c.imageUrls.art ?? '') } : { face: '', art: '' } },
        images: {},
        profile: null,
      })
    }
  }
  if (!franchises.some((f) => f.role === 'hero')) throw new Error('The export has no hero board (umas).')
  return { schemaVersion: 1, kind: 'story-pack', id, tier, exportedAt, importedAt, source, franchises, characters }
}

const bare = (title) => String(title ?? '').replace(/^\[(.*)\]$/, '$1')
const shown = (names) => names?.global ?? names?.en ?? names?.ja ?? ''

/**
 * The Uma Ranker's cast as a story pack (SC1, SC2): every Uma in the ten tiers, a character or a sister, with the one
 * outfit she has there, her tier, batch and place, her other outfits, and a sister's relation, age and profile. The
 * bosses (and their boards) come unchanged from an earlier pack until the boss approach is decided (SC20). Names and
 * outfit titles are the Ranker's (Global text first). Images are the importer's: this only builds the records.
 */
export function buildRankerPack({ plan, profiles, outfits, characters, bosses, importedAt }) {
  if (!object(plan) || plan.kind !== 'tier-plan' || plan.schemaVersion !== 2 || !Array.isArray(plan.identities) || !Array.isArray(plan.boards)) throw new Error('Not a Ranker plan (kind tier-plan, schemaVersion 2).')
  if (!object(profiles) || profiles.kind !== 'uma-profiles' || !Array.isArray(profiles.sisters)) throw new Error('Not the Ranker profiles (kind uma-profiles).')
  const board = plan.boards.find((b) => b.id === 'umas')
  if (!board || !Array.isArray(board.order)) throw new Error('The plan has no Playable Umas board.')
  const tiers = new Set(BATCH_TIERS)
  const placed = new Map(board.order.map((e) => [Number(e.outfitId), e]))
  const outfitById = new Map(outfits.map((o) => [o.id, o]))
  const charById = new Map(characters.map((c) => [c.id, c]))
  const sisters = new Map(profiles.sisters.map((s) => [s.outfitId, s]))
  const titleOf = (id) => placed.get(id)?.title ?? bare(shown(outfitById.get(id)?.title))
  const heroes = []
  for (const i of plan.identities) {
    const cast = (i.outfits ?? []).filter((o) => tiers.has(o.tier))
    if (!cast.length || i.notUsed) continue
    if (cast.length > 1) throw new Error(`Uma ${i.id} has ${cast.length} outfits in the tiers; the story is per Uma, one outfit each (SC1).`)
    const outfitId = cast[0].outfitId, entry = placed.get(outfitId)
    if (!entry) throw new Error(`Outfit ${outfitId} is not on the Playable Umas board.`)
    const sister = i.sister ? sisters.get(outfitId) : null
    if (i.sister && !sister) throw new Error(`Sister ${i.id} has no profile.`)
    const character = charById.get(i.characterId)
    heroes.push({
      id: String(i.id), franchise: 'umas', role: 'hero', rank: entry.order, name: i.name,
      ...(!sister && character?.name?.ja ? { nameJa: character.name.ja } : {}),
      details: [], playstyle: entry.playstyle, characterId: i.characterId,
      outfit: { id: outfitId, title: titleOf(outfitId) },
      tier: cast[0].tier, batch: i.batch, place: entry.order,
      sister: sister ? { relation: sister.relation, age: sister.age, profile: sister.profile, of: String(i.characterId), ofName: shown(character?.name) } : null,
      outfits: (i.outfits ?? []).map((o) => ({ id: o.outfitId, title: titleOf(o.outfitId), tier: o.tier ?? null })),
      sources: { publicUrl: '', pageUrl: `https://gametora.com/umamusume/characters/${i.characterId}`, imageUrls: { face: '', art: '' } },
      images: {}, profile: null,
    })
  }
  heroes.sort((a, b) => a.place - b.place)
  const date = String(plan.generatedAt ?? '').slice(0, 10) || 'undated'
  const bossBoards = (bosses?.franchises ?? []).filter((f) => f.role === 'boss')
  return {
    schemaVersion: 1, kind: 'story-pack', id: `ranker-${date}`, tier: 'T1–T10', exportedAt: String(plan.generatedAt ?? ''), importedAt, source: 'uma-ranker',
    ranker: { boardRevision: board.revision, boardUpdatedAt: board.updatedAt ?? null, profilesRevision: plan.profilesRevision, release: plan.release, planGeneratedAt: plan.generatedAt, bossesFrom: bosses?.id ?? null },
    batches: BATCH_TIERS.map((tier, n) => ({ batch: n + 1, tier, heroes: heroes.filter((h) => h.batch === n + 1).map((h) => h.id) })),
    franchises: [{ id: 'umas', board: 'umas', title: 'Umamusume: Pretty Derby', boardTitle: board.title ?? 'Playable Umas', role: 'hero', count: heroes.length }, ...bossBoards],
    characters: [...heroes, ...(bosses?.characters ?? []).filter((c) => c.role === 'boss')],
  }
}

/** A placeholder bundle (SC3): every section present and empty, five chapters on the tournament shape, the bosses to be
 *  decided (SC20). The page marks each empty section "to write". */
export function placeholderBundle(heroId) {
  return {
    schemaVersion: 1, kind: 'story-bundle', hero: heroId, status: 'placeholder', shape: 'tourney',
    title: null, theme: null, tone: null, tale: null, logline: null, premise: null,
    heroBible: Object.fromEntries(HERO_BIBLE.map((k) => [k, LISTS.has(k) ? [] : null])),
    bosses: [], links: [], crossings: [], extras: [],
    chapters: Array.from({ length: CHAPTERS }, (_, i) => ({ n: i + 1, title: null, city: null, boss: null, careerBeat: null, tourneys: [], summary: null, beats: [] })),
    scenes: [],
  }
}

/**
 * Reads the tags file (Q58, SC5–SC10): the three vocabularies with their mappings (a class to a Way, a starting class
 * and a branch; a personality to a face type; the story types, which are the setting's themes) and each Uma's tag in
 * each set with its reason. Throws on a malformed file; returns { tags, issues } for authoring checks: every Uma of the
 * cast tagged once per set, every tag in its vocabulary, every mapping one the game has, and a written story's type
 * equal to its theme.
 */
export function parseTags(value, { pack, setting = null, bundles = [] }) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-tags' || !object(value.vocabularies) || !object(value.umas)) throw new Error('Not a tags file (schemaVersion 1, kind story-tags).')
  const v = value.vocabularies, issues = []
  for (const key of ['ways', 'classes', 'faces', 'personalities', 'storyTypes']) if (!Array.isArray(v[key])) throw new Error(`The tags file is missing its ${key}.`)
  const ways = new Map(v.ways.map((w) => [w.id, w]))
  for (const id of WAY_IDS) if (!ways.has(id)) issues.push(`the Way ${id} is missing from the vocabulary`)
  const classes = new Map(), personalities = new Map()
  for (const c of v.classes) {
    if (!object(c) || !ID.test(c.id ?? '') || !text(c.name, 40)) { issues.push('a class entry is malformed'); continue }
    if (classes.has(c.id)) issues.push(`class ${c.id} appears twice`)
    classes.set(c.id, c)
    if (!WAY_IDS.includes(c.way)) issues.push(`class ${c.id} maps to ${c.way}, not one of the five Ways`)
    else if (!STARTING_CLASSES.includes(c.start) || !(ways.get(c.way)?.starts ?? []).includes(c.start)) issues.push(`class ${c.id}: ${c.start} is not a starting class of the ${c.way} Way`)
  }
  for (const f of v.faces) if (!FACE_TYPES.includes(f)) issues.push(`face ${f} is not one of the eight face types`)
  for (const p of v.personalities) {
    if (!object(p) || !ID.test(p.id ?? '')) { issues.push('a personality entry is malformed'); continue }
    if (personalities.has(p.id)) issues.push(`personality ${p.id} appears twice`)
    personalities.set(p.id, p)
    if (!FACE_TYPES.includes(p.face)) issues.push(`personality ${p.id} maps to ${p.face}, not one of the eight face types`)
  }
  const themes = new Set((setting?.themes ?? []).map((t) => t.id))
  if (setting) for (const s of v.storyTypes) if (!themes.has(s)) issues.push(`story type ${s} is not one of the setting's themes`)
  const vocab = { class: classes, personality: personalities, story: new Set(v.storyTypes) }
  const heroes = pack.characters.filter((c) => c.role === 'hero').map((c) => c.id)
  for (const id of heroes) {
    const t = value.umas[id]
    if (!object(t)) { issues.push(`${id} has no tags`); continue }
    for (const set of TAG_SETS) {
      const tag = t[set]
      if (!object(tag) || !text(tag.id, 40)) issues.push(`${id} has no ${set} tag`)
      else if (!vocab[set].has(tag.id)) issues.push(`${id}: ${set} ${tag.id} is not in its vocabulary`)
      else if (!text(tag.why, 400)) issues.push(`${id}: her ${set} tag needs a one-line reason`)
    }
  }
  const cast = new Set(heroes)
  for (const id of Object.keys(value.umas)) if (!cast.has(id)) issues.push(`${id} is tagged but not in the cast`)
  // The written stories keep their theme as their story type (SC9).
  for (const b of bundles) {
    const t = value.umas[b?.hero]?.story?.id
    if (b?.status !== 'placeholder' && b?.theme && t && t !== b.theme) issues.push(`${b.hero}: her story type is ${t}, but her written story's theme is ${b.theme}`)
  }
  return { tags: value, issues }
}

/** A circle's kinds (SC12) and a relationship's weights and sources (SC14). The kinds of relationship are the file's. */
export const CIRCLE_KINDS = ['house', 'crop', 'stable', 'field', 'sisters']
export const WEIGHTS = ['major', 'minor']
export const SOURCES = ['real', 'story']
const REL_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** Kinds drawn as family on the page. */
export const FAMILY = ['mother', 'sister', 'twin', 'kin']

/**
 * Reads the relationships file (Q59, SC11–SC16): the eras, each Uma's era, the circles inside the eras, and the
 * relationships. Throws on a malformed file; returns { relationships, issues } for authoring checks: every cast Uma in
 * one era and one home circle of that era, circles of three to eight, every relationship joining two cast Umas once with
 * a stable id, and every written crossing pointing at the relationship for its pair.
 */
export function parseRelationships(value, { pack, bundles = [] }) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-relationships') throw new Error('Not a relationships file (schemaVersion 1, kind story-relationships).')
  for (const key of ['kinds', 'eras', 'circles', 'relationships']) if (!Array.isArray(value[key])) throw new Error(`The relationships file is missing its ${key}.`)
  if (!object(value.umas)) throw new Error('The relationships file is missing its umas.')
  const issues = []
  const cast = new Set(pack.characters.filter((c) => c.role === 'hero').map((c) => c.id))
  const eras = new Set(value.eras.map((e) => e?.id))
  const home = new Map()
  const circleIds = new Set()
  for (const c of value.circles) {
    if (!object(c) || !ID.test(c.id ?? '') || !Array.isArray(c.members)) { issues.push('a circle is malformed'); continue }
    if (circleIds.has(c.id)) issues.push(`circle ${c.id} appears twice`)
    circleIds.add(c.id)
    if (!eras.has(c.era)) issues.push(`circle ${c.id}: era ${c.era} is not one of the eras`)
    if (!CIRCLE_KINDS.includes(c.kind)) issues.push(`circle ${c.id}: kind ${c.kind} should be one of ${CIRCLE_KINDS.join(', ')}`)
    if (c.members.length < 3 || c.members.length > 8) issues.push(`circle ${c.id} has ${c.members.length} Umas; a circle holds three to eight`)
    for (const m of c.members) {
      if (!cast.has(m)) issues.push(`circle ${c.id}: ${m} is not in the cast`)
      home.set(m, [...(home.get(m) ?? []), c])
    }
  }
  for (const id of cast) {
    const u = value.umas[id]
    if (!object(u) || !eras.has(u.era)) issues.push(`${id} has no era`)
    const circles = home.get(id) ?? []
    if (circles.length !== 1) issues.push(circles.length ? `${id} is in ${circles.length} circles (${circles.map((c) => c.id).join(', ')}); one home circle each` : `${id} has no circle`)
    else if (object(u) && circles[0].era !== u.era) issues.push(`${id} is of era ${u.era} but her circle ${circles[0].id} is of ${circles[0].era}`)
  }
  for (const id of Object.keys(value.umas)) if (!cast.has(id)) issues.push(`${id} has an era but is not in the cast`)
  const kinds = new Set(value.kinds), ids = new Set(), pairs = new Map()
  for (const r of value.relationships) {
    if (!object(r) || !REL_ID.test(r.id ?? '')) { issues.push(`a relationship needs a kebab-case id (${r?.id})`); continue }
    if (ids.has(r.id)) issues.push(`relationship ${r.id} appears twice`)
    ids.add(r.id)
    if (!cast.has(r.a) || !cast.has(r.b) || r.a === r.b) issues.push(`relationship ${r.id} should join two Umas of the cast (${r.a}, ${r.b})`)
    const pair = [r.a, r.b].sort().join('|')
    if (pairs.has(pair)) issues.push(`${r.a} and ${r.b} are joined twice (${pairs.get(pair)}, ${r.id}); one relationship a pair`)
    pairs.set(pair, r.id)
    if (!kinds.has(r.kind)) issues.push(`relationship ${r.id}: kind ${r.kind} is not one of the file's kinds`)
    if (!WEIGHTS.includes(r.weight)) issues.push(`relationship ${r.id}: weight should be major or minor`)
    if (!SOURCES.includes(r.source)) issues.push(`relationship ${r.id}: source should be real or story`)
    if (!text(r.line, 400)) issues.push(`relationship ${r.id} needs its one line`)
  }
  // Sisters mirror their siblings (SC23): between two lines (a character and her Ranker sisters), ties go level by level
  // (a sister to a sister) and each one names the tie it mirrors; a sister ties to a character only if she has no sisters.
  const byId = new Map(value.relationships.filter(object).map((r) => [r.id, r]))
  const mainOf = (id) => value.umas[id]?.sisterOf ?? id
  const hasLine = new Set(Object.values(value.umas).map((u) => u?.sisterOf).filter(Boolean))
  for (const r of value.relationships) {
    if (!object(r) || mainOf(r.a) === mainOf(r.b)) continue
    const sa = mainOf(r.a) !== r.a, sb = mainOf(r.b) !== r.b
    if (sa !== sb && hasLine.has(sa ? r.b : r.a)) issues.push(`${r.id}: a sister ties to ${sa ? r.b : r.a}'s line through her sisters, not to her (SC23)`)
    if (sa && sb && !r.mirrors) issues.push(`${r.id}: two sisters of different lines tie only as a mirror of their siblings' tie (SC23)`)
    if (r.mirrors) {
      const m = byId.get(r.mirrors)
      if (!m) issues.push(`${r.id} mirrors ${r.mirrors}, which is not in the file`)
      else if ([m.a, m.b].sort().join('|') !== [mainOf(r.a), mainOf(r.b)].sort().join('|')) issues.push(`${r.id} mirrors ${r.mirrors}, which does not join their siblings`)
    }
  }
  // The written crossings moved in (SC15): each points at the relationship for its pair.
  for (const b of bundles) for (const x of b?.crossings ?? []) {
    if (!object(x)) continue
    const r = byId.get(x.rel)
    if (!x.rel) issues.push(`${b.hero}: her crossing with ${x.hero} points at no relationship`)
    else if (!r) issues.push(`${b.hero}: her crossing with ${x.hero} points at ${x.rel}, which is not in the file`)
    else if ([r.a, r.b].sort().join('|') !== [b.hero, x.hero].sort().join('|')) issues.push(`${b.hero}: her crossing with ${x.hero} points at ${x.rel}, which joins ${r.a} and ${r.b}`)
  }
  return { relationships: value, issues }
}

/** Fewer ties than this flags an Uma as least connected (SC15 asks about four to six an Uma). */
export const FEW_TIES = 4

/**
 * The story cast's counts (Q60, SC17): Umas per class, Way, personality, face type, story type, era and circle, each
 * count with the Umas behind it, in vocabulary order; every Uma ranked by her relationships (total, then major), the
 * least connected and those with no major tie flagged; the personalities that are candidates for a face set of their own.
 */
export function castCounts({ pack, tags = null, relationships = null }) {
  const heroes = pack.characters.filter((c) => c.role === 'hero').map((c) => c.id)
  const v = tags?.vocabularies ?? {}
  const cls = new Map((v.classes ?? []).map((c) => [c.id, c]))
  const per = new Map((v.personalities ?? []).map((p) => [p.id, p]))
  const tagOf = (h, set) => tags?.umas?.[h]?.[set]?.id ?? null
  const count = (id, umas, extra = {}) => ({ id, ...extra, n: umas.length, umas })
  const under = (keyOf, id) => heroes.filter((h) => keyOf(h) === id)
  const ties = new Map(heroes.map((h) => [h, { id: h, total: 0, major: 0, minor: 0, real: 0 }]))
  for (const r of relationships?.relationships ?? []) {
    for (const u of [r.a, r.b]) {
      const t = ties.get(u)
      if (!t) continue
      t.total++
      t[r.weight === 'major' ? 'major' : 'minor']++
      if (r.source === 'real') t.real++
    }
  }
  const ranking = [...ties.values()].sort((a, b) => b.total - a.total || b.major - a.major || a.id.localeCompare(b.id))
    .map((t, i) => ({ ...t, rank: i + 1, few: t.total < FEW_TIES }))
  const personalities = (v.personalities ?? []).map((p) => count(p.id, under((h) => tagOf(h, 'personality'), p.id), { face: p.face, candidate: !!p.candidate }))
  const classes = (v.classes ?? []).map((c) => count(c.id, under((h) => tagOf(h, 'class'), c.id), { name: c.name, way: c.way }))
  return {
    umas: heroes.length,
    relationships: relationships?.relationships?.length ?? 0,
    ways: (v.ways ?? []).map((w) => count(w.id, heroes.filter((h) => cls.get(tagOf(h, 'class'))?.way === w.id), { name: w.name })),
    classes,
    faces: (v.faces ?? []).map((f) => count(f, heroes.filter((h) => per.get(tagOf(h, 'personality'))?.face === f))),
    personalities,
    storyTypes: (v.storyTypes ?? []).map((s) => count(s, under((h) => tagOf(h, 'story'), s))),
    eras: (relationships?.eras ?? []).map((e) => count(e.id, under((h) => relationships.umas?.[h]?.era, e.id), { name: e.name })),
    circles: (relationships?.circles ?? []).map((c) => count(c.id, c.members.filter((m) => ties.has(m)), { name: c.name, era: c.era, kind: c.kind })),
    ranking,
    few: ranking.filter((t) => t.few).map((t) => t.id),
    noMajor: ranking.filter((t) => t.major === 0).map((t) => t.id),
    candidates: personalities.filter((p) => p.candidate),
    unused: { classes: classes.filter((c) => !c.n).map((c) => c.id), personalities: personalities.filter((p) => !p.n).map((p) => p.id) },
  }
}

/** Her relationships, each with the other Uma, the major ones first. */
export function tiesOf(relationships, heroId) {
  return (relationships?.relationships ?? []).filter((r) => r.a === heroId || r.b === heroId)
    .map((r) => ({ ...r, other: r.a === heroId ? r.b : r.a }))
    .sort((x, y) => (x.weight === y.weight ? 0 : x.weight === 'major' ? -1 : 1))
}

/** Her Way from her story class (SC7), or null when she has no valid class tag. */
export function wayOf(tags, heroId) {
  const id = tags?.umas?.[heroId]?.class?.id
  return tags?.vocabularies?.classes?.find((c) => c.id === id)?.way ?? null
}

/** What a bundle still needs written, section by section, for the page's "to write" marks. */
export function toWrite(b) {
  const empty = (v) => v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
  const out = []
  for (const k of ['title', 'logline', 'theme']) if (empty(b?.[k])) out.push(k)
  const bible = HERO_BIBLE.filter((k) => empty(b?.heroBible?.[k]))
  if (bible.length === HERO_BIBLE.length) out.push('bible')
  else if (bible.length) out.push(...bible.map((k) => `bible: ${k}`))
  const open = (b?.chapters ?? []).filter((ch) => empty(ch?.title) || empty(ch?.summary)).length + Math.max(0, CHAPTERS - (b?.chapters?.length ?? 0))
  if (open) out.push(`${open} chapter${open === 1 ? '' : 's'}`)
  if (empty(b?.bosses)) out.push('bosses (to be decided)')
  return out
}

export function parsePack(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-pack' || !Array.isArray(value.characters) || !Array.isArray(value.franchises)) {
    throw new Error('Invalid story pack (schemaVersion 1).')
  }
  for (const c of value.characters) {
    if (!object(c) || !ID.test(c.id) || !text(c.name, 200)) throw new Error('Invalid pack character.')
    for (const path of Object.values(c.images ?? {})) {
      if (typeof path !== 'string' || !/^images\/[A-Za-z0-9._-]+\.(png|webp|jpg)$/.test(path)) throw new Error(`Invalid image path for ${c.id}`)
    }
  }
  return value
}

export function parseSetting(value) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-setting') throw new Error('Invalid setting (schemaVersion 1, kind story-setting).')
  for (const key of ['themes', 'factions', 'regions', 'cities']) if (!Array.isArray(value[key])) throw new Error(`Setting is missing ${key}.`)
  for (const t of value.themes) if (!object(t) || !ID.test(t.id) || !text(t.name, 60)) throw new Error('Invalid theme.')
  for (const c of value.cities) if (!object(c) || !ID.test(c.id) || !text(c.name, 80)) throw new Error('Invalid city.')
  if (!text(value.finale, 40)) throw new Error('Setting needs its finale franchise.')
  return value
}

/** Reads the world pack (SB22): the gazetteer of the setting's towns with their two dungeons, the tourney circuit,
 *  the formats, history and customs. Throws on a malformed file; returns { world, issues } for authoring checks. */
export function parseWorld(value, setting) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-world') throw new Error('Not a world pack (schemaVersion 1, kind story-world).')
  for (const key of ['towns', 'circuit', 'formats']) if (!Array.isArray(value[key])) throw new Error(`The world pack is missing ${key}.`)
  const issues = []
  const cities = new Map((setting?.cities ?? []).map((c) => [c.id, c]))
  const seen = new Set()
  for (const t of value.towns) {
    if (!object(t) || !ID.test(t.id ?? '')) { issues.push('a town entry is malformed'); continue }
    if (seen.has(t.id)) issues.push(`town ${t.id} has two entries`)
    seen.add(t.id)
    const city = cities.get(t.id)
    if (setting && !city) { issues.push(`town ${t.id} is not in the setting`); continue }
    if (!text(t.epithet, 120) || !text(t.look, 1200)) issues.push(`town ${t.id} needs an epithet and a look`)
    if (city?.band != null) for (const d of ['a', 'b']) if (!object(t.dungeons?.[d]) || !text(t.dungeons[d].name, 80) || !text(t.dungeons[d].blurb, 600)) issues.push(`town ${t.id} needs its dungeon ${t.id}${d}, named and described`)
  }
  for (const c of cities.values()) if (!seen.has(c.id)) issues.push(`town ${c.id} has no gazetteer entry`)
  const formats = new Set(value.formats.filter((f) => object(f) && ID.test(f.id ?? '')).map((f) => f.id))
  const ids = new Set()
  for (const e of value.circuit) {
    if (!object(e) || !ID.test(e.id ?? '') || !text(e.name, 120)) { issues.push('a circuit entry is malformed'); continue }
    if (ids.has(e.id)) issues.push(`tourney ${e.id} appears twice`)
    ids.add(e.id)
    if (!Number.isInteger(e.month) || e.month < 1 || e.month > 12) issues.push(`tourney ${e.id} needs a month 1–12`)
    if (!formats.has(e.format)) issues.push(`tourney ${e.id}: format ${e.format} is not in the world's formats`)
    if (e.host === BEYOND) { if (setting && cities.get(e.port)?.band !== 5) issues.push(`tourney ${e.id} is beyond the rim, so it sails from a band-5 port`) }
    else if (setting && !cities.has(e.host)) issues.push(`tourney ${e.id}: host ${e.host} is not a town`)
    if (!text(e.blurb, 800)) issues.push(`tourney ${e.id} needs a blurb`)
  }
  return { world: value, issues }
}

function stepProblems(step, where, cast) {
  const out = []
  if (!object(step) || !STEPS[step.t]) return [`${where}: unknown step ${object(step) ? step.t : step}`]
  const needsSpeaker = step.t === 'line' || step.t === 'thought'
  if (needsSpeaker && !cast.has(step.speaker)) out.push(`${where}: speaker ${step.speaker} is not in the cast`)
  if (step.t === 'emote' && !cast.has(step.actor)) out.push(`${where}: actor ${step.actor} is not in the cast`)
  if (step.t === 'boss' && !cast.has(step.id)) out.push(`${where}: boss ${step.id} is not in the cast`)
  if (['title', 'narrate', 'line', 'thought', 'letter', 'stage'].includes(step.t) && !text(step.text, 2000)) out.push(`${where}: ${step.t} needs text`)
  if (step.emote !== undefined && !EMOTES.includes(step.emote)) out.push(`${where}: unknown emote ${step.emote}`)
  if (step.bubble !== undefined && !BUBBLES.includes(step.bubble)) out.push(`${where}: unknown bubble ${step.bubble}`)
  if (step.t === 'choice') {
    if (!Array.isArray(step.options) || step.options.length < 2 || step.options.length > 4) out.push(`${where}: a choice has 2–4 options`)
    else for (const o of step.options) {
      if (!object(o) || !text(o.text, 120)) out.push(`${where}: a choice option needs text`)
      else if (o.reply && !cast.has(o.reply.speaker)) out.push(`${where}: reply speaker ${o.reply.speaker} is not in the cast`)
    }
  }
  return out
}

/** Reads one bundle. Throws on a malformed file; returns { bundle, issues } where issues are authoring checks. */
export function parseBundle(value, { pack, setting, world = null, tags = null }) {
  if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'story-bundle') throw new Error('Not a story bundle (schemaVersion 1, kind story-bundle).')
  const placeholder = value.status === 'placeholder'
  if (!text(value.hero, 100)) throw new Error('A bundle needs its hero.')
  // A placeholder (SC3) needs only its hero and its sections present; the boss and theme checks (SB3–SB5) skip it.
  if (!placeholder && (!text(value.title, 120) || !text(value.logline, 600))) throw new Error('A bundle needs hero, title and logline.')
  if (!Array.isArray(value.bosses)) throw new Error('A bundle needs its bosses.')
  const issues = []
  const byId = new Map(pack.characters.map((c) => [c.id, c]))
  const hero = byId.get(value.hero)
  if (!hero || hero.role !== 'hero') issues.push(`hero ${value.hero} is not a hero in the pack`)
  if (!STATUSES.includes(value.status)) issues.push(`status should be one of ${STATUSES.join(', ')}`)
  if (value.shape !== undefined && !SHAPES.includes(value.shape)) issues.push(`shape should be one of ${SHAPES.join(', ')}`)
  if (placeholder) {
    for (const k of SECTIONS) if (!(k in value)) issues.push(`the placeholder is missing its ${k}`)
    for (const k of HERO_BIBLE) if (!object(value.heroBible) || !(k in value.heroBible)) issues.push(`the placeholder's bible is missing its ${k}`)
    const ns = (Array.isArray(value.chapters) ? value.chapters : []).map((ch) => ch?.n).join(',')
    if (ns !== '1,2,3,4,5') issues.push('the placeholder needs its five chapters, 1 to 5')
    if (value.title !== null && value.title !== undefined && !text(value.title, 120)) issues.push('the title is too long')
    return { bundle: value, issues }
  }
  if (setting && !setting.themes.some((t) => t.id === value.theme)) issues.push(`theme ${value.theme} is not in the setting`)
  const bossFranchises = pack.franchises.filter((f) => f.role === 'boss').map((f) => f.id)
  const used = new Map()
  const chapters = new Set()
  for (const b of value.bosses) {
    if (!object(b) || !text(b.id, 100)) { issues.push('a boss entry is malformed'); continue }
    const c = byId.get(b.id)
    if (!c || c.role !== 'boss') { issues.push(`boss ${b.id} is not a boss in the pack`); continue }
    if (used.has(c.franchise)) issues.push(`two bosses from ${c.franchise}`)
    used.set(c.franchise, b.id)
    if (!Number.isInteger(b.chapter) || b.chapter < 1 || b.chapter > CHAPTERS) issues.push(`boss ${b.id} needs a chapter 1–${CHAPTERS}`)
    else if (chapters.has(b.chapter)) issues.push(`two bosses in chapter ${b.chapter}`)
    else chapters.add(b.chapter)
    if (!object(b.tie) || !text(b.tie.summary, 1200)) issues.push(`boss ${b.id} needs her tie to the hero`)
    if (b.chapter === CHAPTERS && setting && c.franchise !== setting.finale) issues.push(`the final boss should come from ${setting.finale}`)
  }
  for (const f of bossFranchises) if (!used.has(f)) issues.push(`no boss from ${f}`)
  const cast = new Set([value.hero, ...value.bosses.map((b) => b.id), ...(value.extras ?? []).map((e) => e.id)])
  // A link joins two characters, at least one of them in this bundle; the other may come from another story.
  for (const l of value.links ?? []) {
    if (!object(l) || !byId.has(l.from) || !byId.has(l.to) || (!cast.has(l.from) && !cast.has(l.to)) || !text(l.summary, 1200)) issues.push(`a link is malformed or names someone outside the pack (${l?.from} → ${l?.to})`)
  }
  for (const x of value.crossings ?? []) {
    const other = byId.get(x?.hero)
    if (!other || other.role !== 'hero' || other.id === value.hero) issues.push(`crossing ${x?.hero} is not another hero`)
  }
  const cities = new Set((setting?.cities ?? []).map((c) => c.id))
  for (const ch of value.chapters ?? []) {
    if (ch.city && setting && !cities.has(ch.city)) issues.push(`chapter ${ch.n}: city ${ch.city} is not in the setting`)
    if (ch.boss && !cast.has(ch.boss)) issues.push(`chapter ${ch.n}: boss ${ch.boss} is not in the bundle`)
    const circuit = new Map((world?.circuit ?? []).map((e) => [e.id, e]))
    for (const id of Array.isArray(ch.tourneys) ? ch.tourneys : []) if (world && !circuit.has(id)) issues.push(`chapter ${ch.n}: tourney ${id} is not in the world's circuit`)
  }
  if (STATUSES.indexOf(value.status) >= STATUSES.indexOf('outline')) issues.push(...outlineProblems(value, { hero, setting, world, tags }))
  const sceneIds = new Set()
  for (const s of value.scenes ?? []) {
    if (!object(s) || !ID.test(s.id ?? '') || !Array.isArray(s.steps)) { issues.push('a scene is malformed'); continue }
    if (sceneIds.has(s.id)) issues.push(`scene ${s.id} repeats`)
    sceneIds.add(s.id)
    const sceneCast = new Set(Array.isArray(s.cast) ? s.cast : [])
    for (const who of sceneCast) if (!cast.has(who) && !byId.has(who)) issues.push(`scene ${s.id}: ${who} is not in the pack`)
    s.steps.forEach((step, i) => issues.push(...stepProblems(step, `scene ${s.id} step ${i + 1}`, sceneCast)))
    // Where and when it plays in the game (Q89, SB34).
    if (s.chapter !== undefined && !(Number.isInteger(s.chapter) && s.chapter >= 1 && s.chapter <= CHAPTERS)) issues.push(`scene ${s.id}: chapter should be 1–${CHAPTERS}`)
    if (s.place !== undefined && !PLACE_IDS.has(s.place)) issues.push(`scene ${s.id}: place ${s.place} is not one of the game's 76`)
    if (s.trigger !== undefined) {
      const problem = triggerProblem(s.trigger)
      if (problem) issues.push(`scene ${s.id}: ${problem}`)
      else if (s.trigger.kind === 'boss' && !isDungeonId(s.place)) issues.push(`scene ${s.id}: a boss trigger plays in a dungeon`)
      else if (s.trigger.kind === 'talk' && isDungeonId(s.place)) issues.push(`scene ${s.id}: a talk trigger plays in a town`)
    }
  }
  // A chapter marked `scripted` goes to the game as Q89's chapter file: its scenes need a place each.
  for (const ch of value.chapters ?? []) {
    if (!object(ch) || ch.scripted === undefined) continue
    if (typeof ch.scripted !== 'boolean') { issues.push(`chapter ${ch.n}: scripted is true or false`); continue }
    if (!ch.scripted) continue
    const own = (value.scenes ?? []).filter((s) => object(s) && s.chapter === ch.n)
    if (!own.length) issues.push(`chapter ${ch.n} is marked scripted but has no scenes`)
    for (const s of own) if (s.place === undefined) issues.push(`chapter ${ch.n}: scene ${s.id} needs a place to go to the game`)
    if (ch.dungeon !== undefined && !isDungeonId(ch.dungeon)) issues.push(`chapter ${ch.n}: dungeon ${ch.dungeon} is not one of the game's 50`)
  }
  return { bundle: value, issues }
}

/** The outline layer (status outline and up): five chapters, each in a town of its band, chapter 1 (on the tournament
 *  shape) in her class's Way's first town, each with the boss placed in it, a career beat and three to six beats;
 *  every crossing checked. */
function outlineProblems(value, { hero, setting, world, tags }) {
  const out = []
  const chapters = Array.isArray(value.chapters) ? value.chapters : []
  const towns = new Map((setting?.cities ?? []).map((c) => [c.id, c]))
  const tourney = value.shape === 'tourney'
  const circuit = new Map((world?.circuit ?? []).map((e) => [e.id, e]))
  for (let n = 1; n <= CHAPTERS; n++) {
    const found = chapters.filter((ch) => object(ch) && ch.n === n)
    if (found.length !== 1) { out.push(found.length ? `chapter ${n} appears ${found.length} times` : `chapter ${n} is missing`); continue }
    const ch = found[0]
    if (!text(ch.title, 120)) out.push(`chapter ${n} needs a title`)
    if (!text(ch.summary, 1200)) out.push(`chapter ${n} needs a summary`)
    // On the tournament shape the career lives in chapters 1 and 2 (SB20); chapters 3–5 are new stories.
    if ((!tourney || n <= 2) && !text(ch.careerBeat, 400)) out.push(`chapter ${n} needs its career beat`)
    if (tourney && n <= 2) {
      const list = Array.isArray(ch.tourneys) ? ch.tourneys : []
      if (!list.length) out.push(`chapter ${n} needs its tourneys: the circuit's events it is built on`)
      for (const id of list) {
        const e = circuit.get(id)
        if (!e) continue
        const band = e.host === BEYOND ? 5 : towns.get(e.host)?.band
        if (n === 1 && band !== 1) out.push(`chapter 1's tourney ${id} is held in band ${band ?? '?'}; chapter 1 is the junior circuit, in band 1`)
        if (n === 2 && e.host !== BEYOND && !(band <= 2)) out.push(`chapter 2's tourney ${id} is held in band ${band ?? '?'}; chapter 2's are in bands 1–2 or beyond the rim`)
      }
    }
    if (!Array.isArray(ch.beats) || ch.beats.length < 3 || ch.beats.length > 6 || !ch.beats.every((b) => text(b, 600))) out.push(`chapter ${n} needs three to six beats`)
    const boss = value.bosses.find((b) => object(b) && b.chapter === n)
    if (boss && ch.boss !== boss.id) out.push(`chapter ${n}'s boss should be ${boss.id}, the boss placed in it`)
    if (!setting) continue
    if (!ch.city) { out.push(`chapter ${n} needs a town`); continue }
    const town = towns.get(ch.city)
    if (!town) continue // already named above
    if (town.band !== n) out.push(`chapter ${n} is in ${town.name}, a ${town.band ? `band-${town.band}` : 'hub'} town; it should be in band ${n}`)
    // Her Way comes from her story class (SC7). The racing drafts keep the roads drawn by the old running-style rule
    // until each is rewritten on the tournament shape (SB24), so only that shape is held to it.
    const way = tourney ? wayOf(tags, hero?.id) : null
    if (n === 1 && way && town.region !== way) out.push(`chapter 1 should be in her Way's first town (the ${way} region, for her class ${tags.umas[hero.id].class.id})`)
  }
  for (const x of value.crossings ?? []) if (object(x) && x.checked !== true) out.push(`the crossing with ${x.hero} is not checked against its race yet`)
  return out
}

/** Checks across every bundle: each boss in at most one story, every hero with one, nobody left out, and the towns
 *  spread: none hosts more than TOWN_LIMIT stories' chapters, and once every story has its road, every town hosts one. */
export function crossCheck(pack, bundles, setting = null) {
  const issues = [], bossUse = new Map(), heroUse = new Map(), townUse = new Map(), tourneyUse = new Map()
  for (const b of bundles) {
    heroUse.set(b.hero, [...(heroUse.get(b.hero) ?? []), b.hero])
    for (const boss of b.bosses ?? []) bossUse.set(boss.id, [...(bossUse.get(boss.id) ?? []), b.hero])
    for (const ch of b.chapters ?? []) if (object(ch) && ch.city) townUse.set(ch.city, new Set([...(townUse.get(ch.city) ?? []), b.hero]))
    for (const ch of b.chapters ?? []) for (const id of object(ch) && Array.isArray(ch.tourneys) ? ch.tourneys : []) tourneyUse.set(id, new Set([...(tourneyUse.get(id) ?? []), b.hero]))
  }
  for (const [boss, heroes] of bossUse) if (heroes.length > 1) issues.push(`boss ${boss} is in ${heroes.length} stories (${heroes.join(', ')})`)
  for (const [hero, list] of heroUse) if (list.length > 1) issues.push(`hero ${hero} has ${list.length} bundles`)
  // The spread is planned per shape (SB16, SB24): while the racing drafts are rewritten on the tournament shape, each
  // shape's stories are spread on their own. Quiet towns count once every hero has a story of that shape with a road.
  const townName = new Map((setting?.cities ?? []).map((c) => [c.id, c.name]))
  const heroes = pack.characters.filter((c) => c.role === 'hero').map((c) => c.id)
  for (const shape of SHAPES) {
    const group = bundles.filter((b) => (b.shape ?? 'racing') === shape)
    if (!group.length) continue
    const use = new Map()
    for (const b of group) for (const ch of b.chapters ?? []) if (object(ch) && ch.city) use.set(ch.city, new Set([...(use.get(ch.city) ?? []), b.hero]))
    const label = shape === 'racing' ? '' : ` on the ${shape} shape`
    for (const [town, who] of use) if (who.size > TOWN_LIMIT) issues.push(`${townName.get(town) ?? town} hosts ${who.size} stories' chapters${label} (${[...who].join(', ')}); at most ${TOWN_LIMIT}`)
    const complete = heroes.every((h) => group.some((b) => b.hero === h)) && group.every((b) => b.status !== 'placeholder' && b.chapters?.length)
    const quietHere = (setting?.cities ?? []).filter((c) => c.band != null && !use.has(c.id)).map((c) => townName.get(c.id) ?? c.id)
    if (complete && quietHere.length) issues.push(`no story${label} visits ${quietHere.join(', ')}`)
  }
  const quiet = (setting?.cities ?? []).filter((c) => c.band != null && !townUse.has(c.id)).map((c) => c.id)
  const unassigned = pack.characters.filter((c) => c.role === 'boss' && !bossUse.has(c.id)).map((c) => c.id)
  const unwritten = pack.characters.filter((c) => c.role === 'hero' && !heroUse.has(c.id)).map((c) => c.id)
  return { issues, unassigned, unwritten, towns: Object.fromEntries([...townUse].map(([t, heroes]) => [t, [...heroes]])), quiet,
    tourneys: Object.fromEntries([...tourneyUse].map(([t, heroes]) => [t, [...heroes]])),
    shaped: bundles.filter((b) => b.shape === 'tourney' && b.status !== 'placeholder').length,
    placeholders: bundles.filter((b) => b.status === 'placeholder').length, written: bundles.filter((b) => b.status !== 'placeholder').length }
}

/** Words in a bundle's prose, for the volume table. */
export function wordCount(value) {
  if (typeof value === 'string') return value.trim() ? value.trim().split(/\s+/).length : 0
  if (Array.isArray(value)) return value.reduce((n, v) => n + wordCount(v), 0)
  if (object(value)) return Object.entries(value).reduce((n, [k, v]) => (['id', 'hero', 'speaker', 'actor', 'kind', 't', 'city', 'boss', 'from', 'to', 'theme', 'status', 'schemaVersion', 'cast', 'emote', 'bubble', 'place', 'shape'].includes(k) ? n : n + wordCount(v)), 0)
  return 0
}
