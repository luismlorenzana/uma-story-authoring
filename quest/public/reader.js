// The Quest library's reading views: the overview, the script library and chapter reader, the story as the game
// reads it, the review desk with every check, search, and the bibles. Every name and line comes from the private
// state at run time; the index itself is lib/library.mjs (served as /library.js).
import { D, face, h, who } from './views.js'
import {
  buildSearch, chapterKey, chaptersOf, chapterState, CHAPTER_STATE_LABEL, deskRows, findContent, libraryRows, parseInline, parseKey,
  parseMarkdown, placeOf, snippet, speakersOf, tiersOf, titleOfMarkdown, verdictCounts, VERDICT_LABEL,
} from './library.js'

let searchIndex = null
export function prepareReader() { searchIndex = null }
const indexOf = () => (searchIndex ??= buildSearch(D.data, (id) => who(id).name))

// ── Small parts ───────────────────────────────────────────────────────────────
const nameOf = (id) => who(id).name
const storyTitle = (hero) => D.bundles.get(hero)?.bundle.title ?? nameOf(hero)
const cityName = (id) => D.cities.get(id)?.name ?? placeName(id)
function placeName(id) {
  if (!id) return ''
  const town = D.data.world?.towns?.find((t) => id.startsWith(t.id) && /^[ab]$/.test(id.slice(t.id.length)))
  const dungeon = town?.dungeons?.[id.slice(town.id.length)]
  return dungeon?.name ?? D.cities.get(id)?.name ?? id
}
const header = (title, lede, eyebrow) => h('header', { class: 'lib-head' }, eyebrow ? h('p', { class: 'eyebrow', text: eyebrow }) : null, h('h1', { text: title }), lede ? h('p', { class: 'lede', text: lede }) : null)
const panel = (title, ...kids) => h('section', { class: 'panel lib-panel' }, title ? h('h2', { text: title }) : null, ...kids)
const empty = (text) => h('p', { class: 'empty', text })
const stat = (n, label, href) => h(href ? 'a' : 'div', { class: 'stat', href }, h('b', { text: n }), h('span', { text: label }))
const verdictDot = (v) => h('span', { class: `review-dot ${v}`, title: VERDICT_LABEL[v] ?? v })
const stateChip = (state) => h('span', { class: `lib-state ${state}`, text: CHAPTER_STATE_LABEL[state] ?? state })
export function subnav(items, active) {
  return h('nav', { class: 'subnav', 'aria-label': 'This section' }, items.map(([id, label, href]) => h('a', { href, class: id === active ? 'on' : '', 'aria-current': id === active ? 'page' : null, text: label })))
}
export const characterNav = (active) => subnav([['cast', 'Cast', '#/cast'], ['tags', 'Tags', '#/tags'], ['counts', 'Counts', '#/counts']], active)
export const worldNav = (active) => subnav([['world', 'World', '#/world'], ['bibles', `Bibles · ${D.data.bibles?.length ?? 0}`, '#/bibles']], active)

/** Markdown as DOM, text only: no HTML from the file reaches the page, and only local `#/` links stay links. */
export function markdown(text) {
  const inline = (s) => parseInline(s).map((r) => r.type === 'bold' ? h('strong', { text: r.text }) : r.type === 'italic' ? h('em', { text: r.text })
    : r.type === 'code' ? h('code', { text: r.text }) : r.type === 'link' ? h('a', { href: r.href, text: r.text }) : r.text)
  return h('div', { class: 'prose lib-prose' }, parseMarkdown(text).map((b) => {
    if (b.type === 'h') return h(`h${Math.min(6, b.level + 1)}`, {}, inline(b.text))
    if (b.type === 'p') return h('p', {}, inline(b.text))
    if (b.type === 'quote') return h('blockquote', {}, inline(b.text))
    if (b.type === 'list') return h(b.ordered ? 'ol' : 'ul', { class: 'list' }, b.items.map((i) => h('li', {}, inline(i))))
    if (b.type === 'code') return h('pre', {}, h('code', { text: b.text }))
    if (b.type === 'hr') return h('hr')
    if (b.type === 'table') return h('div', { class: 'scroll' }, h('table', { class: 'table' }, h('tr', {}, b.head.map((c) => h('th', {}, inline(c)))), b.rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, inline(c)))))))
    return null
  }))
}

