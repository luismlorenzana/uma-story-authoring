// The authored story in the sandbox: the world (what the game will use of world.json, and the world bible), the cast in its order, each Uma's page with her route as a
// visible ladder (27 rungs: her arrival, friendship 1–10, the confession, romance 1–10, the proposal, the wedding,
// spouse 1, 3 and 5), her trigger to meet and her chapters, and the ties as one graph. What the game's reader found shows
// as errors (skipped: the game can't read them) and notes (they block nothing), each with a count.
// Every name, picture and line comes from the private content/story/ at run time.
import { D, h, reviewDot, reviewPanel, stat } from './views.js'

const SVG = 'http://www.w3.org/2000/svg'
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v))
  for (const kid of kids.flat(Infinity)) if (kid) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  return el
}

export function indexStory(story) {
  D.story = story
  D.uma = new Map((story?.umas ?? []).map((u) => [u.id, u]))
  D.person = new Map((story?.people ?? []).map((u) => [u.id, u]))
  D.castOf = new Map((story?.cast?.data?.umas ?? []).map((u, i) => [u.characterId, { ...u, order: i + 1 }]))
  D.bibleOf = new Map((story?.bibles ?? []).map((b) => [b.data.characterId, b]))
  D.routeOf = new Map((story?.routes ?? []).map((r) => [r.data.characterId, r]))
  D.pairsOf = new Map()
  for (const p of story?.pairs ?? []) for (const id of [p.data.a, p.data.b]) D.pairsOf.set(id, [...(D.pairsOf.get(id) ?? []), p])
  D.tiesOf = new Map()
  for (const t of story?.ties?.data?.ties ?? []) for (const id of [t.a, t.b]) D.tiesOf.set(id, [...(D.tiesOf.get(id) ?? []), t])
  D.tagOf = new Map((story?.tags?.data?.tags ?? []).filter((t) => t && typeof t === 'object').map((t) => [t.characterId, t]))
  D.welcome = new Set(story?.welcome ?? [])
}
export const umaName = (id) => D.uma.get(id)?.name ?? id
export function face(id, cls = '') {
  const u = D.uma.get(id)
  if (u?.images?.face) return h('img', { class: `face ${cls}`, src: u.images.face, alt: u.name, loading: 'lazy' })
  return h('span', { class: `face initials ${cls}`, title: u?.name ?? id, text: (u?.name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2) })
}
const CALLING_COLOR = { farming: '#5f9a3c', foraging: '#2f6a34', fishing: '#3a7aa0', mining: '#6a5a4a', quarry: '#8a7a9a' }
const KIND_COLOR = { friends: '#4f8a3c', rivals: '#c4573a', mentor: '#7a5ac4', teammates: '#3a7aa0', sisters: '#c08a22', other: '#8a8478' }
const calling = (c) => (c ? h('span', { class: 'chip dot', vars: { '--c': CALLING_COLOR[c] }, text: c }) : null)
/** A tie's kind and strength as the game reads them: "other" ("Close") and 1 when the pack gives none. */
const kindOf = (t) => t.kind ?? 'other'
const strengthOf = (t) => t.strength ?? 1
const FESTIVAL = { 'flower-show': 'the Flower Show', 'fishing-derby': 'the Fishing Derby', 'cooking-contest': 'the Cooking Contest', 'animal-show': 'the Animal Show', 'harvest-cup': 'the Harvest Cup' }
/** An old `arrives` on a cast entry: retired, so the chip says her `meet` decides now. */
export function arrivalWords(a) {
  return a ? 'arrives: retired, her meet decides' : ''
}
const issuesList = (issues) => (issues?.length ? h('ul', { class: 'issues' }, issues.map((i) => h('li', { text: i }))) : null)
const noStory = () => h('div', { class: 'note-box' }, h('b', { text: 'No story yet. ' }), 'The private story files go in content/story/: any of world.md, world.json, cast.json, ties.json, umas/, routes/, pairs/, household.json, opening.json and town.json. Every part is optional (docs/story-pack.md).')

/** What the game's reader found: errors, which skip only their part (the rest plays), and notes, which block nothing. */
export function findingsBox(found, title = '') {
  const errors = found?.errors ?? [], notes = found?.notes ?? []
  if (!errors.length && !notes.length) return null
  const head = (words) => `${title ? `${title} · ` : ''}${words}`
  return h('div', { class: 'stack' },
    errors.length ? h('div', { class: 'error-box' }, h('b', { text: head(`Skipped · ${errors.length}`) }),
      h('p', { class: 'small', text: 'The game can’t read these, so each skips only its own part: the rest of the pack plays.' }), issuesList(errors)) : null,
    notes.length ? h('details', { class: 'note-box' }, h('summary', {}, h('b', { text: head(`Notes · ${notes.length}`) }), ' They block nothing: open to read them.'), h('ul', { class: 'list small' }, notes.map((n) => h('li', { text: n })))) : null)
}

/** Where the story stands: the cast, what's written of it, and what the game's reader found. */
function layers() {
  const st = D.story, n = st.cast?.data?.umas?.length ?? 0
  return h('div', { class: 'summary' },
    stat(n, 'characters in the cast'),
    stat(`${st.bibles.length}/${n}`, 'bibles'),
    stat(`${st.routes.length}/${n}`, 'routes'),
    stat(st.pairs.length, 'pair conversations'),
    stat(st.ties?.data?.ties?.length ?? 0, 'ties'),
    stat(st.check?.notes?.length ?? 0, 'notes · they block nothing'),
    stat(st.check?.errors?.length ?? 0, 'skipped · the game can’t read them'),
    st.pack ? stat(st.umas.length, `Umas in the export (pack ${st.pack.id})`) : null,
  )
}

/** Her trigger to meet in words: the pack's, or the default. */
function meetWords(m) {
  switch (m?.kind) {
    case 'talks': return `Talk with her on ${m.days} different days`
    case 'gift': return m.good ? `Give her ${m.good}` : 'Give her a gift she likes'
    case 'spot': return `Talk with her at ${m.spot}`
    case 'season': return `Talk with her in ${m.season}`
    case 'festival': {
      // One of the story's own, or one it renames: the year's name for it.
      const named = D.story?.worldPlayed?.festivals?.find((f) => f.id === m.festival && f.name)?.name
      return `Talk with her on ${named ? (/^the\s/i.test(named) ? named : `the ${named}`) : FESTIVAL[m.festival] ?? m.festival}`
    }
    case 'farm-rank': return `Reach Farm Rank ${m.rank}`
    case 'built': return `Build the ${m.place}`
    case 'shipped': return `Ship ${m.count} ${m.good}`
    case 'event': return `After ${m.after}`
    default: return '—'
  }
}

