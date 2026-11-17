// Views for the Farm Story Sandbox. The town's cast and the lines come from the game's story and the drafts in
// docs/story/; Umas are an invented sample crew filling the roles, renamed only in this browser.

export const D = { data: null }

// ── DOM helpers ───────────────────────────────────────────────────────────────
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.setAttribute('class', v)
    else if (k === 'text') el.textContent = v
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) { if (val) el.style.setProperty(n, val) }
    else if (k === 'value') el.value = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  return el
}
export const stat = (n, label) => h('div', { class: 'stat' }, h('b', { text: n }), h('span', { text: label }))
const bullets = (list) => (list?.length ? h('ul', { class: 'list' }, list.map((x) => h('li', { text: x }))) : null)

// ── Colours: the game's three cast discs (ScenePlayer.tsx), the rest the sandbox's own (discs, not the busts) ────────
const CAST_COLOR = {
  'hollis-pryor': '#6b5aa6', 'marta-quill': '#c4573a', 'ben-carver': '#7a8b3a', 'dale-hart': '#a0703c', 'gus-talbot': '#5f6670', 'rosa-bell': '#c0466e',
  'juno-park': '#2f8a7a', 'ida-stone': '#8a4b2a', 'nils-berg': '#2c5d8a', 'wren-ashby': '#d08a2c', 'cole-varga': '#4d6b3a',
}
export const TEMPERAMENT_COLOR = { breezy: '#3d97cf', steady: '#5f9a3c', bold: '#d0563b', gritty: '#b07a2a', clever: '#7a5ac4' }
const GROUP_SKY = {
  gathering: ['#a8d48f', '#4f8a3c'], station: ['#e2c79a', '#9a7442'], ranch: ['#c9e08f', '#7a9a3a'], workshop: ['#f0c9a0', '#b0623a'],
  yard: ['#e6d6a8', '#9a8450'], town: ['#d8cfc0', '#7a7060'],
}
const PLACE_SKY = { fishery: ['#a6d4ec', '#3a7aa0'], mine: ['#b0a08a', '#4a3e32'], quarry: ['#c4b8a4', '#5e5446'], forest: ['#8fc47a', '#2f6a34'], festival: ['#f4cfa0', '#c0583a'], gate: ['#cfe3a8', '#8a7a4a'] }
export function placeColors(id) {
  const p = D.places?.get(id)
  return PLACE_SKY[id] ?? GROUP_SKY[p?.group] ?? ['#bfe0f5', '#6a8a3a']
}
export const placeName = (id) => (id === 'any' ? 'Any place' : D.places?.get(id)?.name ?? id ?? '')

// ── Data access ───────────────────────────────────────────────────────────────
export function index(data) {
  D.data = data
  D.cast = new Map((data.game.cast ?? []).map((c) => [c.id, c]))
  D.places = new Map((data.game.places ?? []).map((p) => [p.id, p]))
  D.chapters = new Map(data.chapters.map((c) => [c.chapter.chapter, c]))
  D.beats = new Map(data.beats.map((b) => [b.beat.id, b]))
  D.convs = new Map(data.conversations.map((c) => [c.template.id, c]))
}
export const review = (item) => D.data.reviews?.items?.[item]
export const reviewDot = (item) => { const r = review(item); return r?.status ? h('span', { class: `review-dot ${r.status}`, title: `Review: ${r.status}` }) : null }
export const temperaments = () => D.data.game.temperaments?.length ? D.data.game.temperaments : Object.keys(TEMPERAMENT_COLOR)
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')

// ── The sample crew, kept in this browser only ───────────────────────────────────
const CREW_KEY = 'farm-story-sandbox.crew'
export function crew() {
  try {
    const saved = JSON.parse(localStorage.getItem(CREW_KEY) ?? 'null')
    if (Array.isArray(saved) && saved.length === D.data.crew.length) return saved.map((c, i) => ({ ...D.data.crew[i], ...c, id: D.data.crew[i].id }))
  } catch { /* no storage: the defaults */ }
  return D.data.crew.map((c) => ({ ...c }))
}
export function saveCrew(list) { try { localStorage.setItem(CREW_KEY, JSON.stringify(list)) } catch { /* kept for this page only */ } }
export function resetCrew() { try { localStorage.removeItem(CREW_KEY) } catch { /* nothing to clear */ } }