/** A verdict with its note, saved to reviews.json under `key` (a story's hero id, or `<hero>.c<n>` for a chapter). */
export function verdictPanel(key, onReview, title = 'Your read') {
  const current = D.data.reviews?.items?.[key] ?? { status: null, note: '' }
  let status = current.status
  const note = h('textarea', { rows: 6, class: 'lib-note', 'aria-label': 'Your note' })
  note.value = current.note ?? ''
  const row = h('div', { class: 'row' })
  const buttons = [['liked', 'I like it'], ['rework', 'Rework'], ['question', 'Question'], [null, 'Clear']]
  const draw = () => row.replaceChildren(...buttons.map(([id, label]) => h('button', { class: `btn ${status === id && id ? 'on' : ''}`, onclick: () => { status = id; draw() }, text: label })))
  draw()
  const saved = h('span', { class: 'muted small', text: current.updatedAt ? `Saved ${new Date(current.updatedAt).toLocaleString()}` : '' })
  return h('div', { class: 'panel review' },
    h('h3', { text: title }), row, note,
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => {
      saved.textContent = 'Saving…'
      try { await onReview({ hero: key, status, note: note.value }); saved.textContent = 'Saved' } catch (e) { saved.textContent = `Not saved: ${e.message}` }
    }, text: 'Save' }), saved),
    h('p', { class: 'muted small', text: 'Saved to content/quest/stories/reviews.json, so the next session reads it before it writes.' }))
}

// ── Overview ──────────────────────────────────────────────────────────────────
export function overviewView() {
  const data = D.data, rows = libraryRows(data), desk = deskRows(data), verdicts = verdictCounts(desk)
  const written = rows.filter((r) => r.status !== 'placeholder' && r.status !== 'none')
  const chaptersWithScenes = rows.reduce((n, r) => n + r.chapters.filter((c) => c.n && c.scenes.length).length, 0)
  const checks = checkGroups().reduce((n, g) => n + g.items.length, 0)
  const game = data.game
  return h('div', { class: 'lib' },
    header('Uma Quest · Story library', 'Every story, chapter and scene of the Quest book, in the Ranker\'s order: read them, play them, leave a verdict, and see what the game reads.', 'Overview'),
    h('div', { class: 'summary' },
      stat(rows.length, 'Umas in the cast', '#/cast'),
      stat(written.length, 'stories written', '#/stories'),
      stat(rows.length - written.length, 'to write', '#/stories'),
      stat(chaptersWithScenes, 'chapters with scenes', '#/library'),
      stat(rows.reduce((n, r) => n + r.scenes, 0), 'scenes', '#/library'),
      stat(rows.reduce((n, r) => n + r.words, 0).toLocaleString(), 'words in scenes', '#/library'),
      stat(desk.length - verdicts.unreviewed, `of ${desk.length} reviewed`, '#/review'),
      stat(checks, checks === 1 ? 'check to clear' : 'checks to clear', '#/review/checks'),
    ),
    h('div', { class: 'two' },
      panel('The roadmap', data.roadmap ? markdown(data.roadmap)
        : h('div', {}, empty('No roadmap yet.'), h('p', { class: 'muted small', text: 'Write content/quest/stories/roadmap.md (Markdown) and it shows here: the story plan, what is next, and what waits on whom.' }))),
      h('div', {},
        panel('In the game', gameSummary(game), h('p', {}, h('a', { href: '#/game', text: 'What the game reads →' }))),
        panel('Your verdicts', h('div', { class: 'row' }, ['liked', 'rework', 'question', 'unreviewed'].map((v) => h('a', { class: 'chip', href: `#/review/${v}` }, verdictDot(v), `${VERDICT_LABEL[v]} · ${verdicts[v]}`))),
          h('p', {}, h('a', { href: '#/review', text: 'The review desk →' }))),
      ),
    ),
    panel('Where it stands, tier by tier', tierBoard()),
  )
}