// ── Characters ───────────────────────────────────────────────────────────────
export function charactersView() {
  const st = D.story
  if (!st?.cast) return h('div', {}, h('h1', { text: 'Characters' }), st?.error ? h('div', { class: 'error-box', text: st.error }) : null, noStory())
  const cast = st.cast.data
  return h('div', {},
    h('h1', { text: 'Characters' }),
    h('p', { class: 'muted', text: 'The cast, in its order: as many characters as the story wants, each with as much as is written. Click one for her page, her ties, her route, her trigger to meet and her chapters. Nothing here blocks writing or releasing.' }),
    layers(),
    findingsBox(st.check, 'The pack'),
    cast.umas.length ? null : noStory(),
    h('div', { class: 'cast-list' }, cast.umas.map((u, i) => {
      const ties = D.tiesOf.get(u.characterId) ?? []
      const own = st.own?.[u.characterId]
      return h('a', { class: 'cast-row', href: `#/c/${encodeURIComponent(u.characterId)}` },
        h('span', { class: 'order', text: i + 1 }), face(u.characterId, 'lg'),
        h('div', { class: 'cast-text' },
          h('div', { class: 'row' }, h('b', { text: umaName(u.characterId) }), calling(u.calling), D.welcome.has(u.characterId) ? h('span', { class: 'chip', text: 'welcome list' }) : null,
            u.arrives ? h('span', { class: 'muted small', text: arrivalWords(u.arrives) }) : null, reviewDot(`cast/${u.characterId}`),
            storyChip(u.characterId),
            own?.errors?.length ? h('span', { class: 'warn-text', text: `${own.errors.length} skipped` }) : null,
            own?.notes?.length ? h('span', { class: 'muted small', text: `${own.notes.length} notes` }) : null),
          u.paragraph ? h('p', { class: 'small', text: u.paragraph }) : null,
          h('div', { class: 'row tiny' }, ties.map((t) => { const other = t.a === u.characterId ? t.b : t.a; return h('span', { class: 'tie-chip', vars: { '--c': KIND_COLOR[kindOf(t)] }, title: `${kindOf(t)}, strength ${strengthOf(t)}` }, face(other, 'xs'), `${umaName(other)} ${'●'.repeat(strengthOf(t))}`) })),
        ))
    })),
  )
}

// ── One Uma ──────────────────────────────────────────────────────────────────
export function characterView(id, onReview) {
  const st = D.story
  if (!st?.cast) return noStory()
  const entry = D.castOf.get(id), uma = D.uma.get(id)
  if (!entry) return h('p', { class: 'empty', text: 'Not in the cast.' })
  const bible = D.bibleOf.get(id), ties = [...(D.tiesOf.get(id) ?? [])].sort((a, b) => b.strength - a.strength)
  const list = st.cast.data.umas, prev = list[entry.order - 2], next = list[entry.order]
  return h('div', {},
    h('div', { class: 'char' },
      h('div', { class: 'char-art' }, uma?.images?.art ? h('img', { src: uma.images.art, alt: uma.name }) : face(id, 'xl')),
      h('div', { class: 'stack' },
        h('div', { class: 'row' }, h('span', { class: 'chip', text: `#${entry.order} in the cast` }), calling(entry.calling), D.welcome.has(id) ? h('span', { class: 'chip', text: 'welcome list' }) : null,
          entry.arrives ? h('span', { class: 'chip', text: arrivalWords(entry.arrives) }) : null, entry.outfitId ? h('span', { class: 'chip', text: `Outfit ${entry.outfitId}${uma?.outfit?.title ? ` · ${uma.outfit.title}` : ''}` }) : h('span', { class: 'chip', text: 'No outfit yet' })),
        h('h1', { text: umaName(id) }),
        entry.paragraph ? h('p', { class: 'logline', text: entry.paragraph }) : null,
        h('div', { class: 'row small' }, prev ? h('a', { href: `#/c/${prev.characterId}`, text: `← ${umaName(prev.characterId)}` }) : null, next ? h('a', { href: `#/c/${next.characterId}`, text: `${umaName(next.characterId)} →` }) : null),
        tagPanel(id),
        storyPanel(id),
        placeholderPanel(id),
        menuPanel(entry),
        h('div', { class: 'panel' }, h('div', { class: 'row' }, h('h3', { text: 'Her route' }), h('span', { class: 'muted small', text: bible ? `umas/${id}.json` : 'Her bible can name any of these rungs; none is required' }), routeProgress(id)), ladder(id, bible)),
        scenesPanel(id),
        pairsPanel(id),
        bible ? biblePanel(bible) : null,
        bible ? talkPanel(bible) : null,
        h('div', { class: 'panel' }, h('h3', { text: `Her ties · ${ties.length}` }),
          ties.length ? h('div', { class: 'stack' }, ties.map((t) => {
            const other = t.a === id ? t.b : t.a
            return h('div', { class: 'rel' },
              h('a', { class: 'rel-who', href: `#/c/${other}` }, face(other), h('div', {}, h('b', { text: umaName(other) }), h('span', { class: 'muted small', text: `${kindOf(t)} · ${'●'.repeat(strengthOf(t))}${'○'.repeat(3 - strengthOf(t))}` }))),
              h('div', { class: 'rel-body' }, t.line ? h('p', { text: t.line }) : null, h('p', { class: 'small muted' }, t.source ? h('span', { class: `chip ${t.source === 'real' ? 'dot' : ''}`, text: t.source === 'real' ? 'real' : 'farm-born' }) : null, ' ', t.history ?? '')))
          })) : h('p', { class: 'muted', text: 'No ties yet.' })),
      ),
    ),
    h('div', { class: 'section-head' }, h('h2', { text: 'Review' })),
    reviewPanel(`cast/${id}`, st.own?.[id] ?? { errors: [], notes: [] }, bible ? bible.file : 'content/story/cast.json', onReview, 'Nothing to note: what’s written of her reads whole.'),
  )
}

