// The Quest library's index: the Ranker's tiers and waves, every chapter with its scenes, the review desk's rows,
// search, and Markdown read as safe blocks. Pure: it reads the state the server sends (or invented fixtures in the
// tests) and holds no name or line of story itself. Served to the page as /library.js.

export const WAVE_SIZE = 5
export const CHAPTER_COUNT = 5
export const VERDICTS = ['liked', 'rework', 'question']
export const VERDICT_LABEL = { liked: 'Liked', rework: 'Rework', question: 'Question', unreviewed: 'Not reviewed' }
const array = (v) => (Array.isArray(v) ? v : [])
const words = (text) => String(text ?? '').split(/\s+/).filter(Boolean).length

/** A chapter's key in `reviews.json`, beside the stories' own (`<hero>`): `<hero>.c<n>`. */
export const chapterKey = (hero, n) => `${hero}.c${n}`
export const parseKey = (key) => { const m = /^(.+)\.c([1-9])$/.exec(String(key)); return m ? { hero: m[1], chapter: Number(m[2]) } : { hero: String(key), chapter: null } }

/**
 * The Ranker's tiers as the pack carries them (`batches`, T1 to T10, each in the board's order), cut into waves of
 * five: wave 1 is Tier 1's first five, wave 2 its other five, wave 3 Tier 2's first five, and so on.
 */
export function tiersOf(pack) {
  return array(pack?.batches).map((b) => ({
    batch: b.batch, tier: b.tier,
    waves: Array.from({ length: Math.ceil(array(b.heroes).length / WAVE_SIZE) }, (_, k) => ({
      wave: (b.batch - 1) * 2 + k + 1, heroes: b.heroes.slice(k * WAVE_SIZE, (k + 1) * WAVE_SIZE),
    })),
  }))
}

/** Where a hero sits: her tier, batch, wave and place in the tier (1–10), or null when the pack doesn't rank her. */
export function placeOf(pack, hero) {
  for (const t of tiersOf(pack)) for (const w of t.waves) {
    const i = w.heroes.indexOf(hero)
    if (i >= 0) return { tier: t.tier, batch: t.batch, wave: w.wave, place: (w.wave - (t.batch - 1) * 2 - 1) * WAVE_SIZE + i + 1 }
  }
  return null
}

/** The words a step shows: its text, a choice's prompt, options and replies, a title's subtitle. */
export function stepText(st) {
  if (!st || typeof st !== 'object') return ''
  return [st.text, st.sub, st.prompt, ...array(st.options).flatMap((o) => [o?.text, o?.reply?.text])].filter((x) => typeof x === 'string').join(' ')
}
export const sceneText = (scene) => array(scene?.steps).map(stepText).filter(Boolean).join(' ')
export const sceneWords = (scene) => words(sceneText(scene))

/** Who speaks or acts in a scene, in order of first appearance. */
export function speakersOf(scene) {
  const out = []
  for (const st of array(scene?.steps)) for (const id of [st?.speaker, st?.actor, st?.t === 'boss' ? st.id : null, ...array(st?.options).map((o) => o?.reply?.speaker)]) {
    if (id !== undefined && id !== null && !out.includes(String(id))) out.push(String(id))
  }
  return out
}

/**
 * A story's five chapters, each with its outline and the scenes written for it, and what the game needs before the
 * chapter can go (SB34): every scene placed, and the chapter marked `scripted`. Scenes with no chapter come last, as
 * chapter null.
 */
export function chaptersOf(bundle) {
  const scenes = array(bundle?.scenes)
  const outline = new Map(array(bundle?.chapters).filter((c) => c && Number.isInteger(c.n)).map((c) => [c.n, c]))
  const out = []
  for (let n = 1; n <= CHAPTER_COUNT; n++) {
    const ch = outline.get(n) ?? { n }
    const own = scenes.filter((s) => s?.chapter === n)
    out.push({
      n, title: ch.title ?? null, city: ch.city ?? null, boss: ch.boss ?? null, summary: ch.summary ?? null, beats: array(ch.beats),
      careerBeat: ch.careerBeat ?? null, tourneys: array(ch.tourneys), scripted: ch.scripted === true, dungeon: ch.dungeon ?? null,
      scenes: own, words: own.reduce((sum, s) => sum + sceneWords(s), 0), unplaced: own.filter((s) => s.place === undefined || s.place === null).length,
    })
  }
  const loose = scenes.filter((s) => !Number.isInteger(s?.chapter) || s.chapter < 1 || s.chapter > CHAPTER_COUNT)
  if (loose.length) out.push({ n: null, title: null, scenes: loose, words: loose.reduce((sum, s) => sum + sceneWords(s), 0), unplaced: loose.length, beats: [], tourneys: [], scripted: false })
  return out
}