function gameSummary(game) {
  if (!game) return empty('The game read is off.')
  const pk = game.pack
  const lines = []
  if (!game.parsers.ok) lines.push(h('p', { class: 'warn small', text: game.parsers.error }))
  if (pk.ok) {
    lines.push(h('ul', { class: 'list' },
      h('li', { text: `Exported ${new Date(pk.builtAt).toLocaleString()}` }),
      h('li', { text: pk.cast ? `Cast: ${pk.cast.count} travelers, ${pk.cast.intros} intros, ${pk.cast.recruits} recruit lines` : 'Cast: the game\'s ten known travelers stand in' }),
      h('li', { text: pk.opening ? `Opening: ${pk.opening.scenes.reduce((n, s) => n + s.steps.length, 0)} steps` : 'Opening: the placeholder' }),
      h('li', { text: pk.world ? `Place names: ${pk.world.places}` : 'Place names: the game\'s own' }),
      h('li', { text: `Chapters: ${pk.chapters.length}` }),
    ))
    if (pk.problems.length) lines.push(h('p', { class: 'warn small', text: `${pk.problems.length} problem${pk.problems.length === 1 ? '' : 's'} the game notes` }))
  } else lines.push(h('p', { class: 'muted small', text: pk.error }))
  const ex = game.export
  if (ex.ok) lines.push(h('p', { class: 'small muted', text: `${ex.chapters.length} chapter${ex.chapters.length === 1 ? '' : 's'} marked for the game in the stories now.` }))
  return h('div', {}, lines)
}

function tierBoard() {
  const pack = D.data.pack, tiers = tiersOf(pack)
  if (!tiers.length) return empty('The pack has no Ranker tiers.')
  const cell = (hero) => {
    const b = D.bundles.get(hero)?.bundle, v = D.data.reviews?.items?.[hero]?.status
    const scenes = b?.scenes?.length ?? 0
    return h('a', { class: `tier-uma ${b?.status ?? 'none'}`, href: `#/s/${encodeURIComponent(hero)}`, title: `${nameOf(hero)}${b?.title ? ` · ${b.title}` : ''} · ${b?.status ?? 'no bundle'}${b?.shape === 'tourney' ? ' · tournament shape' : b && b.status !== 'placeholder' ? ' · racing draft' : ''}${scenes ? ` · ${scenes} scenes` : ''}` },
      face(who(hero), 'sm'), v ? verdictDot(v) : null, scenes ? h('span', { class: 'tier-scenes', text: scenes }) : null)
  }
  return h('div', { class: 'scroll' }, h('table', { class: 'table tier-board' },
    h('tr', {}, ['Tier', 'Wave', 'The five, in the Ranker\'s order', 'Written', 'Tournament shape', 'Chapters with scenes'].map((x) => h('th', { text: x }))),
    tiers.flatMap((t) => t.waves.map((w, k) => {
      const bs = w.heroes.map((id) => D.bundles.get(id)?.bundle).filter(Boolean)
      return h('tr', {},
        k === 0 ? h('td', { rowspan: t.waves.length }, h('b', { text: t.tier })) : null,
        h('td', { text: `Wave ${w.wave}` }),
        h('td', {}, h('div', { class: 'row' }, w.heroes.map(cell))),
        h('td', { text: `${bs.filter((b) => b.status !== 'placeholder').length} of ${w.heroes.length}` }),
        h('td', { text: String(bs.filter((b) => b.shape === 'tourney' && b.status !== 'placeholder').length) }),
        h('td', { text: String(bs.reduce((n, b) => n + chaptersOf(b).filter((c) => c.n && c.scenes.length).length, 0)) }))
    }))))
}

// ── The script library ────────────────────────────────────────────────────────
export function libraryView(filters) {
  const rows = libraryRows(D.data)
  const tiers = [...new Set(rows.map((r) => r.tier))]
  const shown = rows.filter((r) => (!filters.tier || r.tier === filters.tier) && (filters.all || r.scenes || r.chapters.some((c) => c.title)))
  const chip = (on, label, onclick) => h('button', { class: `chip ${on ? '' : 'off'}`, onclick, text: label })
  const byWave = new Map()
  for (const r of shown) { if (!byWave.has(r.wave)) byWave.set(r.wave, []); byWave.get(r.wave).push(r) }
  return h('div', { class: 'lib' },
    header('The script library', 'Every story\'s five chapters, tier by tier and wave by wave: what each holds, and every scene to read in full or play.', 'Library'),
    h('div', { class: 'filters' },
      chip(!filters.tier, 'All tiers', () => filters.set({ tier: null })),
      tiers.map((t) => chip(!filters.tier || filters.tier === t, t, () => filters.set({ tier: filters.tier === t ? null : t }))),
      h('span', { class: 'muted small', text: ' · ' }),
      chip(!filters.all, 'Written only', () => filters.set({ all: false })), chip(!!filters.all, 'Every Uma', () => filters.set({ all: true })),
    ),
    shown.length ? [...byWave].map(([wave, list]) => h('section', {},
      h('div', { class: 'section-head' }, h('h2', { text: `${list[0].tier} · Wave ${wave}` }), h('span', { class: 'muted small', text: `${list.length} stor${list.length === 1 ? 'y' : 'ies'}` })),
      h('div', { class: 'lib-rows' }, list.map(libraryRow)),
    )) : empty('No story matches these filters.'),
  )
}