// ── Her scenes and her pair talks, to read ─────────────────────────────────────
const RUNG_ORDER = ['arrival', ...Array.from({ length: 10 }, (_, i) => `f${i + 1}`), 'invited-to-work', 'confession', ...Array.from({ length: 10 }, (_, i) => `r${i + 1}`), 'proposal', 'wedding', 'wedding-night', 's1', 's3', 's5']
const EVENT_LABEL = { arrival: 'Arrival', 'invited-to-work': 'Invited to work', confession: 'Confession', proposal: 'Proposal', wedding: 'Wedding', 'wedding-night': 'The wedding night', 'dinner-in-town': 'Dinner in town', 'a-night-in': 'A night in', 'new-year': 'The year’s first day', 'flower-show': 'The Flower Show', 'derby-night': 'The Fishing Derby’s night',
  'fishing-derby': 'The Fishing Derby', 'cooking-contest': 'The Cooking Contest', 'harvest-moon': 'The harvest moon', 'animal-show': 'The Animal Show',
  'harvest-cup': 'The Harvest Cup', 'harvest-cup-night': 'The Harvest Cup’s night', 'blossom-viewing': 'Blossom viewing', 'wishing-night': 'The wishing night',
  'first-cold-evening': 'The first cold evening', 'first-snow': 'The first snow', 'longest-night': 'The longest night', 'sweets-day': 'The sweets day',
  birthday: 'Her birthday', anniversary: 'Your anniversary' }
const eventLabel = (id) => EVENT_LABEL[id] ?? (/^f\d+$/.test(id) ? `♥ ${id.slice(1)}` : /^r\d+$/.test(id) ? `❤ ${id.slice(1)}` : /^s\d+$/.test(id) ? `✦ ${id.slice(1)}` : id)
const OUTFIT_LABEL = { season: 'the day’s season', dinner: 'dinner dress', wedding: 'wedding dress', work: 'work clothes', 'garden-party': 'garden party dress', 'wedding-night': 'wedding night' }

/** A scene's steps as text: narration, the farmer's thoughts, lines with their speaker and emote, choices and plays. */
function stepsText(steps) {
  return h('div', { class: 'stack small' }, (steps ?? []).map((st) => {
    if (st.place) return h('p', { class: 'muted', text: `· ${st.place}` })
    if (st.narrate) return h('p', {}, h('i', { text: st.narrate }))
    if (st.thought) return h('p', { class: 'muted' }, h('i', { text: `You think: ${st.thought}` }))
    if (st.say) return h('p', {}, h('b', { text: `${umaName(st.say)}: ` }), st.line, st.emote ? h('span', { class: 'muted', text: ` (${st.emote})` }) : null)
    if (st.choice) return h('ul', { class: 'list' }, st.choice.map((o) => h('li', {}, h('b', { text: `▸ ${o.text}` }),
      h('span', { class: 'muted', text: ` ${[o.tone, o.friendship ? `friendship +${o.friendship}` : '', o.romance ? `romance +${o.romance}` : '', o.answer].filter(Boolean).join(' · ')}` }), o.then ? stepsText(o.then) : null)))
    if (st.play) return h('div', {}, h('p', {}, h('b', { text: `Play: ${st.play.game}` }), st.play.prompt ? ` · ${st.play.prompt}` : ''),
      h('p', { class: 'muted', text: 'If it goes well:' }), stepsText(st.play.good), h('p', { class: 'muted', text: 'If not:' }), stepsText(st.play.miss))
    if (st.when) return h('div', {}, h('p', { class: 'muted', text: `If ${st.when}:` }), stepsText(st.then), st.else ? h('p', { class: 'muted', text: 'Otherwise:' }) : null, st.else ? stepsText(st.else) : null)
    if (st.flag) return h('p', { class: 'muted', text: `(remembers: ${st.flag})` })
    return null
  }))
}

/** Every scene in her route, in rung order then the story's own, each with its outfit and its text. */
function scenesPanel(id) {
  const events = [...(D.routeOf.get(id)?.data.events ?? [])]
  if (!events.length) return null
  const rank = (e) => (RUNG_ORDER.includes(e.id) ? RUNG_ORDER.indexOf(e.id) : RUNG_ORDER.length)
  events.sort((a, b) => rank(a) - rank(b))
  return h('div', { class: 'panel' }, h('div', { class: 'row' }, h('h3', { text: `Her scenes · ${events.length}` }), h('span', { class: 'muted small', text: `routes/${id}.json` })),
    events.map((e) => h('details', {}, h('summary', {}, h('b', { text: eventLabel(e.id) }), ' ', e.outfit ? h('span', { class: 'chip', text: OUTFIT_LABEL[e.outfit] ?? e.outfit }) : null),
      stepsText(e.steps))))
}

/** Her pair conversations: each tie's levels, with the place and the talk. */
function pairsPanel(id) {
  const pairs = D.pairsOf.get(id) ?? []
  if (!pairs.length) return null
  return h('div', { class: 'panel' }, h('h3', { text: `Her pair talks · ${pairs.length}` }),
    pairs.map((p) => {
      const other = p.data.a === id ? p.data.b : p.data.a
      const levels = [...(p.data.levels ?? [])].sort((a, b) => a.hearts - b.hearts)
      return h('details', {}, h('summary', {}, h('b', { text: umaName(other) }), h('span', { class: 'muted small', text: ` · ${levels.length} levels · ${p.file.split('/').pop()}` })),
        levels.map((lv) => h('div', { class: 'stack' }, h('h4', { text: `Bond ♥ ${lv.hearts}${lv.place ? ` · ${lv.place}` : ''}` }, lv.outfit ? h('span', { class: 'chip', text: OUTFIT_LABEL[lv.outfit] ?? lv.outfit }) : null), stepsText(lv.steps))))
    }))
}

// ── Her story, piece by piece: a complete Uma (`story/complete.ts`) ──────────────
const PART_LABEL = { cast: 'Her cast entry', bible: 'Her bible', route: 'Her route' }
const PART_FILE = { cast: () => 'cast.json', bible: (id) => `umas/${id}.json`, route: (id) => `routes/${id}.json` }
const STATE_LABEL = { hers: 'Hers', default: 'Default', missing: 'Missing' }