/** Who fills a role when a scene plays here; the player can recast any of them. */
export const castings = new Map()
const ACTIVITY_TEMPERAMENT = { farming: 'steady', ranch: 'gritty', mining: 'bold', fishing: 'clever', foraging: 'breezy', cooking: 'clever', serving: 'breezy', forging: 'bold', expeditions: 'bold' }
export const ROLE_NOUN = { farming: 'farmer', ranch: 'rancher', mining: 'miner', fishing: 'angler', foraging: 'forager', cooking: 'cook', serving: 'server', forging: 'smith', expeditions: 'explorer' }
export function roleKey(speaker) {
  if (speaker.kind === 'first-hand' || speaker.kind === 'team') return `${speaker.kind}:${speaker.index}`
  if (speaker.kind === 'best') return `best:${speaker.activity}`
  return speaker.kind
}
export function roleLabel(key) {
  const [kind, arg] = key.split(':')
  if (kind === 'first-hand') return `Your first hand ${Number(arg) + 1}`
  if (kind === 'team') return `Your team, runner ${Number(arg) + 1}`
  if (kind === 'best') return `Your best ${ROLE_NOUN[arg] ?? arg}`
  if (kind === 'newest-hand') return 'Your newest hand'
  if (kind === 'closest') return 'The Uma you’re closest to'
  if (kind === 'her') return `Her (${arg})`
  return key
}
function defaultUma(key, list) {
  const [kind, arg] = key.split(':')
  if (kind === 'first-hand' || kind === 'team') return list[Number(arg)] ?? list[0]
  if (kind === 'newest-hand') return list.at(-1)
  if (kind === 'best') return list.find((c) => c.best === arg) ?? list.find((c) => c.temperament === ACTIVITY_TEMPERAMENT[arg]) ?? list[0]
  if (kind === 'her') return list.find((c) => c.temperament === arg) ?? list[0]
  return list[0]
}
export function umaFor(key) {
  const list = crew()
  return list.find((c) => c.id === castings.get(key)) ?? defaultUma(key, list)
}

// ── Discs: a lettered disc a person, until the busts ship ───────────────────────────
export const castInitial = (name) => name.replace(/^The /, '').charAt(0).toUpperCase()
export function castDisc(id, size = 40) {
  const c = D.cast.get(id)
  return h('span', { class: 'disc', title: c?.name ?? id, vars: { '--c': CAST_COLOR[id] ?? '#6f6a63', '--s': `${size}px` }, text: c ? castInitial(c.name) : '?' })
}
export const umaDisc = (uma, size = 40) => h('span', { class: 'disc uma', title: `${uma.name} (${uma.temperament})`, vars: { '--c': TEMPERAMENT_COLOR[uma.temperament] ?? '#888', '--s': `${size}px` }, text: (uma.name || '?').charAt(0) })
export const youDisc = (size = 40) => h('span', { class: 'disc you', vars: { '--s': `${size}px` }, text: 'You' })

/** A scene beat's speaker as it plays here: the cast by name, an Uma in her role, or the narrator. */
export function speakerOf(speaker) {
  if (speaker.kind === 'cast') { const c = D.cast.get(speaker.id); return { kind: 'cast', key: `cast:${speaker.id}`, name: c?.name ?? speaker.id, sub: c?.is ?? '', disc: (s) => castDisc(speaker.id, s) } }
  if (speaker.kind === 'narrator') return { kind: 'narrator', key: 'narrator', name: '', sub: '' }
  const key = roleKey(speaker), uma = umaFor(key)
  return { kind: 'uma', key, role: key, uma, name: uma.name, sub: roleLabel(key), disc: (s) => umaDisc(uma, s) }
}
/** A scene line as it plays: a first hand's hello from her temperament, `{name}` filled. */
export function lineOf(beat, who) {
  let line = beat.speaker.kind === 'first-hand' ? D.data.game.hello?.[who.uma.temperament] ?? '“Hello.”' : beat.line
  if (who.uma) line = line.replaceAll('{name}', who.uma.name)
  return line
}

// ── Chapters ──────────────────────────────────────────────────────────────────
function problems() {
  const { data } = D
  return [
    data.game.ok ? null : h('div', { class: 'error-box' }, h('b', { text: 'The game’s story isn’t loaded. ' }), data.game.error, h('div', { class: 'small', text: 'Chapter 1 and the cast come from packages/domain/src; the drafts still show.' })),
    data.errors.length ? h('div', { class: 'error-box' }, h('b', { text: 'Files that did not load' }), h('ul', { class: 'list' }, data.errors.map((e) => h('li', { text: `${e.file}: ${e.error}` })))) : null,
    data.cross.issues.length ? h('div', { class: 'error-box' }, h('b', { text: 'Across the story' }), h('ul', { class: 'list' }, data.cross.issues.map((i) => h('li', { text: i })))) : null,
  ]
}
const playable = (c) => c.chapter.scenes.filter((s) => s.beats.length)
export const chapterColors = (c) => placeColors(c.chapter.place)