function libraryRow(r) {
  const b = D.bundles.get(r.hero)?.bundle
  return h('div', { class: 'lib-row' },
    h('a', { class: 'lib-who', href: `#/s/${encodeURIComponent(r.hero)}` }, face(who(r.hero)), h('div', {},
      h('div', { class: 'lib-title', text: r.title ?? nameOf(r.hero) }),
      h('div', { class: 'muted small', text: [r.title ? nameOf(r.hero) : null, r.status, b?.shape === 'tourney' ? 'tournament shape' : b && r.status !== 'placeholder' ? 'racing draft' : null].filter(Boolean).join(' · ') }))),
    h('div', { class: 'lib-chapters' }, r.chapters.filter((c) => c.n !== null || c.scenes.length).map((c) => {
      const state = chapterState(c), v = c.n ? D.data.reviews?.items?.[chapterKey(r.hero, c.n)]?.status : null
      return h('a', { class: `lib-ch ${state}`, href: `#/read/${encodeURIComponent(r.hero)}/${c.n ?? 'other'}`, title: `${c.n ? `Chapter ${c.n}` : 'Scenes with no chapter'}${c.title ? `: ${c.title}` : ''} · ${CHAPTER_STATE_LABEL[state]}${c.scenes.length ? ` · ${c.scenes.length} scenes, ${c.words} words` : ''}` },
        h('b', { text: c.n ? `Ch ${c.n}` : 'Other' }), h('span', { class: 'lib-ch-title', text: c.title ?? (c.n ? '—' : 'no chapter') }),
        h('span', { class: 'small muted', text: c.scenes.length ? `${c.scenes.length} sc · ${c.words} w` : CHAPTER_STATE_LABEL[state] }), v ? verdictDot(v) : null)
    })),
  )
}

// ── Reading a chapter ─────────────────────────────────────────────────────────
export function readView(hero, which, onReview) {
  const entry = D.bundles.get(hero)
  if (!entry) return empty('No story for this Uma yet.')
  const b = entry.bundle, chapters = chaptersOf(b)
  const n = which === 'other' ? null : Number(which)
  const ch = chapters.find((c) => c.n === n)
  if (!ch) return empty('That chapter is not in the story.')
  const at = placeOf(D.data.pack, hero), state = chapterState(ch)
  const nav = chapters.filter((c) => c.n !== null || c.scenes.length)
  const i = nav.indexOf(ch)
  const boss = ch.boss ? (b.bosses ?? []).find((x) => x.id === ch.boss) : null
  return h('div', { class: 'lib' },
    h('p', { class: 'small' }, h('a', { href: '#/library', text: '← The script library' }), ' · ', h('a', { href: `#/s/${encodeURIComponent(hero)}/road`, text: `${storyTitle(hero)}'s road` })),
    header(ch.n ? `Chapter ${ch.n}${ch.title ? ` · ${ch.title}` : ''}` : 'Scenes with no chapter', `${storyTitle(hero)} · ${nameOf(hero)}${at ? ` · ${at.tier}, wave ${at.wave}` : ''}`, CHAPTER_STATE_LABEL[state]),
    subnav(nav.map((c) => [String(c.n ?? 'other'), c.n ? `Chapter ${c.n}` : 'Other', `#/read/${encodeURIComponent(hero)}/${c.n ?? 'other'}`]), String(ch.n ?? 'other')),
    h('div', { class: 'two' },
      panel('The outline',
        ch.summary ? h('p', { text: ch.summary }) : empty('No summary.'),
        ch.beats.length ? h('ol', { class: 'list' }, ch.beats.map((x) => h('li', { text: x }))) : null,
        h('dl', { class: 'kv' },
          ch.city ? [h('dt', { text: 'Town' }), h('dd', { text: cityName(ch.city) })] : null,
          ch.dungeon ? [h('dt', { text: 'Dungeon' }), h('dd', { text: placeName(ch.dungeon) })] : null,
          boss ? [h('dt', { text: 'The boss' }), h('dd', {}, h('a', { href: `#/c/${encodeURIComponent(boss.id)}`, text: nameOf(boss.id) }), boss.epithet ? `, ${boss.epithet}` : '')] : null,
          ch.careerBeat ? [h('dt', { text: 'Career beat' }), h('dd', { text: ch.careerBeat })] : null,
          ch.tourneys.length ? [h('dt', { text: 'Tourneys' }), h('dd', { text: ch.tourneys.map((id) => D.data.world?.circuit?.find((e) => e.id === id)?.name ?? id).join(', ') })] : null,
          [h('dt', { text: 'Scenes' }), h('dd', { text: `${ch.scenes.length} · ${ch.words.toLocaleString()} words` })],
          [h('dt', { text: 'For the game' }), h('dd', { text: ch.scripted ? 'Marked scripted: stories:export-game writes it' : 'Not marked scripted yet' })])),
      ch.n ? verdictPanel(chapterKey(hero, ch.n), onReview, 'Your read of this chapter') : null,
    ),
    ch.scenes.length ? ch.scenes.map((s, k) => sceneBlock(hero, s, k)) : empty('No scenes for this chapter yet.'),
    h('div', { class: 'row lib-pager' },
      i > 0 ? h('a', { class: 'btn', href: `#/read/${encodeURIComponent(hero)}/${nav[i - 1].n ?? 'other'}`, text: `← ${nav[i - 1].n ? `Chapter ${nav[i - 1].n}` : 'Other'}` }) : null,
      i < nav.length - 1 ? h('a', { class: 'btn', href: `#/read/${encodeURIComponent(hero)}/${nav[i + 1].n ?? 'other'}`, text: `${nav[i + 1].n ? `Chapter ${nav[i + 1].n}` : 'Other'} →` }) : null),
  )
}