/** Her story in one chip: all hers, complete (nothing missing), or how many pieces are the default and missing. */
function storyChip(id) {
  const st = D.story?.status?.[id]
  if (!st) return null
  if (st.allHers) return h('span', { class: 'chip dot', text: 'All hers' })
  const sum = (key) => Object.values(st.parts).reduce((n, p) => n + p[key], 0)
  return h('span', { class: `chip ${st.complete ? '' : 'placeholder'}`, title: 'Her pieces: hers · default · missing', text: st.complete ? `Complete · ${sum('default')} default` : `${sum('missing')} missing · ${sum('default')} default` })
}

/** Her story, piece by piece, as `pnpm story:status` shows it: each part's pieces hers, the default ("draft": "default")
 * or missing (the default story plays it), and what's left. */
function storyPanel(id) {
  const st = D.story?.status?.[id]
  if (!st) return null
  const parts = Object.entries(st.parts)
  return h('div', { class: 'panel', 'data-status': id },
    h('div', { class: 'row' }, h('h3', { text: 'Her story' }), storyChip(id)),
    h('p', { class: 'muted small', text: 'Every piece the game reads of her: hers, the default (marked "draft": "default": rewrite it, then remove the marker), or missing (the default story plays it; pnpm story:scaffold lays it out). The same as pnpm story:status.' }),
    h('table', { class: 'written' }, h('thead', {}, h('tr', {}, h('th', { text: '' }), ...['hers', 'default', 'missing'].map((k) => h('th', { text: STATE_LABEL[k] })), h('th', { text: 'File' }))),
      h('tbody', {}, parts.map(([part, c]) => h('tr', { class: c.missing ? 'is-placeholder' : 'is-written' },
        h('th', { text: PART_LABEL[part] ?? part }), h('td', { text: `${c.hers}` }), h('td', { text: `${c.default}` }), h('td', { text: `${c.missing}` }),
        h('td', { class: 'small muted', text: PART_FILE[part]?.(id) ?? '' }))))),
    st.left.length ? h('div', { class: 'stack small' }, h('b', { text: 'What’s left' }), st.left.map((line) => h('p', { text: line }))) : h('p', { class: 'small', text: 'Every piece is hers.' }))
}

/** Her parts as the game plays them: each written by the pack, or a placeholder (what plays instead), marked. */
function placeholderPanel(id) {
  const parts = D.story?.written?.[id] ?? []
  if (!parts.length) return null
  const placeholders = parts.filter((p) => !p.written).length
  return h('div', { class: 'panel', 'data-written': id },
    h('div', { class: 'row' }, h('h3', { text: 'In the game' }),
      h('span', { class: `chip ${placeholders ? '' : 'dot'}`, text: `${parts.length - placeholders} written · ${placeholders} placeholder${placeholders === 1 ? '' : 's'}` })),
    h('p', { class: 'muted small', text: 'What the pack writes of her, and what plays instead where it doesn’t. Placeholders play whole and pay as written: nothing waits on the story.' }),
    h('table', { class: 'written' }, h('tbody', {}, parts.map((p) => h('tr', { class: p.written ? 'is-written' : 'is-placeholder' },
      h('th', { text: p.part }),
      h('td', {}, h('span', { class: `chip ${p.written ? 'dot' : 'placeholder'}`, text: p.written ? 'Written' : 'Placeholder' })),
      h('td', { class: 'small', text: p.plays }))))))
}

/** The welcome list as the game reads it: the cast's `welcome`, else the cast's first five (sisters aside). */
function welcomeList() {
  const cast = D.story?.cast?.data ?? {}
  const named = Array.isArray(cast.welcome) ? cast.welcome : []
  if (named.length > 0) return named
  const size = D.data.game.authored?.defaults?.welcome ?? 5
  return (cast.umas ?? []).map((u) => u.characterId).filter((id) => !String(id).startsWith('s')).slice(0, size)
}
/** 1st, 2nd, 3rd, 4th… */
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

/** Her trigger in words: the welcome list meets on her first talk, at the Gate on her morning; anyone else, the pack's
 * trigger, else the game's default (marked). */
function triggerWords(entry, meet) {
  const at = welcomeList().indexOf(entry.characterId)
  if (at >= 0) return `Her first talk: the welcome list’s ${ordinal(at + 1)}, at the Gate on morning ${at + 1}${entry.meet ? ` (her meet, ${meetWords(entry.meet).toLowerCase()}, isn’t needed)` : ''}`
  return `${meetWords(meet)}${entry.meet ? '' : ' (the default)'}`
}

/** Her trigger to meet and her chapters: the pack's, else the game's defaults (marked). */
function menuPanel(entry) {
  const defaults = D.data.game.authored?.defaults ?? {}
  const meet = entry.meet ?? defaults.meet
  const chapters = entry.chapters?.length ? entry.chapters : defaults.chapters ?? []
  return h('div', { class: 'panel' }, h('h3', { text: 'Meeting her and her chapters' }),
    h('dl', { class: 'kv' },
      h('dt', { text: 'Her trigger to meet' }), h('dd', { text: triggerWords(entry, meet) }),
      h('dt', { text: 'Her chapters' }), h('dd', { text: entry.chapters?.length ? `${entry.chapters.length}, the story’s` : `${chapters.length}, the defaults` })),
    h('ol', { class: 'list small' }, chapters.map((c, i) => h('li', {}, h('b', { text: c.title ?? `Chapter ${i + 1}` }), ` · ${(c.events ?? []).join(', ') || 'no events'}`, c.gate ? h('span', { class: 'muted', text: ` · waits for: ${meetWords(c.gate)}` }) : null))),
    h('p', { class: 'muted small', text: 'Her trigger acts in the game today; her chapters’ screens come next.' }))
}

/** Her 27 rungs as a ladder you can see: her arrival scene, friendship 1–10, the confession, romance 1–10,
 * the proposal, the wedding, and the spouse ladder's three after it. */