export function chaptersView() {
  const { data } = D
  const scenes = data.chapters.flatMap((c) => c.chapter.scenes)
  const lines = scenes.reduce((n, s) => n + s.beats.length, 0)
  const words = data.chapters.reduce((n, c) => n + c.words, 0) +
    data.beats.reduce((n, b) => n + (b.beat.lines ?? []).reduce((m, l) => m + l.text.split(/\s+/).length, 0), 0) +
    data.conversations.reduce((n, c) => n + (c.template.lines ?? []).reduce((m, l) => m + l.text.split(/\s+/).length, 0), 0)
  const conv = data.cross.conversations, convTarget = conv.reduce((n, x) => n + x.target, 0), convDone = conv.reduce((n, x) => n + x.counted, 0)
  const layers = (l) => data.chapters.filter((c) => c.chapter.layer === l).length
  return h('div', {},
    problems(),
    h('div', { class: 'summary' },
      stat(`${layers('built')} · ${layers('scripted')} · ${layers('outline')}`, 'chapters built · scripted · outlined, of 8'),
      stat(`${scenes.filter((s) => s.beats.length).length}/${scenes.length}`, 'scenes you can play'),
      stat(lines, 'scene lines'),
      stat(`${data.cross.beats.scripted}/${data.cross.beats.target}`, `story beats scripted (${data.cross.beats.outlined} outlined)`),
      stat(`${convDone}/${convTarget}`, `conversations toward the target (${data.conversations.length} written)`),
      stat(words.toLocaleString(), 'words written'),
    ),
    h('div', { class: 'road' }, data.chapters.map((c) => h('a', { href: `#/ch/${c.chapter.chapter}` }, h('span', { class: `stop ${c.chapter.layer}`, text: c.chapter.chapter }), h('span', { text: c.chapter.opens })))),
    h('div', { class: 'cards' }, data.chapters.map(chapterCard)),
  )
}

function chapterCard(entry) {
  const c = entry.chapter, [sky, ground] = chapterColors(entry)
  return h('a', { class: 'card', href: `#/ch/${c.chapter}`, vars: { '--sky': sky, '--ground': ground } },
    h('div', { class: 'card-band' }, h('div', { class: 'num', text: c.chapter }),
      h('div', { class: 'tags' }, reviewDot(`chapter-${c.chapter}`), h('span', { class: `badge ${c.layer}`, text: c.layer })),
      h('div', { class: 'discs' }, c.brings.map((id) => castDisc(id, 38)))),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-title', text: c.title }),
      h('div', { class: 'card-sub', text: `Opens ${c.opens}` }),
      h('ol', { class: 'card-goals' }, c.goals.map((g) => h('li', { text: g }))),
      h('div', { class: 'card-foot' },
        h('span', { text: c.scenes.map((s) => (s.source === 'game' ? 'in the game' : s.source === 'draft' ? 'scripted' : 'outline')).join(' · ') }),
        entry.issues.length ? h('span', { class: 'warn-text', text: `${entry.issues.length} checks` }) : null),
    ),
  )
}

// ── One chapter ────────────────────────────────────────────────────────────────
export function chapterView(n, tab, onReview) {
  const entry = D.chapters.get(Number(n))
  if (!entry) return h('p', { class: 'empty', text: `No draft for chapter ${n}.` })
  const c = entry.chapter, [sky, ground] = chapterColors(entry)
  const tabs = [['overview', 'Overview'], ['scenes', `Scenes · ${playable(entry).length}/2 playable`], ['review', `Review${entry.issues.length ? ` · ${entry.issues.length} checks` : ''}`]]
  const prev = D.chapters.get(c.chapter - 1), next = D.chapters.get(c.chapter + 1)
  return h('div', { vars: { '--sky': sky, '--ground': ground } },
    h('div', { class: 'banner' },
      h('div', { class: 'banner-art' }, h('div', { class: 'num', text: c.chapter }), h('div', { class: 'discs' }, c.brings.map((id) => castDisc(id, 52)))),
      h('div', { class: 'banner-text' },
        h('div', { class: 'row' }, h('span', { class: `badge ${c.layer}`, text: c.layer }), h('span', { class: 'chip', text: `Chapter ${c.chapter} of 8` }), c.item ? h('span', { class: 'chip', text: `Story item: ${c.item}` }) : null),
        h('h1', { text: c.title }),
        h('p', { class: 'logline', text: `Opens ${c.opens}, brought by ${c.brings.map((id) => D.cast.get(id)?.name ?? id).join(' and ')}.` }),
        h('div', { class: 'row small muted' }, `${entry.words.toLocaleString()} words`, ' · ', c.source ?? '', ' · ',
          prev ? h('a', { href: `#/ch/${prev.chapter.chapter}/${tab}`, text: `← Chapter ${prev.chapter.chapter}` }) : null,
          next ? h('a', { href: `#/ch/${next.chapter.chapter}/${tab}`, text: `Chapter ${next.chapter.chapter} →` }) : null),
      ),
    ),
    h('nav', { class: 'tabs' }, tabs.map(([id, label]) => h('a', { href: `#/ch/${c.chapter}/${id}`, class: tab === id ? 'on' : '', text: label }))),
    tab === 'scenes' ? scenesTab(entry) : tab === 'review' ? reviewPanel(`chapter-${c.chapter}`, entry.issues, entry.file, onReview, 'No problems: the outline, the goals, every speaker and line, and the recruit at the close.') : overviewTab(entry),
  )
}