function sceneBlock(hero, s, k) {
  const cast = speakersOf(s)
  return h('section', { class: 'panel lib-scene', id: s.id },
    h('div', { class: 'section-head' },
      h('h2', { text: `${k + 1}. ${s.title ?? s.id}` }),
      h('a', { class: 'btn primary', href: `#/play/${encodeURIComponent(hero)}/${encodeURIComponent(s.id)}`, text: '▶ Play' })),
    h('p', { class: 'muted small', text: [s.place ? placeName(s.place) : 'No place yet', s.trigger ? `on ${s.trigger.kind}${s.trigger.marker ? ` at the ${s.trigger.marker}` : ''}` : null, `${s.steps?.length ?? 0} steps`].filter(Boolean).join(' · ') }),
    s.about ? h('p', { class: 'small', text: s.about }) : null,
    cast.length ? h('div', { class: 'row' }, cast.map((id) => h('a', { href: `#/c/${encodeURIComponent(id)}`, title: nameOf(id) }, face(who(id), 'sm')))) : null,
    transcript(s.steps ?? []),
  )
}

/** A scene's steps as a script to read: narration, lines with faces, thoughts, cards, letters, choices, directions. */
export function transcript(steps) {
  const limit = D.data.lineLimit ?? 160
  return h('div', { class: 'transcript' }, steps.map((st) => {
    if (!st || typeof st !== 'object') return null
    const speaker = (id) => h('div', { class: 'speaker' }, face(who(id), 'sm'), h('a', { href: `#/c/${encodeURIComponent(id)}`, text: nameOf(id) }))
    if (st.t === 'line' || st.t === 'thought') return h('div', { class: `spoken ${st.t}` }, speaker(st.speaker),
      h('p', { class: st.text?.length > limit ? 'long' : '', title: st.text?.length > limit ? `Over the game's ${limit} characters: it will split` : null, text: st.text }),
      st.emote || st.bubble ? h('span', { class: 'chip small', text: [st.emote, st.bubble].filter(Boolean).join(' ') }) : null)
    if (st.t === 'narrate') return h('p', { class: 'narration', text: st.text })
    if (st.t === 'title') return h('div', { class: 'title-card' }, h('b', { text: st.text }), st.sub ? h('span', { text: st.sub }) : null)
    if (st.t === 'letter') return h('div', { class: 'script-letter' }, st.from ? h('div', { class: 'from', text: st.from }) : null, String(st.text ?? '').split('\n').map((p) => h('p', { text: p })))
    if (st.t === 'stage') return h('p', { class: 'direction', text: st.text })
    if (st.t === 'boss') return h('div', { class: 'boss-card' }, face(who(st.id), 'sm'), h('b', { text: nameOf(st.id) }), D.bundles.get(D.bossStory.get(st.id))?.bundle?.bosses?.find((x) => x.id === st.id)?.epithet ?? '')
    if (st.t === 'choice') return h('div', { class: 'choice' }, st.prompt ? h('p', { class: 'direction', text: st.prompt }) : null,
      h('ol', { class: 'list' }, (st.options ?? []).map((o) => h('li', {}, h('b', { text: o?.text ?? '' }), o?.reply ? h('div', { class: 'spoken' }, speaker(o.reply.speaker), h('p', { text: o.reply.text })) : null))))
    if (st.t === 'emote') return h('p', { class: 'direction', text: `${nameOf(st.actor)}: ${[st.emote, st.bubble].filter(Boolean).join(', ')}` })
    if (st.t === 'flashback') return h('p', { class: 'direction', text: st.on ? '— A memory begins —' : '— The memory ends —' })
    if (st.t === 'walk' || st.t === 'face' || st.t === 'camera' || st.t === 'wait') return h('p', { class: 'direction small', text: `${st.t}${st.actor ? ` · ${nameOf(st.actor)}` : ''}${st.text ? `: ${st.text}` : ''}` })
    if (st.t === 'flag') return h('p', { class: 'direction small', text: `${st.set === false ? 'clears' : 'sets'} ${st.flag}` })
    return st.text ? h('p', { class: 'narration', text: st.text }) : null
  }))
}