function ladder(id, bible) {
  const beats = new Map((bible?.data.route ?? []).map((b) => [b.id, b]))
  const route = D.routeOf.get(id)
  const scripted = new Set((route?.data.events ?? []).map((e) => e.id))
  const rung = (rid, label, cls) => {
    const b = beats.get(rid)
    return h('div', { class: `rung ${cls} ${b ? 'set' : ''} ${scripted.has(rid) ? 'scripted' : ''}`, title: b ? `${b.beat}` : 'To author' },
      h('span', { class: 'rung-label', text: label }),
      h('span', { class: 'rung-text', text: b ? b.beat : 'To author' }),
      b ? h('span', { class: 'rung-meta', text: [b.place, b.together?.kind === 'date' ? `date: ${b.together.game}` : b.together?.kind === 'work' ? `work: ${b.together.activity}` : b.together?.kind, b.unlock ? `unlocks ${b.unlock.good ?? b.unlock.place ?? b.unlock.perk}` : ''].filter(Boolean).join(' · ') }) : null,
      b?.hint ? h('span', { class: 'rung-meta', text: `Opens: ${b.hint}` }) : null)
  }
  return h('div', {},
    h('div', { class: 'ladder-arrival' }, rung('arrival', 'Arrival', 'key')),
    h('div', { class: 'ladder' },
      h('div', { class: 'ladder-col' }, h('h4', { text: 'Friendship ♥ 1–10' }), Array.from({ length: 10 }, (_, i) => rung(`f${i + 1}`, `♥ ${i + 1}`, 'friend'))),
      h('div', { class: 'ladder-mid' }, rung('confession', 'Confession', 'key'), rung('proposal', 'Proposal', 'key'), rung('wedding', 'Wedding', 'key')),
      h('div', { class: 'ladder-col' }, h('h4', { text: 'Romance ❤ 1–10' }), Array.from({ length: 10 }, (_, i) => rung(`r${i + 1}`, `❤ ${i + 1}`, 'romance'))),
    ),
    h('h4', { class: 'spouse-head', text: 'Spouse ✦ after the wedding' }),
    h('div', { class: 'ladder-spouse' }, ['s1', 's3', 's5'].map((rid) => rung(rid, `✦ ${rid.slice(1)}`, 'spouse'))),
  )
}

/** Her everyday talk, to read: her voice, town lines, greetings by time, season, place and weather, small talk and gift
 * lines (the story's own fields, beside the chats the game reads). */
function talkPanel(bible) {
  const b = bible.data
  if (!b.voice && !b.townLines && !b.greetings && !b.smallTalk && !b.giftLines) return null
  const list = (lines) => h('ul', { class: 'list small' }, (lines ?? []).map((l) => h('li', { text: l })))
  const group = (title, obj) => (obj ? h('details', {}, h('summary', { class: 'small', text: `${title} · ${Object.values(obj).flat().length}` }),
    Object.entries(obj).map(([k, lines]) => h('div', {}, h('h4', { text: k }), list(lines)))) : null)
  const g = b.greetings ?? {}
  return h('div', { class: 'panel' }, h('h3', { text: 'Her everyday talk' }),
    b.voice ? h('dl', { class: 'kv' }, ...Object.entries(b.voice).flatMap(([k, v]) => [h('dt', { text: k }),
      h('dd', { text: Array.isArray(v) ? v.join(' · ') : typeof v === 'object' ? Object.entries(v).map(([s, t]) => `${s}: ${t}`).join(' · ') : v })])) : null,
    b.townLines ? h('details', {}, h('summary', { class: 'small', text: `Town lines · ${b.townLines.length}` }), list(b.townLines)) : null,
    group('Greetings by time', g.times), group('Greetings by season', g.seasons), group('Greetings by place', g.places), group('Weather', g.weather),
    g.birthday ? h('details', {}, h('summary', { class: 'small', text: `Her birthday · ${g.birthday.length}` }), list(g.birthday)) : null,
    b.smallTalk ? h('details', {}, h('summary', { class: 'small', text: `Small talk · ${b.smallTalk.length}` }),
      b.smallTalk.map((t) => h('div', { class: 'stack small' }, h('h4', { text: [t.at, t.season, t.stage].filter(Boolean).join(' · ') || 'any time' }),
        t.lines.map(([who, line]) => h('p', {}, h('b', { text: who === 'you' ? 'You: ' : `${umaName(who)}: ` }), line))))) : null,
    group('Gift lines', b.giftLines))
}

function biblePanel(bible) {
  const b = bible.data
  return h('div', { class: 'panel' }, h('h3', { text: 'Her bible' }),
    h('dl', { class: 'kv' },
      ...[['Now', b.now], ['Why the farm', b.whyTheFarm], ['Dream', b.dream], ['Blurb', b.blurb], ['Favourite work', b.favouriteLine], ['Season, festival', b.season || b.festival ? `${b.season ?? '—'}, ${b.festival ?? '—'}` : null],
        ['Loved', b.gifts?.loved], ['Liked', b.gifts?.liked?.join(', ')], ['Disliked', b.gifts?.disliked?.join(', ')], ['Laughs at', b.laughs], ['Hurt by', b.hurts],
        ['Her name for you', b.petName], ['Keepsake', b.keepsake ? `${b.keepsake.name}: “${b.keepsake.line}”` : null], ['Wedding places', b.wedding?.places?.join(', ')],
        ['Wishes', b.wishes?.join(', ')], ['Chats', b.chats ? `${b.chats.friend?.length ?? 0} friend · ${b.chats.partner?.length ?? 0} partner · ${b.chats.spouse?.length ?? 0} spouse` : null]]
        .flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v ?? '—' })])),
    b.chats ? h('details', {}, h('summary', { class: 'small', text: 'Her chat lines' }),
      ['friend', 'partner', 'spouse'].map((set) => h('div', {}, h('h4', { text: set }), h('ul', { class: 'list small' }, (b.chats[set] ?? []).map((l) => h('li', { text: l })))))) : null)
}