function overviewTab(entry) {
  const c = entry.chapter
  const speaking = new Map(), roles = new Set()
  for (const s of c.scenes) for (const b of s.beats) {
    if (b.speaker.kind === 'cast') speaking.set(b.speaker.id, (speaking.get(b.speaker.id) ?? 0) + 1)
    else if (b.speaker.kind !== 'narrator') roles.add(roleKey(b.speaker))
  }
  return h('div', { class: 'two' },
    h('div', { class: 'stack' },
      h('div', { class: 'panel' }, h('h3', { text: 'The goals card' }),
        h('ol', { class: 'goals' }, c.goals.map((g, i) => h('li', {}, h('div', {}, g, c.teaches?.[i] ? h('small', { text: `Teaches: ${c.teaches[i]}` }) : null)))),
        h('p', { class: 'small muted', text: `Reward: ${c.reward}.` })),
      c.scenes.map((s) => h('div', { class: 'panel' },
        h('div', { class: 'scene-head' }, h('h3', { text: s.title }), h('span', { class: 'chip', text: s.kind === 'open' ? 'Opening scene' : 'Closing scene' }), s.place ? h('span', { class: 'chip', text: placeName(s.place) }) : null),
        h('ol', { class: 'list' }, s.outline.map((o) => h('li', { text: o }))),
        s.beats.length ? h('p', {}, h('a', { class: 'btn primary sm', href: `#/play/ch/${c.chapter}/${s.kind}`, text: 'Play it' })) : h('p', { class: 'muted small', text: 'Outline only: no lines yet.' }))),
    ),
    h('div', { class: 'stack' },
      h('div', { class: 'panel' }, h('h3', { text: 'Who’s in it' }),
        speaking.size || roles.size ? h('div', { class: 'who' },
          [...speaking].map(([id, n]) => h('div', {}, castDisc(id, 40), h('div', {}, h('b', { text: D.cast.get(id)?.name ?? id }), `${n} line${n === 1 ? '' : 's'}`))),
          [...roles].map((key) => { const uma = umaFor(key); return h('div', {}, umaDisc(uma, 40), h('div', {}, h('b', { text: roleLabel(key) }), `played here by ${uma.name}`)) }),
        ) : h('p', { class: 'muted', text: 'Nobody speaks yet: the scenes are outlines.' }),
        h('p', { class: 'small muted', text: 'Umas speak only in roles the game fills at run time. Here, the sample crew fills them: rename it on the Town page.' })),
      h('div', { class: 'panel' }, h('h3', { text: 'What it brings' }),
        h('dl', {}, h('dt', { class: 'muted small', text: 'Opens' }), h('dd', { text: c.opens }),
          h('dt', { class: 'muted small', text: 'Brought by' }), h('dd', { text: c.brings.map((id) => `${D.cast.get(id)?.name ?? id}: ${D.cast.get(id)?.is ?? ''}`).join('; ') }),
          c.item ? [h('dt', { class: 'muted small', text: 'Story item' }), h('dd', { text: c.item })] : null,
          h('dt', { class: 'muted small', text: 'Where the beats come from' }), h('dd', { text: c.source ?? '' }))),
    ),
  )
}

function scenesTab(entry) {
  const c = entry.chapter, limit = D.data.limits.scene
  return h('div', {}, c.scenes.map((s) => h('div', { class: 'panel scene' },
    h('div', { class: 'scene-head' },
      h('h3', { text: s.title }),
      h('span', { class: `badge ${s.source === 'game' ? 'built' : s.source === 'draft' ? 'scripted' : 'outline'}`, text: s.source === 'game' ? 'in the game' : s.source === 'draft' ? 'draft' : 'outline' }),
      h('code', { text: s.id }), s.place ? h('span', { class: 'chip', text: placeName(s.place) }) : null,
      s.beats.length ? h('a', { class: 'btn primary sm', href: `#/play/ch/${c.chapter}/${s.kind}`, text: 'Play' }) : null,
      s.file ? h('span', { class: 'muted small', text: s.file }) : null),
    h('div', { class: 'scene-cols' },
      h('div', {}, h('h4', { text: 'Outline' }), h('ol', { class: 'list' }, s.outline.map((o) => h('li', { text: o })))),
      h('div', {}, h('h4', { text: 'Script' }), s.beats.length ? h('table', { class: 'table script-table' }, s.beats.map((b) => {
        const who = speakerOf(b.speaker), line = lineOf(b, who)
        return h('tr', { class: line.length > limit ? 'long' : '' },
          h('td', {}, who.kind === 'narrator' ? h('span', { class: 'muted small', text: 'Narrator' }) : h('span', { class: 'sp' }, who.disc(24), who.kind === 'uma' ? roleLabel(who.role) : who.name)),
          h('td', {}, h('span', { class: who.kind === 'narrator' ? 'muted' : '', text: line }), line.length > limit ? h('div', { class: 'warn-text', text: `${line.length} characters: over the box’s ${limit}` }) : null))
      })) : h('p', { class: 'muted', text: 'No lines yet. The next layer scripts them here, in the game’s own shape, then they move into the game.' })),
    ),
  )))
}