/** What a chapter is ready for: written (has scenes), placed (each scene has a place), in the game (marked scripted). */
export function chapterState(ch) {
  if (!ch.scenes.length) return ch.title || ch.summary ? 'outlined' : 'empty'
  if (ch.scripted) return ch.unplaced ? 'scripted-unplaced' : 'scripted'
  return 'written'
}
export const CHAPTER_STATE_LABEL = {
  empty: 'Not outlined', outlined: 'Outline only', written: 'Scenes written', scripted: 'Marked for the game', 'scripted-unplaced': 'Marked, scenes need places',
}

const heroesOf = (data) => array(data?.pack?.characters).filter((c) => c.role === 'hero')
const bundleOf = (data) => new Map(array(data?.bundles).map((b) => [b.bundle?.hero, b]))
const verdictOf = (data, key) => data?.reviews?.items?.[key] ?? null

/** Every story in the Ranker's order with its chapters, for the script library. */
export function libraryRows(data) {
  const bundles = bundleOf(data), byId = new Map(heroesOf(data).map((c) => [c.id, c]))
  const rows = []
  for (const t of tiersOf(data?.pack)) for (const w of t.waves) for (const hero of w.heroes) {
    const entry = bundles.get(hero), c = byId.get(hero)
    if (!c) continue
    const chapters = entry ? chaptersOf(entry.bundle) : []
    rows.push({ hero, tier: t.tier, batch: t.batch, wave: w.wave, status: entry?.bundle.status ?? 'none', shape: entry?.bundle.shape ?? null, title: entry?.bundle.title ?? null,
      chapters, scenes: chapters.reduce((n, ch) => n + ch.scenes.length, 0), words: chapters.reduce((n, ch) => n + ch.words, 0), issues: array(entry?.issues).length })
  }
  return rows
}

/**
 * The review desk: a row for every story that has more than a placeholder, and one for every chapter with scenes,
 * each with its verdict (or "unreviewed"), note and checks.
 */
export function deskRows(data) {
  const rows = []
  for (const r of libraryRows(data)) {
    if (r.status !== 'placeholder' && r.status !== 'none') {
      const v = verdictOf(data, r.hero)
      rows.push({ key: r.hero, kind: 'story', hero: r.hero, chapter: null, tier: r.tier, wave: r.wave, title: r.title, status: r.status, verdict: v?.status ?? 'unreviewed', note: v?.note ?? '', updatedAt: v?.updatedAt ?? null, issues: r.issues })
    }
    for (const ch of r.chapters) {
      if (!ch.scenes.length || ch.n === null) continue
      const key = chapterKey(r.hero, ch.n), v = verdictOf(data, key)
      rows.push({ key, kind: 'chapter', hero: r.hero, chapter: ch.n, tier: r.tier, wave: r.wave, title: ch.title, status: chapterState(ch), verdict: v?.status ?? 'unreviewed', note: v?.note ?? '', updatedAt: v?.updatedAt ?? null, issues: 0 })
    }
  }
  return rows
}

/** Counts of verdicts over desk rows. */
export function verdictCounts(rows) {
  const out = { liked: 0, rework: 0, question: 0, unreviewed: 0 }
  for (const r of rows) out[r.verdict in out ? r.verdict : 'unreviewed']++
  return out
}

const join = (...parts) => parts.flat(Infinity).filter((x) => typeof x === 'string' && x.trim()).join(' ')