/** Her tags: favourite line, season, festival and loved gift, each with its reason. */
function tagPanel(id) {
  const t = D.tagOf?.get(id)
  if (!t) return null
  const row = (label, value, reason) => [h('dt', { text: label }), h('dd', {}, h('b', { text: value }), h('div', { class: 'small muted', text: reason }))]
  return h('div', { class: 'panel' }, h('h3', { text: 'Her tags' }),
    h('dl', { class: 'kv' }, row('Favourite work', t.favouriteLine, t.reasons.favouriteLine), row('Season', t.season, t.reasons.season),
      row('Festival', t.festival, t.reasons.festival), row('Loved gift', `${t.loved}${t.proposed ? ' (proposed)' : ''}`, t.reasons.loved)))
}

/** How far her route is scripted: her arrival scene, then her events, any of them in any order. */
function routeProgress(id) {
  const route = D.routeOf.get(id)
  if (!route) return h('span', { class: 'chip', text: 'Arrival scene to write' })
  const of = D.data.game.authored?.rungs?.length ?? 27
  const scripted = route.data.events.length
  const found = (route.errors?.length ?? 0) + (route.notes?.length ?? 0)
  return h('span', { class: `chip ${scripted ? 'dot' : ''}`, text: `${scripted}/${of} scripted${found ? ` · ${found} notes and skips` : ''}` })
}

// ── Counts ─────────────────────────────────────────────────────────────
export function countsView() {
  const c = D.story?.counts
  if (!c) return h('div', {}, h('h1', { text: 'Counts' }), noStory())
  const who = (ids) => h('div', { class: 'row tiny' }, ids.map((id) => h('a', { class: 'tie-chip', href: `#/c/${id}`, vars: { '--c': '#8a8478' } }, face(id, 'xs'), umaName(id))))
  const table = (title, groups, note) => h('div', { class: 'panel' }, h('h3', { text: title }), note ? h('p', { class: 'small muted', text: note }) : null,
    Object.keys(groups).length ? h('table', { class: 'table' }, Object.entries(groups).map(([k, ids]) => h('tr', {}, h('td', {}, h('b', { text: k })), h('td', { text: ids.length }), h('td', {}, who(ids))))) : h('p', { class: 'muted', text: 'Nothing yet.' }))
  return h('div', {},
    h('h1', { text: 'Counts' }),
    h('p', { class: 'muted', text: 'What the cast, the tag sheet, the ties and the bibles add up to, each with the Umas behind it. Nothing is a quota: read it, and say what to balance.' }),
    h('div', { class: 'summary' },
      stat(c.umas, 'Umas'), stat(`${c.tagged}/${c.umas}`, 'tagged'), stat(c.ties.total, `ties · ${c.ties.real} real · ${c.ties.story} farm-born`),
      stat(`${c.bibles}/${c.umas}`, 'bibles'), stat(c.eventsPer.reduce((n, e) => n + e.scripted, 0), `events scripted of ${c.umas * (c.eventsPer[0]?.of ?? 27)}`),
      stat(c.pairsPer.reduce((n, p) => n + Math.min(p.written, p.of), 0), `pair conversations toward ${c.umas * 2}`)),
    h('div', { class: 'two' },
      h('div', { class: 'stack' },
        table('Callings', c.byCalling, 'From her board playstyle.'),
        table('Favourite work', c.byLine), table('Seasons', c.bySeason), table('Festivals', c.byFestival), table('Loved gifts', c.byLoved),
      ),
      h('div', { class: 'stack' },
        table('Arrivals', c.arrivals),
        h('div', { class: 'panel' }, h('h3', { text: 'Ties an Uma, the least tied first' }), h('table', { class: 'table' },
          h('tr', {}, ['', 'Ties', 'Strength 3', 'Real'].map((x) => h('th', { text: x }))),
          c.tiesPer.map((t) => h('tr', {}, h('td', {}, h('a', { href: `#/c/${t.id}` }, face(t.id, 'sm'), umaName(t.id))), h('td', { text: t.ties }), h('td', { text: t.strong }), h('td', { text: t.real }))))),
        c.bibles ? table('Liked gifts', c.liked) : null,
        c.bibles ? table('Disliked gifts', c.disliked) : null,
        h('div', { class: 'panel' }, h('h3', { text: 'Routes and pairs, an Uma' }), h('table', { class: 'table' },
          h('tr', {}, ['', 'Bible', 'Scripted', 'Pairs'].map((x) => h('th', { text: x }))),
          c.eventsPer.map((e) => { const p = c.pairsPer.find((x) => x.id === e.id); return h('tr', {}, h('td', {}, h('a', { href: `#/c/${e.id}` }, face(e.id, 'sm'), umaName(e.id))), h('td', { text: e.bible ? '✓' : '—' }), h('td', { text: `${e.scripted}/${e.of}` }), h('td', { text: `${p?.written ?? 0}/${p?.of ?? 2}` })) }))),
      ),
    ),
  )
}

// ── Relationships ────────────────────────────────────────────────────────────
export function relationshipsView(onReview) {
  const st = D.story
  if (!st?.ties) return h('div', {}, h('h1', { text: 'Relationships' }), noStory())
  const ties = st.ties.data.ties
  const kinds = [...new Set(ties.map(kindOf))]
  return h('div', {},
    h('h1', { text: 'Relationships' }),
    h('p', { class: 'muted', text: 'The cast’s ties as one graph: who are friends, rivals, mentor and protégée, teammates or sisters in all but name, drawn from their real careers or born on the farm. The thicker the line, the stronger the tie; each Uma’s two strongest get authored pair conversations.' }),
    h('div', { class: 'two' },
      h('div', { class: 'panel' }, ring(ties), h('div', { class: 'row small' }, kinds.map((k) => h('span', { class: 'chip dot', vars: { '--c': KIND_COLOR[k] }, text: `${k} · ${ties.filter((t) => kindOf(t) === k).length}` })))),
      h('div', { class: 'panel' }, h('h3', { text: 'Each Uma’s closest two' }), h('table', { class: 'table' },
        st.cast.data.umas.map((u) => {
          const two = [...(D.tiesOf.get(u.characterId) ?? [])].sort((a, b) => strengthOf(b) - strengthOf(a)).slice(0, 2)
          return h('tr', {}, h('td', {}, h('a', { href: `#/c/${u.characterId}` }, face(u.characterId, 'sm'), umaName(u.characterId))),
            h('td', { class: 'small' }, two.map((t) => { const o = t.a === u.characterId ? t.b : t.a; return h('div', {}, `${umaName(o)} `, h('span', { class: 'muted', text: `${kindOf(t)} ${'●'.repeat(strengthOf(t))}` })) })))
        }))),
    ),
    findingsBox(st.ties, 'ties.json'),
    h('div', { class: 'section-head' }, h('h2', { text: `Every tie · ${ties.length}` })),
    h('div', { class: 'panel' }, h('table', { class: 'table rels' },
      h('tr', {}, ['Between', 'Kind', 'Strength', 'On the farm', 'From'].map((x) => h('th', { text: x }))),
      [...ties].sort((a, b) => strengthOf(b) - strengthOf(a)).map((t) => h('tr', {},
        h('td', {}, h('div', { class: 'pair' }, h('a', { href: `#/c/${t.a}` }, face(t.a, 'sm'), umaName(t.a)), h('span', { class: 'muted', text: '↔' }), h('a', { href: `#/c/${t.b}` }, face(t.b, 'sm'), umaName(t.b)))),
        h('td', {}, h('span', { class: 'chip dot', vars: { '--c': KIND_COLOR[kindOf(t)] }, text: kindOf(t) })),
        h('td', { text: '●'.repeat(strengthOf(t)) + '○'.repeat(3 - strengthOf(t)) }),
        h('td', { class: 'small', text: t.line ?? '' }), h('td', { class: 'small muted', text: t.history ?? '' }))))),
    h('div', { class: 'section-head' }, h('h2', { text: 'Review' })),
    reviewPanel('ties', { errors: st.ties.errors, notes: st.ties.notes }, st.ties.file, onReview, 'Nothing to note: every tie reads whole.'),
  )
}