// ── In the game ───────────────────────────────────────────────────────────────
export function gameView() {
  const game = D.data.game
  if (!game) return empty('The game read is off.')
  const pk = game.pack, ex = game.export
  return h('div', { class: 'lib' },
    header('In the game', 'The story as Uma Quest reads it, checked by the game\'s own parsers from the local uma-quest checkout: the pack it last had exported, and what the export would write from the stories now.', 'In the game'),
    game.parsers.ok ? h('p', { class: 'ok small', text: `The game's story parsers loaded from ${game.root}.` }) : h('div', { class: 'error-box', text: game.parsers.error }),
    panel('The exported story pack', pk.ok ? h('div', {},
      h('p', { class: 'muted small', text: `content/story/index.json, built ${new Date(pk.builtAt).toLocaleString()}. stories:publish-game sends it to the game, which reads it the next time it opens.` }),
      h('div', { class: 'summary' },
        stat(pk.cast?.count ?? '—', 'travelers in the cast'), stat(pk.cast?.intros ?? '—', 'intros'), stat(pk.cast?.recruits ?? '—', 'recruit lines'),
        stat(pk.world?.places ?? '—', 'place names'), stat(pk.chapters.length, 'chapters')),
      pk.cast ? h('p', { class: 'small', text: `By Way: ${Object.entries(pk.cast.ways).map(([w, n]) => `${w} ${n}`).join(', ')}` }) : null,
      pk.opening ? h('div', {}, h('h3', { text: 'The opening, as the game plays it' }), pk.opening.scenes.map((s) => transcript(s.steps.map(gameStep)))) : null,
      pk.chapters.length ? h('table', { class: 'table' }, h('tr', {}, ['Chapter', 'Lead', 'Scenes', 'Steps played', 'Narrated for now', 'Skipped'].map((x) => h('th', { text: x }))),
        pk.chapters.map((c) => h('tr', {}, h('td', { text: `${c.id}${c.title ? ` · ${c.title}` : ''}` }), h('td', { text: String(c.lead ?? '') }), h('td', { text: String(c.scenes.length) }),
          h('td', { text: String(c.scenes.reduce((n, s) => n + s.played, 0)) }), h('td', { text: String(c.scenes.reduce((n, s) => n + s.narrated, 0)) }), h('td', { text: String(c.scenes.reduce((n, s) => n + s.skipped, 0)) })))) : null,
      pk.problems.length ? h('details', {}, h('summary', { text: `${pk.problems.length} problems the game notes` }), h('ul', { class: 'issues' }, pk.problems.map((p) => h('li', { text: `${p.where}: ${p.issue}` })))) : h('p', { class: 'ok small', text: 'The game reads every file with no problem.' }),
    ) : empty(pk.error)),
    panel('What the export would write now', ex.ok ? h('div', {},
      h('p', { class: 'muted small', text: 'Every chapter marked scripted in a story goes to the game as its chapter file (SB34), with the steps the game plays today; the rest are narrated until the game builds them.' }),
      ex.chapters.length ? h('table', { class: 'table' }, h('tr', {}, ['Chapter', 'Town', 'Dungeon', 'Scenes', 'Played', 'Narrated', 'Skipped', 'Problems'].map((x) => h('th', { text: x }))),
        ex.chapters.map((c) => {
          const { hero, chapter } = parseKey(c.id.replace(/-(\d)$/, '.c$1'))
          return h('tr', {}, h('td', {}, h('a', { href: `#/read/${encodeURIComponent(hero)}/${chapter}`, text: `${c.id}${c.title ? ` · ${c.title}` : ''}` })), h('td', { text: cityName(c.town) }), h('td', { text: placeName(c.dungeon) }),
            h('td', { text: String(c.scenes.length) }), h('td', { text: String(c.scenes.reduce((n, s) => n + (s.played ?? 0), 0)) }), h('td', { text: String(c.scenes.reduce((n, s) => n + (s.narrated ?? 0), 0)) }),
            h('td', { text: String(c.scenes.reduce((n, s) => n + (s.skipped ?? 0), 0)) }), h('td', { text: c.problems.length ? c.problems.join('; ') : '—' }))
        })) : empty('No chapter is marked scripted yet.'),
      ex.issues.length ? h('ul', { class: 'issues' }, ex.issues.map((i) => h('li', { text: i }))) : null,
    ) : empty(ex.error)),
  )
}
// The game names Umas by outfit id; the sandbox by hero id.
const heroOfOutfit = (outfit) => D.data.pack.characters.find((c) => c.outfit?.id === outfit)?.id ?? String(outfit)
const gameStep = (st) => (st.kind === 'line' ? { t: 'line', speaker: heroOfOutfit(st.speaker), text: st.text } : st.kind === 'narrate' ? { t: 'narrate', text: st.text }
  : { ...st, t: st.kind, actor: st.actor !== undefined ? heroOfOutfit(st.actor) : undefined })