/**
 * The search index: stories (their bible), chapters (their outline), scenes (every line), characters, towns,
 * dungeons, tourneys, the world's history and customs, and the bibles. `nameOf` turns an id into a name.
 */
export function buildSearch(data, nameOf = (id) => id) {
  const out = []
  const bundles = bundleOf(data)
  for (const c of heroesOf(data)) {
    out.push({ kind: 'character', id: c.id, title: c.name ?? c.id, detail: [c.tier, c.outfit?.title].filter(Boolean).join(' · '), text: join(c.name, c.outfit?.title, c.sister?.ofName), href: `#/c/${encodeURIComponent(c.id)}` })
    const entry = bundles.get(c.id)
    if (!entry || entry.bundle.status === 'placeholder') continue
    const b = entry.bundle, hb = b.heroBible ?? {}
    out.push({ kind: 'story', id: c.id, title: b.title ?? c.name, detail: [c.name, b.status].filter(Boolean).join(' · '),
      text: join(b.title, b.logline, b.premise, b.tale, b.tone, Object.values(hb), array(b.bosses).flatMap((x) => [x.epithet, x.role, x.tie?.summary, x.background]), array(b.extras).flatMap((x) => [x.name, x.about])),
      href: `#/s/${encodeURIComponent(c.id)}` })
    for (const ch of chaptersOf(b)) {
      if (ch.n !== null && (ch.title || ch.summary)) out.push({ kind: 'chapter', id: chapterKey(c.id, ch.n), title: ch.title ?? `Chapter ${ch.n}`, detail: `${b.title ?? c.name} · chapter ${ch.n}`, text: join(ch.title, ch.summary, ch.beats, ch.careerBeat), href: `#/read/${encodeURIComponent(c.id)}/${ch.n}` })
      for (const s of ch.scenes) out.push({ kind: 'scene', id: `${c.id}/${s.id}`, title: s.title ?? s.id, detail: `${b.title ?? c.name}${ch.n ? ` · chapter ${ch.n}` : ''}`,
        text: join(s.title, s.about, sceneText(s), speakersOf(s).map(nameOf)), href: `#/read/${encodeURIComponent(c.id)}/${ch.n ?? 'other'}#${encodeURIComponent(s.id)}` })
    }
  }
  const world = data?.world
  for (const t of array(world?.towns)) {
    const city = array(data?.setting?.cities).find((x) => x.id === t.id)
    out.push({ kind: 'place', id: t.id, title: city?.name ?? t.id, detail: t.epithet ?? 'Town', text: join(city?.name, t.epithet, t.look, t.people, t.landmarks, t.hooks), href: `#/world` })
    for (const [k, d] of Object.entries(t.dungeons ?? {})) out.push({ kind: 'place', id: `${t.id}${k}`, title: d?.name ?? `${t.id}${k}`, detail: `Dungeon of ${city?.name ?? t.id}`, text: join(d?.name, d?.blurb), href: `#/world` })
  }
  for (const e of array(world?.circuit)) out.push({ kind: 'tourney', id: e.id, title: e.name ?? e.id, detail: [e.grade, e.month ? `month ${e.month}` : null].filter(Boolean).join(' · '), text: join(e.name, e.blurb, e.entry), href: `#/world` })
  for (const x of array(world?.history)) out.push({ kind: 'lore', id: `history-${x.era}`, title: x.era ?? 'History', detail: x.when ?? 'History', text: join(x.era, x.text), href: `#/world` })
  for (const x of array(world?.customs)) out.push({ kind: 'lore', id: `custom-${x.name}`, title: x.name ?? 'Custom', detail: 'Custom', text: join(x.name, x.text), href: `#/world` })
  for (const d of array(data?.bibles)) out.push({ kind: 'bible', id: d.name, title: titleOfMarkdown(d.text) ?? d.name, detail: 'Bible', text: d.text, href: `#/bibles/${encodeURIComponent(d.name)}` })
  return out
}