/** The cast in a ring, in arrival order, their ties drawn between them. */
function ring(ties) {
  const umas = D.story.cast.data.umas.map((u) => u.characterId)
  const W = 600, C = W / 2, R = 240, F = 42
  const at = new Map(umas.map((id, i) => { const t = (i / umas.length) * Math.PI * 2 - Math.PI / 2; return [id, [C + R * Math.cos(t), C + R * Math.sin(t)]] }))
  return s('svg', { viewBox: `0 0 ${W} ${W}`, class: 'ring', role: 'img', 'aria-label': `${umas.length} Umas and ${ties.length} ties` },
    s('circle', { cx: C, cy: C, r: R, class: 'orbit' }),
    ties.filter((t) => at.has(t.a) && at.has(t.b)).map((t) => {
      const [x1, y1] = at.get(t.a), [x2, y2] = at.get(t.b)
      return s('path', { d: `M${x1},${y1} Q${C},${C} ${x2},${y2}`, class: 'edge', stroke: KIND_COLOR[kindOf(t)], 'stroke-width': 1 + strengthOf(t) * 1.3 }, s('title', {}, `${umaName(t.a)} and ${umaName(t.b)}: ${kindOf(t)}.${t.line ? ` ${t.line}` : ''}`))
    }),
    umas.map((id) => {
      const [x, y] = at.get(id), u = D.uma.get(id)
      return s('a', { href: `#/c/${id}` },
        s('clipPath', { id: `clip-${id}` }, s('circle', { cx: x, cy: y, r: F / 2 })),
        s('circle', { cx: x, cy: y, r: F / 2 + 2, class: 'node' }),
        u?.images?.face ? s('image', { href: u.images.face, x: x - F / 2, y: y - F / 2, width: F, height: F, 'clip-path': `url(#clip-${id})` }) : null,
        s('title', {}, umaName(id)))
    }),
  )
}

// ── The world bible ──────────────────────────────────────────────────────────
export function worldView(onReview) {
  const st = D.story
  if (!st?.world && !st?.worldFile && !st?.worldPlayed) return h('div', {}, h('h1', { text: 'The world' }), noStory())
  return h('div', {}, h('h1', { text: 'The world' }), st.cast ? layers() : null,
    worldInGame(st),
    st.world ? h('div', {}, h('div', { class: 'section-head' }, h('h2', { text: 'The world bible' }), h('span', { class: 'muted small', text: 'content/story/world.md · the story’s own: the game never reads it' })),
      h('div', { class: 'panel prose md' }, markdown(st.world)),
      h('div', { class: 'section-head' }, h('h2', { text: 'Review' })),
      reviewPanel('world', [], 'content/story/world.md', onReview, 'The world bible has no automatic checks: your read is the check.')) : null)
}

const SEASON_WORDS = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' }
const RULE_WORDS = { 'flower-show': 'the Flower Show’s', 'fishing-derby': 'the Fishing Derby’s', 'cooking-contest': 'the Cooking Contest’s', 'animal-show': 'the Animal Show’s', 'harvest-cup': 'the Harvest Cup’s' }
const writtenChip = (written) => h('span', { class: `chip ${written ? 'dot' : 'placeholder'}`, text: written ? 'Written' : 'The game’s' })

/** A Town note's unlock in words: meeting someone is another's arrival; none is known from the start. */
function unlockWords(u) {
  if (!u) return 'Known from the start'
  if (u.kind === 'event' && /:arrival$/.test(u.after)) return `On meeting ${umaName(u.after.split(':')[0])}`
  if (u.kind === 'spot') return `A talk at the town’s ${u.spot}`
  if (u.kind === 'festival') return `On ${D.story?.worldPlayed?.festivals?.find((f) => f.id === u.festival)?.name ?? u.festival}’s day`
  return meetWords(u)
}