// ── The review desk ───────────────────────────────────────────────────────────
/** Every check the sandbox runs, by where it comes from. */
export function checkGroups() {
  const data = D.data
  return [
    { title: 'Files that did not load', items: data.errors.map((e) => `${e.file}: ${e.error}`) },
    ...data.bundles.filter((b) => b.issues.length).map((b) => ({ title: `${storyTitle(b.bundle.hero)} · ${b.file}`, href: `#/s/${encodeURIComponent(b.bundle.hero)}/review`, items: b.issues })),
    { title: 'Across the stories', items: data.cross?.issues ?? [] },
    { title: 'The tags', items: data.tagIssues ?? [] },
    { title: 'The relationships', items: data.relationshipIssues ?? [] },
    { title: 'The world pack', items: data.worldIssues ?? [] },
    { title: 'The game\'s read of the exported pack', href: '#/game', items: data.game?.pack?.ok ? data.game.pack.problems.map((p) => `${p.where}: ${p.issue}`) : [] },
    { title: 'The chapters bound for the game', href: '#/game', items: data.game?.export?.ok ? data.game.export.issues : [] },
  ].filter((g) => g.items.length)
}

export function deskView(filter, onReview) {
  const rows = deskRows(D.data), counts = verdictCounts(rows), groups = checkGroups()
  const tab = filter || 'all'
  const shown = tab === 'all' ? rows : rows.filter((r) => r.verdict === tab)
  const chips = [['all', `Everything · ${rows.length}`], ...['unreviewed', 'liked', 'rework', 'question'].map((v) => [v, `${VERDICT_LABEL[v]} · ${counts[v]}`]), ['checks', `Checks · ${groups.reduce((n, g) => n + g.items.length, 0)}`]]
  return h('div', { class: 'lib' },
    header('The review desk', 'Every written story and every chapter with scenes, with your verdict and note; and every check the sandbox and the game run.', 'Review'),
    subnav(chips.map(([id, label]) => [id, label, `#/review/${id}`]), tab),
    tab === 'checks'
      ? (groups.length ? groups.map((g) => panel(null, h('h3', {}, g.href ? h('a', { href: g.href, text: g.title }) : g.title), h('ul', { class: 'issues' }, g.items.map((i) => h('li', { text: i }))))) : h('p', { class: 'ok', text: 'Every check passes.' }))
      : shown.length ? h('div', { class: 'scroll' }, h('table', { class: 'table desk' },
        h('tr', {}, ['Tier', 'What', 'State', 'Verdict', 'Note', 'Saved', ''].map((x) => h('th', { text: x }))),
        shown.map((r) => h('tr', {},
          h('td', { text: `${r.tier} · w${r.wave}` }),
          h('td', {}, h('a', { href: r.kind === 'story' ? `#/s/${encodeURIComponent(r.hero)}/review` : `#/read/${encodeURIComponent(r.hero)}/${r.chapter}` },
            r.kind === 'story' ? storyTitle(r.hero) : `${storyTitle(r.hero)} · Chapter ${r.chapter}${r.title ? `: ${r.title}` : ''}`), r.issues ? h('span', { class: 'warn small', text: ` · ${r.issues} checks` }) : null),
          h('td', {}, r.kind === 'chapter' ? stateChip(r.status) : h('span', { class: `badge ${r.status}`, text: r.status })),
          h('td', {}, verdictDot(r.verdict), ` ${VERDICT_LABEL[r.verdict]}`),
          h('td', { class: 'small', text: r.note.length > 160 ? `${r.note.slice(0, 160)}…` : r.note }),
          h('td', { class: 'small muted', text: r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '' }),
          h('td', {}, h('button', { class: 'btn small', onclick: (ev) => {
            const row = ev.target.closest('tr'), next = row.nextElementSibling
            if (next?.classList.contains('desk-edit')) return next.remove()
            row.after(h('tr', { class: 'desk-edit' }, h('td', { colspan: 7 }, verdictPanel(r.key, onReview, r.kind === 'story' ? 'Your read of the story' : 'Your read of the chapter'))))
          }, text: 'Verdict' })),
        )))) : empty('Nothing here.'),
  )
}