/** Every entry whose words hold all the query's terms, titles first. */
export function findContent(index, query, kind = 'all', limit = 200) {
  const terms = String(query ?? '').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  return index
    .filter((r) => (kind === 'all' || r.kind === kind) && terms.every((t) => `${r.title} ${r.id} ${r.text}`.toLocaleLowerCase().includes(t)))
    .map((r) => ({ ...r, score: terms.reduce((n, t) => n + (String(r.title).toLocaleLowerCase().includes(t) ? 10 : 0) + 1, 0) }))
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)))
    .slice(0, limit)
}

/** Where a term first appears in a text, with a little on either side. */
export function snippet(text, query, width = 90) {
  const t = String(text ?? ''), first = String(query ?? '').toLocaleLowerCase().trim().split(/\s+/)[0]
  if (!first) return t.slice(0, width * 2)
  const at = t.toLocaleLowerCase().indexOf(first)
  if (at < 0) return t.slice(0, width * 2)
  const from = Math.max(0, at - width), to = Math.min(t.length, at + first.length + width)
  return `${from ? '…' : ''}${t.slice(from, to).trim()}${to < t.length ? '…' : ''}`
}

/** A Markdown file's first heading. */
export function titleOfMarkdown(text) {
  const m = /^\s*#{1,6}\s+(.+?)\s*$/m.exec(String(text ?? ''))
  return m ? m[1] : null
}

/**
 * Markdown as plain blocks for safe rendering: headings, paragraphs, lists, quotes, tables, code and rules. No HTML
 * passes through; the page renders each block's text as text, with bold, code and local links inline.
 */
export function parseMarkdown(text) {
  const blocks = [], lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  let para = [], list = null, quote = [], table = [], code = null
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') }), (para = [])
    if (list) blocks.push(list), (list = null)
    if (quote.length) blocks.push({ type: 'quote', text: quote.join(' ') }), (quote = [])
    if (table.length) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const rows = table.filter((row) => !/^\s*\|?\s*:?-{2,}/.test(row)).map(cells)
      blocks.push({ type: 'table', head: rows[0] ?? [], rows: rows.slice(1) }), (table = [])
    }
  }
  for (const line of lines) {
    if (code) { if (/^\s*```/.test(line)) { blocks.push(code); code = null } else code.text += (code.text ? '\n' : '') + line; continue }
    if (/^\s*```/.test(line)) { flush(); code = { type: 'code', text: '' }; continue }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    const bullet = /^\s*([-*+]|\d+[.)])\s+(.+)$/.exec(line)
    if (heading) { flush(); blocks.push({ type: 'h', level: heading[1].length, text: heading[2] }) }
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); blocks.push({ type: 'hr' }) }
    else if (line.trim().startsWith('|')) { if (!table.length) flush(); table.push(line) }
    else if (/^\s*>/.test(line)) { if (!quote.length) flush(); quote.push(line.replace(/^\s*>\s?/, '')) }
    else if (bullet) {
      const ordered = /\d/.test(bullet[1])
      if (!list || list.ordered !== ordered) { flush(); list = { type: 'list', ordered, items: [] } }
      list.items.push(bullet[2])
    } else if (!line.trim()) flush()
    else if (list && /^\s{2,}\S/.test(line)) list.items[list.items.length - 1] += ` ${line.trim()}`
    else { if (list || quote.length || table.length) flush(); para.push(line.trim()) }
  }
  if (code) blocks.push(code)
  flush()
  return blocks
}

/** Inline Markdown as runs: plain text, **bold**, *italic*, `code`, and links (local `#/` links only stay links). */
export function parseInline(text) {
  const runs = [], re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*?)\*/g
  let at = 0, m
  const s = String(text ?? '')
  while ((m = re.exec(s))) {
    if (m.index > at) runs.push({ type: 'text', text: s.slice(at, m.index) })
    if (m[1] !== undefined) runs.push({ type: 'bold', text: m[1] })
    else if (m[2] !== undefined) runs.push({ type: 'code', text: m[2] })
    else if (m[3] !== undefined) runs.push(m[4].startsWith('#/') ? { type: 'link', text: m[3], href: m[4] } : { type: 'text', text: m[3] })
    else runs.push({ type: 'italic', text: m[5] })
    at = re.lastIndex
  }
  if (at < s.length) runs.push({ type: 'text', text: s.slice(at) })
  return runs
}