// ── Reviews ──────────────────────────────────────────────────────────────────
/** The Review panel: the owner's verdict, and beside it what the checks found. `issues` is a list (the drafts' checks),
 * or the game's reader's `{ errors, notes }`: errors skip their part, notes block nothing. */
export function reviewPanel(item, issues, file, onReview, clean) {
  const current = review(item) ?? { status: null, note: '' }
  let status = current.status
  const note = h('textarea', { rows: 7 })
  note.value = current.note ?? ''
  note.style.width = '100%'
  const buttons = [['liked', 'I like it'], ['rework', 'Rework'], ['question', 'Question'], [null, 'Clear']]
  const row = h('div', { class: 'row' })
  const draw = () => { row.replaceChildren(...buttons.map(([id, label]) => h('button', { class: `btn ${status === id && id ? 'on' : ''}`, onclick: () => { status = id; draw() }, text: label }))) }
  draw()
  const saved = h('span', { class: 'muted small', text: current.updatedAt ? `Saved ${new Date(current.updatedAt).toLocaleString()}` : '' })
  return h('div', { class: 'two' },
    h('div', { class: 'panel' },
      h('h3', { text: 'Your read' }),
      h('p', { class: 'muted small', text: 'Saved to content/story/reviews.json (private, never in git), so the next writing session reads your verdict first.' }),
      row, h('div', { class: 'section-head' }), note,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { saved.textContent = 'Saving…'; try { await onReview({ item, status, note: note.value }); saved.textContent = 'Saved' } catch (e) { saved.textContent = `Not saved: ${e.message}` } }, text: 'Save note' }), saved),
    ),
    Array.isArray(issues) ? h('div', { class: 'panel' },
      h('h3', { text: 'Authoring checks' }),
      issues.length ? h('ul', { class: 'issues' }, issues.map((i) => h('li', { text: i }))) : h('p', { class: 'muted', text: clean }),
      h('p', { class: 'muted small', text: `File: ${file}` }),
    ) : h('div', { class: 'panel' },
      h('h3', { text: `What the game reads · ${issues.errors.length} skipped · ${issues.notes.length} notes` }),
      issues.errors.length ? h('div', {}, h('h4', { text: 'Skipped: the game can’t read these, so each skips only its part' }), h('ul', { class: 'issues' }, issues.errors.map((i) => h('li', { text: i })))) : null,
      issues.notes.length ? h('div', {}, h('h4', { text: 'Notes: they block nothing' }), h('ul', { class: 'list small' }, issues.notes.map((i) => h('li', { text: i })))) : null,
      issues.errors.length || issues.notes.length ? null : h('p', { class: 'muted', text: clean }),
      h('p', { class: 'muted small', text: `File: ${file}` }),
    ),
  )
}