/** What the game will use of the world: world.json's, else the game's own words, part by part. */
function worldInGame(st) {
  const w = st.worldPlayed
  if (!w) return st.error ? h('div', { class: 'error-box', text: st.error }) : null
  const file = st.worldFile
  return h('div', { class: 'stack', 'data-world-in-game': '' },
    h('div', { class: 'section-head' }, h('h2', { text: 'In the game' }), h('span', { class: 'muted small', text: file ? 'content/story/world.json, as the game reads it' : 'No world.json yet: the game’s own words' })),
    findingsBox(file, 'world.json'),
    h('div', { class: 'panel' },
      h('table', { class: 'written' }, h('tbody', {}, w.parts.map((p) => h('tr', { class: p.written ? 'is-written' : 'is-placeholder' },
        h('th', { text: p.part }), h('td', {}, writtenChip(p.written)), h('td', { class: 'small', text: p.plays })))))),
    h('div', { class: 'panel' }, h('h3', { text: 'Names and the farm’s history' }),
      h('dl', { class: 'kv' },
        h('dt', { text: 'The town' }), h('dd', { text: w.names.town ?? '— (“Town” on the map)' }),
        h('dt', { text: 'The farm' }), h('dd', { text: w.names.farm ?? '— (“The farm”)' }),
        h('dt', { text: 'The region' }), h('dd', { text: w.names.region ?? '—' })),
      w.history.length ? h('div', { class: 'stack small' }, h('p', { class: 'muted', text: 'The Diary’s “The farm” page:' }), w.history.map((line) => h('p', { text: line }))) : h('p', { class: 'muted small', text: 'No history: the Diary’s “The farm” page shows the names only.' })),
    h('div', { class: 'panel' }, h('h3', { text: 'The year’s festivals' }),
      h('p', { class: 'muted small', text: 'In the year’s order, as the calendar, the morning and festival night use them. One of the game’s keeps its rule wherever it falls.' }),
      h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Day', 'Name', 'Its rule', 'What happens'].map((t) => h('th', { text: t })))),
        h('tbody', {}, w.festivals.map((f) => h('tr', { 'data-festival': f.id },
          h('td', { text: `${SEASON_WORDS[f.season]} ${f.day}` }), h('td', {}, h('b', { text: f.name }), h('span', { class: 'muted small', text: ` · ${f.id}` })),
          h('td', { class: 'small', text: f.rule ? `${RULE_WORDS[f.rule]} game rule` : 'The story’s own: a festival day' }),
          h('td', { class: 'small', text: f.happens ?? '—' })))))),
    h('div', { class: 'panel' }, h('h3', { text: `The story’s days · ${(w.days ?? []).length}` }),
      h('p', { class: 'muted small', text: 'Holidays and minor days, as the calendar marks them and the morning names them.' }),
      (w.days ?? []).length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['When', 'Name', 'Kind', 'Line'].map((t) => h('th', { text: t })))),
        h('tbody', {}, w.days.map((d) => h('tr', { 'data-day': d.id },
          h('td', { class: 'small', text: `${d.season ? SEASON_WORDS[d.season] : 'Every season'} ${d.days.join(', ')}` }), h('td', {}, h('b', { text: d.name }), h('span', { class: 'muted small', text: ` · ${d.id}` })),
          h('td', { class: 'small', text: d.kind === 'holiday' ? 'Holiday' : 'Minor day' }), h('td', { class: 'small', text: d.line ?? '—' })))))
        : h('p', { class: 'muted small', text: 'None: the calendar shows the festivals, New Year’s and birthdays.' })),
    h('div', { class: 'panel' }, h('h3', { text: 'Places' }),
      h('p', { class: 'muted small', text: 'Each place’s name on the map and its quick look’s line.' }),
      h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Place', 'Name', 'Line'].map((t) => h('th', { text: t })))),
        h('tbody', {}, w.places.map((p) => h('tr', { class: p.written.name || p.written.line ? '' : 'muted' },
          h('td', { class: 'small', text: p.id }), h('td', {}, p.name, ' ', writtenChip(p.written.name)), h('td', { class: 'small' }, p.line, ' ', writtenChip(p.written.line))))))),
    h('div', { class: 'panel' }, h('h3', { text: 'The seasons' }),
      h('dl', { class: 'kv' }, w.seasons.flatMap((s) => [h('dt', { text: `${SEASON_WORDS[s.season]} begins` }), h('dd', { class: s.line ? '' : 'muted', text: s.line ?? '— (the morning says it alone)' })]))),
    h('div', { class: 'panel' }, h('h3', { text: `Town notes · ${w.notes.length}` }),
      w.notes.length ? h('div', { class: 'stack' }, w.notes.map((n) => h('details', { 'data-note': n.id },
        h('summary', {}, h('b', { text: n.title }), h('span', { class: 'muted small', text: ` · ${unlockWords(n.unlock)} · ${n.id}` })),
        h('div', { class: 'stack small' }, n.lines.map((line) => h('p', { text: line }))))))
        : h('p', { class: 'muted small', text: 'None: the Diary has no Town notes.' })))
}

/** A small Markdown reader for the world bible: headings, quotes, lists, tables, bold, italics and code. */
function markdown(text) {
  const inline = (line) => {
    const out = []
    for (const part of line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)) {
      if (!part) continue
      if (part.startsWith('**')) out.push(h('b', { text: part.slice(2, -2) }))
      else if (part.startsWith('`')) out.push(h('code', { text: part.slice(1, -1) }))
      else if (part.startsWith('*') && part.length > 2) out.push(h('i', { text: part.slice(1, -1) }))
      else out.push(part)
    }
    return out
  }
  const lines = text.split(/\r?\n/), out = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const head = line.match(/^(#{1,3}) (.*)/)
    if (head) { out.push(h(`h${head[1].length}`, {}, inline(head[2]))); i++; continue }
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) { if (!/^\|[\s|:-]+\|$/.test(lines[i])) rows.push(lines[i].slice(1, -1).split('|').map((c) => c.trim())); i++ }
      out.push(h('table', { class: 'table' }, rows.map((r, k) => h('tr', {}, r.map((c) => h(k ? 'td' : 'th', {}, inline(c)))))))
      continue
    }
    if (/^\s*([-*]|\d+\.) /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line), items = []
      while (i < lines.length && (/^\s*([-*]|\d+\.) /.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (/^\s*([-*]|\d+\.) /.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.) /, ''))
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      out.push(h(ordered ? 'ol' : 'ul', { class: 'list' }, items.map((x) => h('li', {}, inline(x)))))
      continue
    }
    if (line.startsWith('>')) {
      const quote = []
      while (i < lines.length && lines[i].startsWith('>')) { quote.push(lines[i].replace(/^>\s?/, '')); i++ }
      out.push(h('blockquote', {}, quote.join(' ').split(/\s{2,}/).map((p) => h('p', {}, inline(p)))))
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#|\||>|\s*([-*]|\d+\.) )/.test(lines[i])) { para.push(lines[i].trim()); i++ }
    out.push(h('p', {}, inline(para.join(' '))))
  }
  return out
}