// ── Search ────────────────────────────────────────────────────────────────────
const KINDS = [['all', 'Everything'], ['story', 'Stories'], ['chapter', 'Chapters'], ['scene', 'Scenes'], ['character', 'Characters'], ['place', 'Places'], ['tourney', 'Tourneys'], ['lore', 'Lore'], ['bible', 'Bibles']]
export function searchView(query = '', kind = 'all') {
  const results = findContent(indexOf(), query, kind)
  const input = h('input', { type: 'search', class: 'lib-search', value: query, placeholder: 'Search every story, line, place and bible', 'aria-label': 'Search' })
  const go = (k = kind) => { location.hash = `#/search/${encodeURIComponent(input.value.trim())}${k !== 'all' ? `/${k}` : ''}` }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go() })
  queueMicrotask(() => input.focus())
  return h('div', { class: 'lib' },
    header('Search', 'Stories, chapters, every scene\'s lines, characters, towns, dungeons, tourneys, the world\'s lore and the bibles.', 'Search'),
    h('div', { class: 'row' }, input, h('button', { class: 'btn primary', onclick: () => go(), text: 'Search' })),
    subnav(KINDS.map(([id, label]) => [id, label, `#/search/${encodeURIComponent(query)}${id !== 'all' ? `/${id}` : ''}`]), kind),
    !query ? empty('Type a word or a name. Press / anywhere to search.') : results.length
      ? h('div', {}, h('p', { class: 'muted small', text: `${results.length}${results.length === 200 ? '+' : ''} results` }), h('ol', { class: 'lib-results' }, results.map((r) => h('li', {},
        h('a', { href: r.href }, h('span', { class: 'badge', text: r.kind }), ' ', h('b', { text: r.title })), h('div', { class: 'small muted', text: r.detail }), h('div', { class: 'small', text: snippet(r.text, query) })))))
      : empty('Nothing matches.'),
  )
}

// ── Bibles ────────────────────────────────────────────────────────────────────
export function biblesView(name) {
  const list = D.data.bibles ?? []
  const doc = name ? list.find((d) => d.name === name) : null
  if (doc) return h('div', { class: 'lib' }, worldNav('bibles'), h('p', { class: 'small' }, h('a', { href: '#/bibles', text: '← The bibles' })), markdown(doc.text))
  return h('div', { class: 'lib' }, worldNav('bibles'),
    header('The bibles', 'World-building, voices and notes behind the stories: much of it never reaches the game, and it shapes the lines that do.', 'World & lore'),
    list.length ? h('div', { class: 'cards' }, list.map((d) => h('a', { class: 'panel', href: `#/bibles/${encodeURIComponent(d.name)}` }, h('h3', { text: titleOfMarkdown(d.text) ?? d.name }), h('p', { class: 'muted small', text: `${d.name}.md · ${d.text.split(/\s+/).filter(Boolean).length.toLocaleString()} words` }))))
      : h('div', {}, empty('No bibles yet.'), h('p', { class: 'muted small', text: 'Put Markdown files in content/quest/stories/bibles/ and they show here, searchable.' })),
  )
}