// ── Cast ─────────────────────────────────────────────────────────────────────
export function castView() {
  const roleUse = new Map()
  for (const e of D.data.chapters) for (const s of e.chapter.scenes) for (const b of s.beats) if (b.speaker.kind !== 'cast' && b.speaker.kind !== 'narrator') {
    const key = roleKey(b.speaker)
    roleUse.set(key, new Set([...(roleUse.get(key) ?? []), e.chapter.chapter]))
  }
  const st = D.story
  const played = st?.townPlayed ?? { people: [], spots: [] }
  const byRole = new Map(played.people.filter((p) => p.role).map((p) => [p.role, p]))
  const keeps = new Map(played.spots.filter((x) => x.keeper).map((x) => [x.keeper, x]))
  const own = new Set((st?.town?.data?.spots ?? []).map((x) => x.id))
  const found = st?.town ? [...(st.town.errors ?? []).map((e) => `Skipped: ${e}`), ...(st.town.notes ?? [])] : []
  /** One of the town's people: her face and name from the cast pack (any board's), else her id. */
  const who = (id) => {
    const u = D.person?.get(id)
    return h('span', { class: 'row' },
      u?.images?.face ? h('img', { class: 'face', src: u.images.face, alt: u.name, loading: 'lazy' }) : h('span', { class: 'face initials', text: (u?.name ?? '?').charAt(0) }),
      h('span', {}, h('b', { text: u?.name ?? id }), u ? h('span', { class: 'muted small', text: ` ${id}` }) : null))
  }
  const extra = played.people.filter((p) => !p.role)
  return h('div', {},
    h('h1', { text: 'The town' }),
    h('p', { class: 'muted', text: 'The town’s people are Umas. town.json names who plays each of the game’s fourteen roles, by her characterId (people[].game is the role); the game shows her master-data name and bust, and a scene’s say by her (or by her role) speaks as her. A role town.json leaves goes to one of master data’s characters in the game. The spots are where people stand: each keeper is usually there, and a cast entry’s spot is her favourite. The menu is docs/story-pack.md.' }),
    st?.town ? null : h('div', { class: 'note-box' }, h('b', { text: 'No town.json yet. ' }), 'The game plays its own six spots, and master data’s characters fill the roles.'),
    found.length ? h('details', { class: 'note-box' }, h('summary', {}, h('b', { text: `town.json · ${found.length} found` })), h('ul', { class: 'list small' }, found.map((n) => h('li', { text: n })))) : null,
    h('div', { class: 'section-head' }, h('h2', { text: 'The town’s people' }), h('span', { class: 'muted small', text: `${played.people.length} named by town.json` })),
    h('div', { class: 'panel' }, h('table', { class: 'table' },
      h('tr', {}, ['Role', 'Played by', 'Does', 'Keeps'].map((x) => h('th', { text: x }))),
      D.data.game.cast.map((c) => {
        const p = byRole.get(c.id)
        return h('tr', {},
          h('td', {}, h('b', { text: c.role ?? c.name }), h('div', { class: 'muted small' }, h('code', { text: c.id }))),
          h('td', {}, p ? who(p.characterId) : h('span', { class: 'muted', text: 'Master data’s, in the game' })),
          h('td', { text: p?.does ?? c.is }),
          h('td', { text: p && keeps.get(p.characterId) ? keeps.get(p.characterId).name : '—' }))
      }),
      extra.map((p) => h('tr', {},
        h('td', {}, h('span', { class: 'muted', text: 'The story’s own' })), h('td', {}, who(p.characterId)), h('td', { text: p.does }),
        h('td', { text: keeps.get(p.characterId)?.name ?? '—' }))))),
    h('div', { class: 'section-head' }, h('h2', { text: 'The spots' }), h('span', { class: 'muted small', text: 'A spot trigger names one by its id' })),
    h('div', { class: 'panel' }, h('table', { class: 'table' },
      h('tr', {}, ['Spot', 'Name', 'Its line', 'Keeper', 'From'].map((x) => h('th', { text: x }))),
      played.spots.map((x) => h('tr', {},
        h('td', {}, h('code', { text: x.id })), h('td', {}, h('b', { text: x.name })), h('td', { text: x.blurb }),
        h('td', {}, x.keeper ? who(x.keeper) : h('span', { class: 'muted', text: 'Master data’s, in the game' })),
        h('td', {}, h('span', { class: `badge ${own.has(x.id) ? 'game' : 'new'}`, text: own.has(x.id) ? 'town.json' : 'the game’s own' })))))),
    h('div', { class: 'section-head' }, h('h2', { text: 'Umas in roles' })),
    h('div', { class: 'panel' }, h('table', { class: 'table' },
      h('tr', {}, ['Role', 'Who fills it in the game', 'In the game today', 'Used in chapters'].map((x) => h('th', { text: x }))),
      Object.entries(D.data.speakers).filter(([, v]) => v.uma).map(([kind, v]) => h('tr', {},
        h('td', {}, h('code', { text: kind })), h('td', { text: v.about }),
        h('td', {}, h('span', { class: `badge ${v.game ? 'game' : 'new'}`, text: v.game ? 'plays today' : 'sandbox first' })),
        h('td', { text: [...roleUse].filter(([k]) => k.split(':')[0] === kind).flatMap(([, s]) => [...s]).filter((x, i, a) => a.indexOf(x) === i).join(', ') || '—' }))))),
    h('div', { class: 'section-head' }, h('h2', { text: 'The sample crew' }), h('span', { class: 'muted small', text: 'Kept in this browser only, never in a file' })),
    crewEditor(),
  )
}

function crewEditor() {
  const list = crew()
  const wrap = h('div', { class: 'panel crew' })
  const options = (values, current) => values.map((v) => h('option', { value: v, selected: v === current ? true : null, text: v }))
  const draw = () => {
    wrap.replaceChildren(
      h('p', { class: 'muted small', text: 'These five play every role: your first hands are the first three, your newest hand the last, and “your best …” the one whose best activity it is. Put real names here to read a scene with them; they stay in this browser.' }),
      h('div', { class: 'crew-row head' }, h('span'), h('span', { text: 'Name' }), h('span', { text: 'Temperament' }), h('span', { text: 'Calling' }), h('span', { text: 'Distance' }), h('span', { text: 'Best at' })),
      list.map((c, i) => {
        const set = (k) => (e) => { list[i] = { ...list[i], [k]: e.target.value }; saveCrew(list); draw() }
        return h('div', { class: 'crew-row' }, umaDisc(c, 38),
          h('input', { type: 'text', value: c.name, maxlength: 40, onchange: set('name'), 'aria-label': 'Name' }),
          h('select', { onchange: set('temperament'), 'aria-label': 'Temperament' }, options(temperaments(), c.temperament)),
          h('select', { onchange: set('calling'), 'aria-label': 'Calling' }, options(D.data.game.callings ?? [], c.calling)),
          h('select', { onchange: set('distance'), 'aria-label': 'Distance' }, options(D.data.distances, c.distance)),
          h('select', { onchange: set('best'), 'aria-label': 'Best at' }, options(D.data.game.activities ?? [], c.best)))
      }),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { resetCrew(); list.splice(0, list.length, ...crew()); draw() }, text: 'Back to the sample crew' }),
        h('a', { class: 'btn', href: '#/characters', text: 'The real characters' })),
    )
  }
  draw()
  return wrap
}

// ── The farm ─────────────────────────────────────────────────────────────────
export function farmView(selected) {
  const places = D.data.game.places ?? []
  const scenesAt = new Map(), convAt = new Map()
  for (const e of D.data.chapters) for (const s of e.chapter.scenes) if (s.place) scenesAt.set(s.place, [...(scenesAt.get(s.place) ?? []), { chapter: e.chapter.chapter, scene: s }])
  for (const c of D.data.conversations) convAt.set(c.template.place, (convAt.get(c.template.place) ?? 0) + 1)
  const opens = (o) => (o.by === 'start' ? 'Open from day 1' : o.by === 'chapter' ? `Chapter ${o.chapter}` : o.by === 'reward' ? `Chapter ${o.chapter}’s reward` : o.by === 'farm-rank' ? `Farm Rank ${o.rank}` : 'Not built yet')
  const rows = [...new Set(places.map((p) => p.row))].sort((a, b) => a - b)
  const LABEL = { 1: 'Gathering · stations · the ranch and workshops', 6: 'The yard', 8: 'The town edge' }
  const pick = places.find((p) => p.id === selected)
  return h('div', {},
    h('h1', { text: 'The farm' }),
    h('p', { class: 'muted', text: 'The map’s 23 places as the game has them: what opens each, the scenes set there, and the conversations that can play there. Click a place.' }),
    h('div', { class: 'farm' },
      h('div', { class: 'map' }, rows.map((r) => [LABEL[r] ? h('div', { class: 'row-label', text: LABEL[r] }) : null,
        places.filter((p) => p.row === r).sort((a, b) => a.col - b.col).map((p) => {
          const [sky, ground] = placeColors(p.id), sc = scenesAt.get(p.id) ?? []
          return h('a', { class: `place ${p.id === selected ? 'on' : ''}`, href: `#/farm/${p.id}`, vars: { '--sky': sky, '--ground': ground } },
            h('div', { class: 'marks' }, [...new Set(sc.map((x) => x.chapter))].map((n) => h('span', { class: 'mark c', title: `Chapter ${n}’s scene`, text: n })), convAt.get(p.id) ? h('span', { class: 'mark', title: 'Conversations here', text: `💬${convAt.get(p.id)}` }) : null),
            h('b', { text: p.name }), h('span', { class: 'opens', text: opens(p.opens) }))
        })])),
      h('div', { class: 'stack' },
        pick ? h('div', { class: 'panel' }, h('h3', { text: pick.name }), h('p', { text: pick.blurb }), h('p', { class: 'small muted', text: `${cap(pick.group)} · ${opens(pick.opens)}` }),
          h('h4', { text: 'Scenes set here' }), (scenesAt.get(pick.id) ?? []).length ? h('ul', { class: 'list' }, scenesAt.get(pick.id).map((x) => h('li', {}, h('a', { href: `#/ch/${x.chapter}/scenes`, text: `Chapter ${x.chapter}: ${x.scene.title}` })))) : h('p', { class: 'muted small', text: 'None yet.' }),
          h('h4', { text: 'Conversations' }), h('p', { class: 'small' }, `${convAt.get(pick.id) ?? 0} written for this place; `, h('a', { href: '#/bonds', text: 'the coverage' }), '.'))
          : h('div', { class: 'panel' }, h('h3', { text: 'The chapters open the farm' }),
            h('ol', { class: 'list' }, D.data.chapters.map((e) => h('li', {}, h('a', { href: `#/ch/${e.chapter.chapter}`, text: e.chapter.title }), `: ${e.chapter.opens}`)))),
      ),
    ),
  )
}

// ── The format ───────────────────────────────────────────────────────────────
export function formatView() {
  const used = new Map()
  for (const e of D.data.chapters) for (const s of e.chapter.scenes) for (const b of s.beats) used.set(b.speaker.kind, (used.get(b.speaker.kind) ?? 0) + 1)
  const first = D.data.chapters.find((e) => playable(e).length)
  return h('div', {},
    h('h1', { text: 'The format' }),
    h('div', { class: 'note-box' }, h('b', { text: 'The story pack is a menu, not a checklist. ' }),
      'docs/story-pack.md lists everything the game can read from content/story/, what each part does in play, and what plays when it’s missing. Every part is optional and any number of characters is fine. The game skips only a part it can’t read (an error); everything else is a note, and nothing blocks writing or releasing.'),
    h('p', { class: 'muted', text: 'What a chapter draft holds, in the game’s own shapes, so it moves into the game as it is. Green plays in uma-farm today; amber is what the sandbox tries first.' }),
    first ? h('p', {}, h('a', { class: 'btn primary', href: `#/play/ch/${first.chapter.chapter}/${playable(first)[0].kind}`, text: `Play a scene from chapter ${first.chapter.chapter}` })) : null,
    h('div', { class: 'two' },
      h('div', { class: 'stack' },
        h('div', { class: 'panel' }, h('h3', { text: 'Who speaks a scene’s beat' }), h('p', { class: 'small muted', text: 'A beat is the game’s Beat: { speaker, line }, one line to a tap (story/bench.ts).' }),
          h('table', { class: 'table' }, h('tr', {}, ['Speaker', 'Plays as', 'In the game', 'Used'].map((x) => h('th', { text: x }))),
            Object.entries(D.data.speakers).map(([k, v]) => h('tr', {}, h('td', {}, h('code', { text: k })), h('td', { text: v.about }), h('td', {}, h('span', { class: `badge ${v.game ? 'game' : 'new'}`, text: v.game ? 'plays today' : 'sandbox first' })), h('td', { text: used.get(k) ?? 0 }))))),
        h('div', { class: 'panel' }, h('h3', { text: 'Lines' }), h('ul', { class: 'list' },
          h('li', { text: `A scene’s spoken line is “quoted”, as the game’s are; narration isn’t. At most ${D.data.limits.scene} characters (chapter 1’s longest is 118); longer ones are flagged.` }),
          h('li', { text: `A story beat’s or conversation’s line is a bubble: no quotes, at most ${D.data.limits.bubble} characters.` }),
          h('li', { text: 'Placeholders: {name} (an Uma’s line in a scene; her name in a story beat), {farm}; in conversations {a}, {b}, {place}, {item}, {farm}. Names are filled at run time, never written.' }),
          h('li', { text: 'A first hand’s line stays empty: she says her temperament’s hello. A cast member speaks from the chapter that brings them; an earlier line may name them.' }),
        )),
      ),
      h('div', { class: 'stack' },
        h('div', { class: 'panel' }, h('h3', { text: 'A chapter, from line to built' }),
          h('ol', { class: 'list' },
            h('li', {}, h('b', { text: 'line' }), ': its one line: the title, what it opens, its goals.'),
            h('li', {}, h('b', { text: 'outline' }), ': each of its two scenes in three to six beats, with the place, who brings it, the reward and the story item.'),
            h('li', {}, h('b', { text: 'scripted' }), ': both scenes in the game’s Beat shape, played here, read by you; the closing scene has the recruit and names who opens the next chapter.'),
            h('li', {}, h('b', { text: 'built' }), ': the lines live in packages/domain/src/story/; the sandbox plays the game’s own, and flags a draft that differs.'),
          )),
        h('div', { class: 'panel' }, h('h3', { text: 'Bonds' }), h('ul', { class: 'list' },
          h('li', { text: 'Story beats: five a temperament, at 2, 4, 6, 8 and 10 hearts of your affinity, lines by her and by you. 25 in all.' }),
          h('li', { text: `Conversations: at each bond heart 1–5, chosen by place, then the pair’s temperaments, callings and distances, both orders tried, the same pair always the same. Target: ${D.data.target.any} any-place and ${D.data.target.place} a work place, per heart: 250.` }),
        )),
        h('div', { class: 'panel small' }, h('h3', { text: 'Files' }), h('ul', { class: 'list' },
          h('li', {}, h('code', { text: 'docs/story/chapters/chapter-<n>.json' }), ': one a chapter'),
          h('li', {}, h('code', { text: 'docs/story/beats.json' }), ', ', h('code', { text: 'docs/story/conversations.json' })),
          h('li', {}, h('code', { text: 'content/story/reviews.json' }), ': your reads, written by the Review panels (private, ignored by git)'),
          h('li', {}, h('code', { text: 'packages/domain/src/story/' }), ': the game’s story as built, read in place'),
        )),
      ),
    ),
  )
}
