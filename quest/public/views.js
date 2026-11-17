// Views for the Story Sandbox. Every name and line comes from the private pack and bundles at run time.

export const D = { data: null }
const CHAPTER_LEVELS = (n) => `Lv ${n * 10 - 9}–${n * 10}`
export const BIOMES = {
  forest: ['#2f5d3a', '#1d3324'], meadow: ['#6f9a4a', '#3c5a2a'], ruins: ['#6d6478', '#3a3442'], marsh: ['#3f6a63', '#1f3833'],
  coast: ['#3f78a8', '#1e3a57'], cavern: ['#5a4b3f', '#2a221c'], highlands: ['#7a7a4a', '#3f3f24'], snowfield: ['#b9c7d6', '#6c7d90'],
  desert: ['#c49a5a', '#7a5a2c'], volcano: ['#9a3a2a', '#3a1410'], sky: ['#9cc2e6', '#4c7aa8'], hub: ['#8a7442', '#4a3c20'],
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  apply(el, attrs)
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  return el
}
export function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  apply(el, attrs)
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)))
  return el
}
function apply(el, attrs) {
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.setAttribute('class', v)
    else if (k === 'text') el.textContent = v
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) { if (val) el.style.setProperty(n, val) }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
}
const paras = (list) => (Array.isArray(list) ? list : list ? [list] : []).map((p) => h('p', { text: p }))
const bullets = (list) => (list?.length ? h('ul', { class: 'list' }, list.map((x) => h('li', { text: x }))) : null)

// ── Data access ───────────────────────────────────────────────────────────────
export function index(data) {
  const byId = new Map(data.pack.characters.map((c) => [c.id, c]))
  const franchises = new Map(data.pack.franchises.map((f) => [f.id, f]))
  const bundles = new Map(data.bundles.map((b) => [b.bundle.hero, b]))
  const bossStory = new Map()
  for (const b of data.bundles) for (const boss of b.bundle.bosses ?? []) bossStory.set(boss.id, b.bundle.hero)
  const themes = new Map((data.setting?.themes ?? []).map((t) => [t.id, t]))
  const cities = new Map((data.setting?.cities ?? []).map((c) => [c.id, c]))
  const factions = new Map((data.setting?.factions ?? []).map((f) => [f.franchise, f]))
  const extras = new Map()
  for (const b of data.bundles) for (const e of b.bundle.extras ?? []) extras.set(e.id, { ...e, images: {}, role: 'extra', franchise: 'extra' })
  D.data = data
  const voc = data.tags?.vocabularies
  const classById = new Map((voc?.classes ?? []).map((c) => [c.id, c]))
  const persById = new Map((voc?.personalities ?? []).map((p) => [p.id, p]))
  const wayById = new Map((voc?.ways ?? []).map((w) => [w.id, w]))
  Object.assign(D, { byId, franchises, bundles, bossStory, themes, cities, factions, extras, classById, persById, wayById })
}

// ── Tags (Q58) ────────────────────────────────────────────────────────────────
/** Her three tags with their mappings, or null when the tags file has none for her. */
export function tagsOf(id) {
  const t = D.data.tags?.umas?.[id]
  if (!t) return null
  const cls = D.classById.get(t.class?.id), pers = D.persById.get(t.personality?.id)
  return { t, cls, pers, way: D.wayById.get(cls?.way), story: D.themes.get(t.story?.id) ?? { id: t.story?.id, name: t.story?.id } }
}
const cap = (s) => String(s ?? '').replace(/^./, (x) => x.toUpperCase())
const tagLink = (set, id, label, extra = {}, linked = true) => h(linked ? 'a' : 'span', { class: `chip tag ${set}`, href: linked ? `#/t/${set}/${encodeURIComponent(id)}` : null, text: label, ...extra })
/** The three tags as chips: class (with her Way), personality (with its face), story type. Inside a card (itself a
 *  link) they are plain chips; elsewhere each opens the Stories page on that tag. */
function tagChips(id, linked = true) {
  const x = tagsOf(id)
  if (!x) return null
  return h('span', { class: 'row tag-row' },
    x.cls ? tagLink('class', x.cls.id, `${x.cls.name} · ${x.way?.name ?? x.cls.way}`, { title: `${x.t.class.why}\nStarts as ${x.cls.start}${x.cls.branch ? `, then ${x.cls.branch}` : ''}` }, linked) : null,
    x.pers ? tagLink('personality', x.pers.id, `${x.pers.id}${x.pers.candidate ? '*' : ''}`, { title: `${x.t.personality.why}\nFace: ${x.pers.face}` }, linked) : null,
    x.t.story?.id ? tagLink('story', x.t.story.id, x.story.name, { title: x.t.story.why, vars: { '--theme': x.story.color } }, linked) : null)
}
/** Her tags with their reasons, for a story's overview. */
function tagPanel(id) {
  const x = tagsOf(id)
  if (!x) return null
  const row = (label, chip, why, more) => [h('dt', {}, label), h('dd', {}, chip, ' ', h('span', { class: 'small', text: why }), more ? h('div', { class: 'small muted', text: more }) : null)]
  return h('div', { class: 'panel' },
    h('h3', { text: 'Her tags' }),
    h('dl', { class: 'kv' },
      row('Story class', tagLink('class', x.t.class.id, x.cls?.name ?? x.t.class.id), x.t.class.why, x.cls ? `The Way of the ${x.way?.name ?? x.cls.way} (${x.way?.home ?? ''}): starts as ${x.cls.start}${x.cls.branch ? `, then ${x.cls.branch}` : ''}.` : null),
      row('Personality', tagLink('personality', x.t.personality.id, x.t.personality.id), x.t.personality.why, x.pers ? `Face: ${x.pers.face}${x.pers.candidate ? ' · a candidate for a face set of its own (SC8)' : ''}.` : null),
      row('Story type', tagLink('story', x.t.story.id, x.story.name), x.t.story.why),
    ),
  )
}
export const who = (id) => D.byId.get(id) ?? D.extras.get(id) ?? { id, name: id, images: {}, franchise: '?', role: '?' }
export const themeOf = (bundle) => D.themes.get(bundle?.theme)
export const franchiseTitle = (id) => D.franchises.get(id)?.title ?? id
const bossesInOrder = (bundle) => [...(bundle.bosses ?? [])].sort((a, b) => a.chapter - b.chapter)
const review = (hero) => D.data.reviews?.items?.[hero]

export function face(c, cls = '') {
  if (c?.images?.face) return h('img', { class: `face ${cls}`, src: c.images.face, alt: c.name, loading: 'lazy' })
  const initials = (c?.name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2)
  return h('span', { class: `face initials ${cls}`, title: c?.name, text: initials })
}
const art = (c) => (c?.images?.art ? h('img', { src: c.images.art, alt: c.name, loading: 'lazy' }) : null)
const themeChip = (t) => (t ? h('span', { class: 'chip theme', vars: { '--theme': t.color }, text: t.name }) : null)

// ── Stories ───────────────────────────────────────────────────────────────────
// The Stories page (SC4): every Uma of the cast by batch, T1 to T10, in the Ranker's order; filters for batch,
// status and theme; the written stories and the placeholders counted apart.
export function storiesView(filters) {
  const { data } = D
  const heroes = data.pack.characters.filter((c) => c.role === 'hero')
  const placed = data.pack.characters.filter((c) => c.role === 'boss').length - data.cross.unassigned.length
  const words = data.bundles.reduce((n, b) => n + b.words, 0)
  const themes = (data.setting?.themes ?? []).filter((t) => data.bundles.some((b) => b.bundle.theme === t.id))
  const written = data.bundles.filter((b) => b.bundle.status !== 'placeholder')
  const statusOf = (c) => D.bundles.get(c.id)?.bundle.status ?? 'none'
  const matches = (c) => {
    const b = D.bundles.get(c.id)?.bundle
    const x = tagsOf(c.id)
    return (!filters.theme || b?.theme === filters.theme) && (!filters.status || statusOf(c) === filters.status) && (!filters.batch || c.batch === filters.batch) &&
      (!filters.way || x?.cls?.way === filters.way) && (!filters.tag || x?.t?.[filters.tag.set]?.id === filters.tag.id)
  }
  const ways = data.tags?.vocabularies?.ways ?? []
  const tagLabel = filters.tag ? { class: 'Class', personality: 'Personality', story: 'Story type' }[filters.tag.set] ?? filters.tag.set : null
  const statuses = ['placeholder', 'skeleton', 'outline', 'bible', 'scripted', 'none'].filter((st) => heroes.some((c) => statusOf(c) === st))
  const batches = data.pack.batches ?? null
  const byId = new Map(heroes.map((c) => [c.id, c]))
  const chip = (on, label, onclick, extra = {}) => h('button', { class: `chip ${on ? '' : 'off'}`, onclick, text: label, ...extra })
  const groups = batches
    ? batches.map((g) => ({ ...g, heroes: g.heroes.map((id) => byId.get(id)).filter(Boolean).filter(matches) })).filter((g) => g.heroes.length)
    : [{ batch: null, heroes: heroes.filter(matches) }]
  return h('div', {},
    data.errors.length ? h('div', { class: 'error-box' }, h('b', { text: 'Files that did not load' }), h('ul', { class: 'list' }, data.errors.map((e) => h('li', { text: `${e.file}: ${e.error}` })))) : null,
    data.cross.issues.length ? h('div', { class: 'error-box' }, h('b', { text: 'Across the stories' }), h('ul', { class: 'list' }, data.cross.issues.map((i) => h('li', { text: i })))) : null,
    data.tagIssues?.length ? h('div', { class: 'error-box' }, h('b', { text: 'The tags' }), h('ul', { class: 'list' }, data.tagIssues.map((i) => h('li', { text: i })))) : null,
    h('div', { class: 'summary' },
      stat(heroes.length, `Umas${batches ? ` in ${batches.length} batches` : ''} · ${heroes.filter((c) => c.sister).length} sisters`),
      stat(written.length, 'stories written'),
      stat(data.cross.placeholders ?? 0, 'placeholders to write'),
      stat(placed, `of ${placed + data.cross.unassigned.length} bosses placed`),
      stat(data.cross.shaped ?? 0, 'on the tournament shape'),
      stat(Object.keys(data.cross.towns ?? {}).length, `of ${(data.setting?.cities ?? []).filter((c) => c.band != null).length} towns on a road`),
      stat(data.bundles.reduce((n, b) => n + (b.bundle.scenes?.length ?? 0), 0), 'scenes to play'),
      stat(words.toLocaleString(), 'words written'),
    ),
    batches ? h('div', { class: 'filters' },
      chip(!filters.batch, 'All batches', () => filters.set({ batch: null })),
      batches.map((g) => chip(!filters.batch || filters.batch === g.batch, `${g.tier} · ${written.filter((b) => byId.get(b.bundle.hero)?.batch === g.batch).length}/${g.heroes.length}`, () => filters.set({ batch: filters.batch === g.batch ? null : g.batch }), { title: `Batch ${g.batch}: stories written of its Umas` })),
    ) : null,
    ways.length ? h('div', { class: 'filters' },
      chip(!filters.way, 'All Ways', () => filters.set({ way: null })),
      ways.map((w) => chip(!filters.way || filters.way === w.id, `${w.name} · ${heroes.filter((c) => tagsOf(c.id)?.cls?.way === w.id).length}`, () => filters.set({ way: filters.way === w.id ? null : w.id }), { title: `The Way of the ${w.name}, ${w.home}: from her story class` })),
      filters.tag ? h('button', { class: 'chip tag on', onclick: () => filters.set({ tag: null }), title: 'Clear this tag', text: `${tagLabel}: ${filters.tag.id} ×` }) : null,
      h('a', { class: 'chip', href: '#/tags', text: 'All tags →' }),
    ) : null,
    h('div', { class: 'filters' },
      statuses.map((st) => chip(!filters.status || filters.status === st, `${st === 'none' ? 'no bundle' : st} · ${heroes.filter((c) => statusOf(c) === st).length}`, () => filters.set({ status: filters.status === st ? null : st }))),
      themes.length ? h('span', { class: 'muted small', text: ' · ' }) : null,
      themes.map((t) => h('button', { class: `chip theme ${filters.theme && filters.theme !== t.id ? 'off' : ''}`, vars: { '--theme': t.color }, onclick: () => filters.set({ theme: filters.theme === t.id ? null : t.id }), text: `${t.name} · ${data.bundles.filter((b) => b.bundle.theme === t.id).length}` })),
    ),
    groups.length ? groups.map((g) => h('section', {},
      g.batch ? h('div', { class: 'section-head batch-head' }, h('h2', { text: `Batch ${g.batch} · ${g.tier}` }), h('span', { class: 'muted small', text: batchLine(batches[g.batch - 1], byId) })) : null,
      h('div', { class: 'cards' }, g.heroes.map((c) => storyCard(c))),
    )) : h('p', { class: 'empty', text: 'No Uma matches these filters.' }),
  )
}
const stat = (n, label) => h('div', { class: 'stat' }, h('b', { text: n }), h('span', { text: label }))
function batchLine(g, byId) {
  const list = g.heroes.map((id) => byId.get(id)).filter(Boolean)
  const done = list.filter((c) => (D.bundles.get(c.id)?.bundle.status ?? 'placeholder') !== 'placeholder').length
  const sisters = list.filter((c) => c.sister).length
  return `${list.length} Umas${sisters ? `, ${sisters} of them sisters` : ''} · ${done} written, ${list.length - done} to write`
}
const tierChip = (c) => (c?.tier ? h('span', { class: 'chip tier', title: `Batch ${c.batch}, place ${c.place} on Playable Umas`, text: `${c.tier} · #${c.place}` }) : null)
const sisterLine = (c) => (c?.sister ? `${c.sister.ofName}’s ${c.sister.relation}` : null)

function storyCard(hero) {
  const b = D.bundles.get(hero.id)?.bundle, entry = D.bundles.get(hero.id)
  const t = themeOf(b), r = review(hero.id), placeholder = b?.status === 'placeholder'
  return h('a', { class: `card ${placeholder ? 'placeholder' : ''}`, href: `#/s/${hero.id}`, vars: { '--theme': t?.color } },
    h('div', { class: 'card-art' }, art(hero), h('div', { class: 'card-tags' },
      h('span', { class: 'row' }, tierChip(hero), themeChip(t) ?? (b ? null : h('span', { class: 'chip', text: 'No story yet' }))),
      h('span', { class: 'row' }, r?.status ? h('span', { class: `review-dot ${r.status}`, title: `Review: ${r.status}` }) : null, b ? h('span', { class: `badge ${b.status}`, text: b.status }) : null, b && !placeholder && b.shape !== 'tourney' ? h('span', { class: 'badge', title: 'Written on the racing shape (D36–D44); to be rewritten on the tournament shape (D45)', text: 'racing draft' }) : null))),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-title', text: b?.title ?? hero.name }),
      h('div', { class: 'card-hero', text: `${b?.title ? `${hero.name} · ` : ''}${hero.outfit?.title ?? ''}` }),
      hero.sister ? h('div', { class: 'card-sister small', text: `${sisterLine(hero)} · ${hero.sister.age}` }) : null,
      tagChips(hero.id, false),
      b?.logline ? h('div', { class: 'card-log', text: b.logline }) : placeholder ? h('div', { class: 'card-log todo', text: `To write: ${(entry.toWrite ?? []).join(', ')}` }) : null,
      b?.bosses?.length ? h('div', { class: 'card-bosses' }, bossesInOrder(b).map((x) => face(who(x.id), x.chapter === 5 ? 'final' : ''))) : null,
    ),
  )
}

// ── One story ─────────────────────────────────────────────────────────────────
export function storyView(heroId, tab, onReview) {
  const entry = D.bundles.get(heroId), hero = who(heroId)
  if (!entry) return h('div', {}, h('h1', { text: hero.name }), h('p', { class: 'empty', text: 'No bundle for this hero yet.' }))
  const b = entry.bundle, t = themeOf(b), hb = b.heroBible ?? {}, placeholder = b.status === 'placeholder'
  const tabs = [['overview', 'Overview'], ['road', 'The road'], ['web', 'Relationships'], ['scenes', `Scenes · ${b.scenes?.length ?? 0}`], ['review', `Review${entry.issues.length ? ` · ${entry.issues.length} checks` : ''}`]]
  const way = tagsOf(heroId)?.way?.name
  const outlined = (b.chapters ?? []).filter((ch) => ch?.title).length
  return h('div', { vars: { '--theme': t?.color } },
    h('div', { class: 'banner' },
      h('div', { class: 'banner-art' }, art(hero)),
      h('div', { class: 'banner-text' },
        h('div', { class: 'row' }, tierChip(hero), themeChip(t), b.tone ? h('span', { class: 'chip', text: b.tone }) : null, h('span', { class: `badge ${b.status}`, text: b.status }), way ? h('span', { class: 'chip', title: 'From her story class (SC7)', text: `Way of the ${way}` }) : null),
        tagChips(heroId),
        h('h1', { text: b.title ?? hero.name }),
        h('div', { class: 'muted', text: `${b.title ? hero.name : ''}${hb.epithet ? `, ${hb.epithet}` : ''}${hero.outfit?.title ? `${b.title ? ' · ' : ''}outfit “${hero.outfit.title}”` : ''}` }),
        hero.sister ? h('div', { class: 'small' }, h('a', { href: `#/c/${hero.sister.of}`, text: sisterLine(hero) }), ` · she ran her sister’s career in ${hero.sister.age}`) : null,
        b.logline ? h('p', { class: 'logline', text: b.logline }) : h('p', { class: 'logline todo', text: 'Logline: to write.' }),
        placeholder
          ? h('div', { class: 'row small muted', text: `A placeholder: every section is here and empty, written when batch ${hero.batch ?? '?'} comes. To write: ${(entry.toWrite ?? []).join(', ')}.` })
          : h('div', { class: 'row small muted' }, `${entry.words.toLocaleString()} words`, ' · ', `${outlined} chapters outlined`, ' · ', h('a', { href: `#/world/${heroId}`, text: 'Show the route on the map' })),
        b.tale ? h('div', { class: 'small muted', text: `Tale shape: ${b.tale}` }) : null,
      ),
    ),
    h('nav', { class: 'tabs' }, tabs.map(([id, label]) => h('a', { href: `#/s/${heroId}/${id}`, class: tab === id ? 'on' : '', text: label }))),
    tab === 'road' ? roadTab(b) : tab === 'web' ? h('div', {}, b.bosses?.length ? webTab(b) : h('p', { class: 'empty', text: 'Her bosses are to be decided (SC20); her ties in the cast are below.' }), tiesList(heroId))
      : tab === 'scenes' ? scenesTab(b) : tab === 'review' ? reviewTab(heroId, entry, onReview) : placeholder ? placeholderTab(b, hero, entry) : overviewTab(b, hero),
  )
}

// A placeholder's overview (SC3): who she is from the Ranker, and each section of her story marked to write.
function placeholderTab(b, hero, entry) {
  const todo = (label, filled) => h('li', { class: filled ? '' : 'todo' }, h('b', { text: label }), filled ? ': written' : ': to write')
  return h('div', { class: 'two' },
    h('div', { class: 'panel prose' },
      h('h2', { text: hero.name }),
      hero.sister ? [h('h4', { text: `${sisterLine(hero)}, ${hero.sister.age}` }), h('p', { text: hero.sister.profile }), h('p', { class: 'small muted', text: 'Her profile is the Uma Ranker’s (uma-platform): a sister runs her sister’s real career in an age of her own.' })] : null,
      h('h4', { text: 'In the cast' }),
      h('p', { text: `${hero.tier}, batch ${hero.batch}, place ${hero.place} on Playable Umas, in “${hero.outfit?.title}”.` }),
      hero.outfits?.length > 1 ? [h('h4', { text: 'Her other outfits' }), bullets(hero.outfits.filter((o) => o.id !== hero.outfit?.id).map((o) => `${o.title}${o.tier ? ` · ${o.tier}` : ' · unranked'}`))] : null,
      h('h4', { text: 'Her story, section by section' }),
      h('ul', { class: 'list checklist' },
        todo('Title', b.title), todo('Logline', b.logline), todo('Story type (theme)', b.theme),
        todo('Her bible: background, goals, objectives, virtue, flaw, voice, look, career echoes', !(entry.toWrite ?? []).includes('bible')),
        (b.chapters ?? []).map((ch) => todo(`Chapter ${ch.n}${ch.n <= 2 ? (ch.n === 1 ? ' · the junior circuit' : ' · her career’s climax') : ' · a new story'}`, ch.title && ch.summary)),
        h('li', { class: 'todo' }, h('b', { text: 'Bosses' }), ': to be decided (SC20)'),
      ),
    ),
    h('div', {},
      tagPanel(hero.id),
      h('h3', { class: tagsOf(hero.id) ? 'section-head' : null, text: 'The five she faces' }),
      h('div', { class: 'bosses' }, [1, 2, 3, 4, 5].map((n) => h('div', { class: `boss ${n === 5 ? 'final' : ''}` },
        h('span', { class: `face lg initials ${n === 5 ? 'final' : ''}`, text: '?' }),
        h('div', {}, h('div', { class: 'ch-num', text: `Chapter ${n} · ${CHAPTER_LEVELS(n)}${n === 5 ? ' · final boss' : ''}` }), h('div', { class: 'boss-name muted', text: 'To be decided' }))))),
      hero.sources?.pageUrl ? h('p', { class: 'small' }, h('a', { href: hero.sources.pageUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Her public page on gametora.com' }), ' (source material, not our story)') : null,
    ),
  )
}

function overviewTab(b, hero) {
  const hb = b.heroBible
  const heroSide = hb
    ? h('div', { class: 'panel prose' },
        h('h2', { text: `${hero.name}` }),
        hb.background ? [h('h4', { text: 'Background' }), paras(hb.background)] : null,
        hb.motivation ? [h('h4', { text: 'What drives her' }), h('p', { text: hb.motivation })] : null,
        hb.goals?.length ? [h('h4', { text: 'Goals' }), bullets(hb.goals)] : null,
        hb.objectives?.length ? [h('h4', { text: 'Objectives, chapter by chapter' }), h('ol', { class: 'list' }, hb.objectives.map((o) => h('li', { text: o })))] : null,
        h('dl', { class: 'kv' },
          hb.virtue ? [h('dt', { text: 'Virtue' }), h('dd', { text: hb.virtue })] : null,
          hb.flaw ? [h('dt', { text: 'Flaw' }), h('dd', { text: hb.flaw })] : null,
          hb.voice ? [h('dt', { text: 'Voice' }), h('dd', { text: hb.voice })] : null,
          hb.look ? [h('dt', { text: 'Look' }), h('dd', { text: hb.look })] : null,
        ),
        hb.careerEchoes?.length ? [h('h4', { text: 'Echoes of her real career' }), bullets(hb.careerEchoes)] : null,
      )
    : h('div', { class: 'panel' }, h('h2', { text: hero.name }), h('p', { class: 'muted', text: b.chapters?.length
      ? 'Outline: her bible is not written yet. Her five chapters are on The road; her background, goals and voice, and each boss’s, come with the bible.'
      : 'Skeleton: her bible is not written yet. The five bosses and their ties are set; the background, goals and chapters come when this story is picked up.' }), b.premise ? paras(b.premise) : null)
  return h('div', { class: 'two' },
    heroSide,
    h('div', {},
      tagPanel(hero.id),
      h('h3', { class: tagsOf(hero.id) ? 'section-head' : null, text: 'The five she faces' }),
      h('div', { class: 'bosses' }, bossesInOrder(b).map((x) => bossRow(x))),
      b.crossings?.length ? [h('h3', { class: 'section-head', text: 'Other heroes in her story' }), h('div', { class: 'bosses' }, b.crossings.map((x) => crossingRow(x)))] : null,
    ),
  )
}

function bossRow(x) {
  const c = who(x.id)
  return h('a', { class: `boss ${x.chapter === 5 ? 'final' : ''}`, href: `#/c/${x.id}` },
    face(c, `lg ${x.chapter === 5 ? 'final' : ''}`),
    h('div', {},
      h('div', { class: 'ch-num', text: `Chapter ${x.chapter} · ${franchiseTitle(c.franchise)}${x.chapter === 5 ? ' · final boss' : ''}` }),
      h('div', { class: 'boss-name', text: c.name }),
      x.epithet ? h('div', { class: 'boss-epithet', text: x.epithet }) : null,
      h('div', { class: 'boss-tie' }, h('b', { text: `${x.tie?.kind ?? 'tie'}: ` }), x.tie?.summary ?? ''),
    ),
  )
}
function crossingRow(x) {
  const c = who(x.hero), other = D.bundles.get(x.hero)?.bundle
  return h('a', { class: 'boss', href: `#/s/${x.hero}` },
    face(c, 'lg'),
    h('div', {},
      h('div', { class: 'ch-num', text: `${x.kind}${x.source === 'real' ? ' · from her real career' : ''}${x.checked === false ? ' · to check' : ''}` }),
      h('div', { class: 'boss-name', text: c.name }),
      other ? h('div', { class: 'boss-epithet', text: other.title }) : null,
      h('div', { class: 'boss-tie', text: x.summary }),
    ),
  )
}

const tourneyOf = (id) => D.data.world?.circuit?.find((e) => e.id === id)
const hostName = (e) => (e.host === 'beyond' ? `beyond the rim, from ${D.cities.get(e.port)?.name ?? e.port}` : D.cities.get(e.host)?.name ?? e.host)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function tourneyChip(id) {
  const e = tourneyOf(id)
  return h('a', { class: 'chip', href: `#/world`, title: e ? `${e.grade} · ${MONTHS[e.month - 1]} · ${hostName(e)}` : 'Not in the circuit', text: e ? `${e.name} · ${e.grade}` : id })
}
function chaptersOf(b) {
  const list = b.chapters?.length ? b.chapters : bossesInOrder(b).map((x) => ({ n: x.chapter, boss: x.id }))
  return [...list].sort((a, c) => a.n - c.n)
}
function roadTab(b) {
  const list = chaptersOf(b)
  return h('div', {},
    h('div', { class: 'road' }, list.map((ch) => {
      const boss = ch.boss ? who(ch.boss) : null, city = D.cities.get(ch.city)
      return h('div', { class: `stop ${ch.n === 5 ? 'final' : ''}` },
        h('div', { class: 'ch-num', text: `Chapter ${ch.n} · ${CHAPTER_LEVELS(ch.n)}` }),
        boss ? h('a', { href: `#/c/${boss.id}` }, face(boss, ch.n === 5 ? 'final' : '')) : null,
        h('div', { class: 'stop-title', text: ch.title ?? (boss ? `vs ${boss.name}` : `Chapter ${ch.n}`) }),
        h('div', { class: 'stop-place', text: city ? `${city.name} · ${city.biome}` : 'Town not chosen yet' }),
        ch.careerBeat ? h('div', { class: 'career', text: ch.careerBeat }) : null,
        ch.tourneys?.length ? h('div', { class: 'row' }, ch.tourneys.map((id) => tourneyChip(id))) : null,
        ch.summary ? h('p', { class: 'small', text: ch.summary }) : b.status === 'placeholder' ? h('p', { class: 'small todo', text: `To write${ch.n <= 2 ? `: ${ch.n === 1 ? 'the junior circuit' : 'her career’s climax'}, on its tourneys` : ': a new story'}; boss to be decided.` }) : null,
        ch.beats?.length ? h('ul', {}, ch.beats.map((x) => h('li', { text: x }))) : null,
      )
    })),
    b.chapters?.length ? null : h('p', { class: 'muted', text: 'Not outlined yet: the road shows the boss order only.' }),
  )
}

// The relationship web: the hero in the middle, her five bosses round her, their links between, other stories outside.
function webTab(b) {
  const W = 1100, H = 920, cx = W / 2, cy = H / 2, R = 285, OUT = 410
  const order = bossesInOrder(b)
  const angle = (n) => ((90 + 72 * (n % 5)) * Math.PI) / 180
  const pos = new Map([[b.hero, { x: cx, y: cy, r: 70 }]])
  for (const x of order) pos.set(x.id, { x: cx + R * Math.cos(angle(x.chapter)), y: cy + R * Math.sin(angle(x.chapter)), r: x.chapter === 5 ? 58 : 48 })
  const outside = []
  for (const l of b.links ?? []) for (const id of [l.from, l.to]) if (!pos.has(id) && !outside.includes(id)) outside.push(id)
  outside.forEach((id, i) => {
    const anchor = (b.links ?? []).find((l) => l.from === id || l.to === id), near = pos.get(anchor.from === id ? anchor.to : anchor.from)
    // Swing toward the horizontal, away from the labels above and below the ring.
    const a0 = Math.atan2(near.y - cy, near.x - cx), sides = [a0 + 0.5, a0 - 0.5].sort((p, q) => Math.abs(Math.sin(p)) - Math.abs(Math.sin(q)))
    const a = sides[i % 2 ? 1 : 0]
    pos.set(id, { x: cx + OUT * Math.cos(a), y: cy + OUT * Math.sin(a) * 0.9, r: 32, outside: true })
  })
  const defs = s('defs', {}, [...pos].map(([id, p], i) => s('clipPath', { id: `clip-${i}` }, s('circle', { cx: p.x, cy: p.y, r: p.r }))))
  const clipOf = new Map([...pos.keys()].map((id, i) => [id, `url(#clip-${i})`]))
  const pill = (x, y, label) => { const w = Math.max(48, label.length * 6.6 + 18); return s('g', {}, s('rect', { class: 'pill', x: x - w / 2, y: y - 11, width: w, height: 22, rx: 11 }), s('text', { class: 'label', x, y: y + 4, 'text-anchor': 'middle', text: label })) }
  const marker = (x, y, n) => s('g', {}, s('circle', { class: 'pill', cx: x, cy: y, r: 12 }), s('text', { class: 'label', x, y: y + 4, 'text-anchor': 'middle', text: n }))
  const edges = [], labels = []
  for (const x of order) {
    const a = pos.get(b.hero), c = pos.get(x.id)
    edges.push(s('line', { class: 'edge tie', x1: a.x, y1: a.y, x2: c.x, y2: c.y }))
    labels.push(pill(a.x + (c.x - a.x) * 0.5, a.y + (c.y - a.y) * 0.5, x.tie?.kind ?? 'tie'))
  }
  ;(b.links ?? []).forEach((l, n) => {
    const a = pos.get(l.from), c = pos.get(l.to)
    const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2, dx = mx - cx, dy = my - cy, len = Math.hypot(dx, dy) || 1
    // Neighbours bow outward a little; links across the ring bow out far enough to clear the middle.
    const bend = a.outside || c.outside ? 0 : len < R * 0.6 ? R * 0.95 - len : 60
    const qx = mx + (dx / len) * bend, qy = my + (dy / len) * bend
    edges.push(s('path', { class: `edge ${a.outside || c.outside ? 'cross' : ''}`, d: `M${a.x},${a.y} Q${qx},${qy} ${c.x},${c.y}` }))
    labels.push(marker((a.x + 2 * qx + c.x) / 4, (a.y + 2 * qy + c.y) / 4, n + 1))
  })
  const nodes = [...pos].map(([id, p]) => {
    const c = who(id), isHero = id === b.hero, x = order.find((o) => o.id === id)
    const sub = x ? `Ch ${x.chapter} · ${franchiseTitle(c.franchise)}` : p.outside ? `from “${D.bundles.get(D.bossStory.get(id))?.bundle.title ?? 'another story'}”` : null
    const above = !isHero && p.y < cy - 60, y1 = above ? p.y - p.r - 26 : p.y + p.r + 18
    return s('a', { href: isHero ? `#/s/${id}` : `#/c/${id}` },
      c.images?.face ? s('image', { href: c.images.face, x: p.x - p.r, y: p.y - p.r, width: p.r * 2, height: p.r * 2, preserveAspectRatio: 'xMidYMin slice', 'clip-path': clipOf.get(id) }) : s('circle', { cx: p.x, cy: p.y, r: p.r, fill: 'var(--panel-2)' }),
      s('circle', { class: isHero ? 'hero-ring' : `ring ${x?.chapter === 5 ? 'final' : ''}`, cx: p.x, cy: p.y, r: p.r }),
      s('text', { class: 'name', x: p.x, y: y1, 'text-anchor': 'middle', text: c.name }),
      sub ? s('text', { class: 'label', x: p.x, y: y1 + 15, 'text-anchor': 'middle', text: sub }) : null,
    )
  })
  return h('div', { class: 'web-wrap' },
    s('svg', { class: 'web', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Relationship web' }, defs, edges, nodes, labels),
    h('div', { class: 'legend-list' },
      h('h3', { text: 'Ties to her' }),
      order.map((x) => h('div', { class: 'legend-item' }, h('b', { text: `${who(x.id).name} — ${x.tie?.kind}` }), h('div', { text: x.tie?.summary }))),
      b.links?.length ? h('h3', { class: 'section-head', text: 'Between them' }) : null,
      (b.links ?? []).map((l, n) => h('div', { class: 'legend-item' }, h('b', { text: `${n + 1}. ${who(l.from).name} ↔ ${who(l.to).name} — ${l.kind}` }), h('div', { text: l.summary }))),
    ),
  )
}

function scenesTab(b) {
  if (!b.scenes?.length) return h('p', { class: 'empty', text: 'No scenes yet. Scenes come after the bible is read and liked.' })
  return h('div', { class: 'bosses' }, b.scenes.map((sc) => {
    const city = D.cities.get(sc.place), kinds = [...new Set(sc.steps.map((x) => x.t))]
    return h('a', { class: 'boss', href: `#/play/${b.hero}/${sc.id}` },
      h('span', { class: 'face lg initials', text: '▶' }),
      h('div', {},
        h('div', { class: 'ch-num', text: `${sc.chapter ? `Chapter ${sc.chapter} · ` : ''}${city ? city.name : sc.place ?? ''} · ${sc.steps.length} steps` }),
        h('div', { class: 'boss-name', text: sc.title }),
        sc.about ? h('div', { class: 'boss-tie', text: sc.about }) : null,
        h('div', { class: 'row small', vars: {} }, kinds.map((k) => h('span', { class: `badge ${D.data.steps[k]?.game ? 'game' : 'new'}`, text: k }))),
      ),
    )
  }))
}

function reviewTab(heroId, entry, onReview) {
  const current = review(heroId) ?? { status: null, note: '' }
  let status = current.status
  const note = h('textarea', { rows: 8, class: 'panel', style: null })
  note.value = current.note ?? ''
  note.style.width = '100%'; note.style.color = 'inherit'; note.style.font = 'inherit'
  const buttons = [['liked', 'I like it'], ['rework', 'Rework'], ['question', 'Question'], [null, 'Clear']]
  const row = h('div', { class: 'row' })
  const draw = () => { row.replaceChildren(...buttons.map(([id, label]) => h('button', { class: `btn ${status === id && id ? 'on' : ''}`, onclick: () => { status = id; draw() }, text: label }))) }
  draw()
  const saved = h('span', { class: 'muted small', text: current.updatedAt ? `Saved ${new Date(current.updatedAt).toLocaleString()}` : '' })
  return h('div', { class: 'two' },
    h('div', { class: 'panel' },
      h('h3', { text: 'Your read' }),
      h('p', { class: 'muted small', text: 'Saved to content/stories/reviews.json, next to the bundles, so the next session reads your note before it writes.' }),
      row, h('div', { class: 'section-head' }), note,
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { saved.textContent = 'Saving…'; try { await onReview({ hero: heroId, status, note: note.value }); saved.textContent = 'Saved' } catch (e) { saved.textContent = `Not saved: ${e.message}` } }, text: 'Save note' }), saved),
    ),
    h('div', { class: 'panel' },
      h('h3', { text: 'Authoring checks' }),
      entry.issues.length ? h('ul', { class: 'issues' }, entry.issues.map((i) => h('li', { text: i }))) : h('p', { class: 'muted', text: entry.bundle.status === 'placeholder'
        ? 'No problems: every section is here, empty, waiting for its batch. The boss and outline checks start when she becomes a skeleton.'
        : 'No problems: five bosses, one from each franchise, the final one from the finale franchise, every speaker in her scene’s cast.' }),
      h('p', { class: 'muted small', text: `File: content/stories/${entry.file}` }),
    ),
  )
}

// ── One character ─────────────────────────────────────────────────────────────
export function characterView(id) {
  const c = who(id), heroStory = D.bundles.get(id)?.bundle, storyHero = D.bossStory.get(id)
  const story = storyHero ? D.bundles.get(storyHero)?.bundle : null
  const role = story?.bosses?.find((x) => x.id === id)
  const p = c.profile
  const links = D.data.bundles.flatMap((e) => (e.bundle.links ?? []).filter((l) => l.from === id || l.to === id).map((l) => ({ ...l, story: e.bundle })))
  const crossings = D.data.bundles.flatMap((e) => (e.bundle.crossings ?? []).filter((x) => x.hero === id).map((x) => ({ ...x, story: e.bundle })))
  const host = (u) => { try { return new URL(u).host } catch { return '' } }
  return h('div', { class: 'char' },
    h('div', { class: 'char-art' }, art(c)),
    h('div', {},
      h('div', { class: 'row' }, h('span', { class: 'chip', text: c.role === 'hero' ? (c.sister ? 'Hero · a sister' : 'Hero') : franchiseTitle(c.franchise) }), tierChip(c), (c.details ?? []).map((d) => h('span', { class: 'chip', text: d })), role ? h('span', { class: 'chip', text: `Chapter ${role.chapter}${role.chapter === 5 ? ' · final boss' : ''}` }) : null),
      h('h1', { text: c.name }),
      role?.epithet ? h('div', { class: 'boss-epithet', text: role.epithet }) : c.outfit?.title ? h('div', { class: 'boss-epithet', text: `Outfit: ${c.outfit.title}` }) : null,
      heroStory ? h('p', {}, 'Her story: ', h('a', { href: `#/s/${id}`, text: heroStory.title ?? 'a placeholder, to write' }), heroStory.status === 'placeholder' ? ` (batch ${c.batch})` : '') : null,
      c.sister ? h('div', { class: 'panel prose' }, h('h4', { text: `${sisterLine(c)}, ${c.sister.age}` }), h('p', { text: c.sister.profile }), h('p', { class: 'small' }, 'Her sister: ', h('a', { href: `#/c/${c.sister.of}`, text: c.sister.ofName }), D.byId.has(c.sister.of) ? '' : ' (not in the ten tiers)')) : null,
      c.role === 'hero' && c.outfits?.length > 1 ? h('p', { class: 'small muted', text: `Her outfits: ${c.outfits.map((o) => `${o.title}${o.id === c.outfit?.id ? ' (in the tiers)' : o.tier ? ` · ${o.tier}` : ' · unranked'}`).join(' · ')}` }) : null,
      c.role === 'hero' ? siblingsOf(c) : null,
      c.role === 'hero' ? tiesList(id) : null,
      story ? h('p', {}, 'In ', h('a', { href: `#/s/${story.hero}` }, `${who(story.hero).name}’s story, “${story.title}”`), role?.role ? ` — ${role.role}` : '') : c.role === 'boss' ? h('p', { class: 'muted', text: 'Not placed in any story yet.' }) : null,
      role ? h('div', { class: 'panel prose' },
        h('h4', { text: `Her tie to ${who(story.hero).name}: ${role.tie?.kind}` }), h('p', { text: role.tie?.summary }),
        role.background ? [h('h4', { text: 'In this world' }), paras(role.background)] : null,
        role.want ? [h('h4', { text: 'What she wants' }), h('p', { text: role.want })] : null,
        role.wound ? [h('h4', { text: 'Her wound' }), h('p', { text: role.wound })] : null,
        role.voice ? [h('h4', { text: 'How she speaks' }), h('p', { text: role.voice })] : null,
        role.fight ? [h('h4', { text: 'The fight' }), h('p', { text: role.fight })] : null,
        role.fate ? [h('h4', { text: 'How her chapter ends' }), h('p', { text: role.fate })] : null,
      ) : null,
      links.length ? [h('h3', { class: 'section-head', text: 'Her links' }), h('div', { class: 'legend-list' }, links.map((l) => { const other = who(l.from === id ? l.to : l.from); return h('a', { class: 'boss', href: `#/c/${other.id}` }, face(other, 'lg'), h('div', {}, h('div', { class: 'ch-num', text: `${l.kind} · in “${l.story.title}”` }), h('div', { class: 'boss-name', text: other.name }), h('div', { class: 'boss-tie', text: l.summary }))) }))] : null,
      crossings.length ? [h('h3', { class: 'section-head', text: 'In other heroes’ stories' }), h('div', { class: 'legend-list' }, crossings.map((x) => h('a', { class: 'boss', href: `#/s/${x.story.hero}` }, face(who(x.story.hero), 'lg'), h('div', {}, h('div', { class: 'ch-num', text: `${x.kind} · “${x.story.title}”` }), h('div', { class: 'boss-tie', text: x.summary })))))] : null,
      p ? h('div', { class: 'section-head' }) : null,
      p ? h('div', { class: 'public' },
        h('h4', { text: 'Her public profile (source material, not our story)' }),
        p.title || p.affiliation ? h('p', {}, h('b', { text: [p.title, p.affiliation, p.extra].filter(Boolean).join(' · ') })) : null,
        p.summary ? h('p', { text: p.summary }) : null,
        p.source ? h('p', { class: 'small' }, h('a', { href: p.source, target: '_blank', rel: 'noopener noreferrer', text: `Read more on ${host(p.source)}` })) : null,
      ) : null,
      c.sources?.pageUrl && !p?.source ? h('p', { class: 'small' }, h('a', { href: c.sources.pageUrl, target: '_blank', rel: 'noopener noreferrer', text: `Her public page on ${host(c.sources.pageUrl)}` })) : null,
    ),
  )
}

// ── Relationships (Q59, SC11–SC16) ───────────────────────────────────────────
const KIN = new Set(['mother', 'sister', 'twin', 'kin'])
const edgeClass = (r) => `${KIN.has(r.kind) ? 'kin' : r.kind === 'rival' || r.kind === 'nemesis' ? 'rival' : ''} ${r.weight === 'major' ? 'major' : ''}`
const relData = () => D.data.relationships
const eraOfUma = (id) => relData()?.eras?.find((e) => e.id === relData()?.umas?.[id]?.era)
const circleOfUma = (id) => relData()?.circles?.find((c) => c.members.includes(id))
const eraYears = (e) => (e.from && e.to ? `${e.from}–${e.to}` : e.to ? `to ${e.to}` : `${e.from} on`)
/** Her relationships with the other Uma, the major ones first (the model's tiesOf, on the page). */
function tiesOfUma(id) {
  return (relData()?.relationships ?? []).filter((r) => r.a === id || r.b === id).map((r) => ({ ...r, other: r.a === id ? r.b : r.a }))
    .sort((x, y) => (x.weight === y.weight ? 0 : x.weight === 'major' ? -1 : 1))
}
/** A sister's tie that mirrors her sibling's (SC23): " · mirrors A ↔ B". */
function mirrorNote(t) {
  const m = t.mirrors ? relData()?.relationships?.find((x) => x.id === t.mirrors) : null
  return m ? ` · mirrors ${who(m.a).name} ↔ ${who(m.b).name}` : ''
}
/** Her ties in the cast, as rows: the other Uma, the kind, the line, and whether it is real or ours. */
function tiesList(id, title = 'Her ties in the cast') {
  const ties = tiesOfUma(id)
  if (!relData()) return null
  const era = eraOfUma(id), circle = circleOfUma(id)
  return h('div', {},
    h('h3', { class: 'section-head', text: `${title} · ${ties.length}` }),
    h('div', { class: 'row small' }, era ? h('a', { class: 'chip', href: `#/rel/${era.id}`, text: `${era.name} · ${eraYears(era)}` }) : null, circle ? h('a', { class: 'chip', href: `#/rel/${circle.era}`, text: `${circle.name} (${circle.kind})` }) : null),
    h('div', { class: 'legend-list', style: null }, ties.map((t) => { const o = who(t.other); return h('a', { class: `boss tie-row ${t.weight}`, href: `#/c/${t.other}` },
      face(o, 'lg'),
      h('div', {},
        h('div', { class: 'ch-num', text: `${t.kind} · ${t.weight} · ${t.source === 'real' ? 'from the record' : 'ours'}${t.via ? ` · through ${t.via}` : ''}${mirrorNote(t)}` }),
        h('div', { class: 'boss-name', text: o.name }),
        h('div', { class: 'boss-tie', text: t.line }))) })),
  )
}
/** One circle as a small ring: its Umas round it, the relationships among them drawn between. */
function circleGraph(c) {
  const W = 300, cx = W / 2, R = 100, r = 22, n = c.members.length
  const pos = new Map(c.members.map((id, i) => { const a = (-90 + (360 / n) * i) * Math.PI / 180; return [id, { x: cx + R * Math.cos(a), y: cx + R * Math.sin(a) }] }))
  const inside = (relData()?.relationships ?? []).filter((x) => pos.has(x.a) && pos.has(x.b))
  return s('svg', { class: 'web circle-graph', viewBox: `0 0 ${W} ${W}`, role: 'img', 'aria-label': `${c.name}: ${inside.length} relationships` },
    s('defs', {}, c.members.map((id, i) => { const p = pos.get(id); return s('clipPath', { id: `cg-${c.id}-${i}` }, s('circle', { cx: p.x, cy: p.y, r })) })),
    inside.map((x) => { const a = pos.get(x.a), b = pos.get(x.b); return s('line', { class: `edge ${edgeClass(x)}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y }, s('title', { text: `${who(x.a).name} ↔ ${who(x.b).name}: ${x.kind}. ${x.line}` })) }),
    c.members.map((id, i) => { const p = pos.get(id), u = who(id); return s('a', { href: `#/c/${id}` },
      u.images?.face ? s('image', { href: u.images.face, x: p.x - r, y: p.y - r, width: r * 2, height: r * 2, preserveAspectRatio: 'xMidYMin slice', 'clip-path': `url(#cg-${c.id}-${i})` }) : s('circle', { cx: p.x, cy: p.y, r, fill: 'var(--panel-2)' }),
      s('circle', { class: 'ring', cx: p.x, cy: p.y, r }),
      s('title', { text: `${u.name}: ${tiesOfUma(id).length} ties` })) }),
  )
}
// The Relationships page: era boards, a graph per circle, the moves, and the least connected.
export function relationshipsView(focus) {
  const rel = relData()
  if (!rel) return h('div', {}, h('h1', { text: 'Relationships' }), h('p', { class: 'empty', text: 'No content/stories/relationships.json yet.' }))
  const heroes = D.data.pack.characters.filter((c) => c.role === 'hero')
  const count = new Map(heroes.map((c) => [c.id, tiesOfUma(c.id).length]))
  const least = [...heroes].sort((a, b) => count.get(a.id) - count.get(b.id)).slice(0, 10)
  const all = rel.relationships
  const circleOf = new Map(rel.circles.flatMap((c) => c.members.map((m) => [m, c.id])))
  const inCircle = all.filter((x) => circleOf.get(x.a) === circleOf.get(x.b)).length
  const eras = focus ? rel.eras.filter((e) => e.id === focus) : rel.eras
  return h('div', {},
    h('h1', { text: 'Relationships' }),
    h('p', { class: 'muted', text: 'The cast in eight eras by classic year, circles of three to eight inside each era, and the ties among them: inside the circles first, then across them for family and famous rivalries (story-cast.md SC11–SC16). Each era’s Ranker sisters form one circle that mirrors their siblings’ ties, level by level (SC23). Gold is family, red is rivalry; a thick line is a major tie. Hover a line for its story, a face for her tie count; a face opens her page.' }),
    D.data.relationshipIssues?.length ? h('div', { class: 'error-box' }, h('b', { text: 'The relationships' }), h('ul', { class: 'list' }, D.data.relationshipIssues.map((i) => h('li', { text: i })))) : null,
    h('div', { class: 'summary' },
      stat(all.length, 'relationships'),
      stat(all.filter((x) => x.source === 'real').length, 'from the record, the rest ours'),
      stat(all.filter((x) => x.weight === 'major').length, 'major'),
      stat(inCircle, 'inside a circle'),
      stat(rel.circles.length, `circles in ${rel.eras.length} eras`),
      stat((all.length * 2 / heroes.length).toFixed(1), 'ties an Uma on average'),
    ),
    focus ? null : [h('h2', { class: 'section-head', text: `The whole cast · ${heroes.length} Umas, ${all.length} ties` }), castRing()],
    h('h2', { class: 'section-head', text: 'The circles, era by era' }),
    h('div', { class: 'filters' },
      h('a', { class: `chip ${focus ? 'off' : ''}`, href: '#/rel', text: 'All eras' }),
      rel.eras.map((e) => h('a', { class: `chip ${focus && focus !== e.id ? 'off' : ''}`, href: `#/rel/${e.id}`, text: `${e.name} · ${heroes.filter((c) => rel.umas[c.id]?.era === e.id).length}` }))),
    eras.map((e) => {
      const circles = rel.circles.filter((c) => c.era === e.id)
      const members = heroes.filter((c) => rel.umas[c.id]?.era === e.id)
      return h('section', { class: 'era-board' },
        h('div', { class: 'section-head' }, h('h2', { text: `${e.name} · ${eraYears(e)}` }), h('span', { class: 'muted small', text: `${members.length} Umas in ${circles.length} circle${circles.length === 1 ? '' : 's'}` })),
        h('div', { class: 'cards circles' }, circles.map((c) => h('div', { class: 'panel circle-card' },
          h('div', { class: 'row' }, h('b', { text: c.name }), h('span', { class: 'chip', text: c.kind })),
          c.about ? h('div', { class: 'small muted', text: c.about }) : null,
          circleGraph(c),
          h('div', { class: 'small circle-names', text: c.members.map((m) => `${who(m).name} (${count.get(m)})`).join(' · ') })))))
    }),
    focus ? null : [
      h('h2', { class: 'section-head', text: 'The least connected' }),
      h('p', { class: 'muted small' }, 'Ranked by ties; the full ranking is on ', h('a', { href: '#/counts', text: 'the Counts page' }), '.'),
      h('div', { class: 'row tag-umas' }, least.map((c) => h('a', { class: 'chip', href: `#/c/${c.id}`, text: `${c.name} · ${count.get(c.id)}` }))),
      rel.moves?.length ? [h('h2', { class: 'section-head', text: 'Moves made to fill the circles' }), h('p', { class: 'muted small', text: 'Loose on purpose (SC13): every move, with its reason.' }),
        h('table', { class: 'table' }, h('tr', {}, ['Uma', 'From', 'To', 'Why'].map((x) => h('th', { text: x }))),
          rel.moves.map((m) => h('tr', {}, h('td', {}, h('a', { href: `#/c/${m.uma}`, text: who(m.uma).name })), h('td', { class: 'small', text: m.from }), h('td', { class: 'small', text: rel.circles.find((c) => c.id === m.to)?.name ?? m.to }), h('td', { class: 'small', text: m.why }))))] : null,
      dualsSection(),
    ],
  )
}

// ── The Tags page (Q58, SC10) ─────────────────────────────────────────────────
// Each vocabulary with its mapping to the game, and the Umas under each tag.
export function tagsView() {
  const tags = D.data.tags
  if (!tags) return h('div', {}, h('h1', { text: 'The tags' }), h('p', { class: 'empty', text: 'No content/stories/tags.json yet.' }))
  const voc = tags.vocabularies
  const heroes = D.data.pack.characters.filter((c) => c.role === 'hero')
  const under = (set, id) => heroes.filter((c) => tags.umas[c.id]?.[set]?.id === id)
  const faces = (list, set) => h('div', { class: 'row tag-umas' }, list.map((c) => h('a', { href: `#/s/${c.id}`, title: `${c.name}: ${tags.umas[c.id][set].why}` }, face(c, 'sm'))))
  const count = (n) => h('span', { class: `tag-count ${n ? '' : 'none'}`, text: n })
  const used = (set, list) => list.filter((x) => under(set, x.id ?? x).length).length
  return h('div', {},
    h('h1', { text: 'The tags' }),
    h('p', { class: 'muted', text: 'Three tags for every Uma, chosen from her real career and her known character, each with a one-line reason (story-cast.md SC5–SC10). Her story class gives her Way; her personality maps to one of the game’s eight faces; her story type is one of the setting’s themes. Nothing is set to a quota: the counts come next (Q60). Hover a face for her reason; a tag opens her stories.' }),
    D.data.tagIssues?.length ? h('div', { class: 'error-box' }, h('b', { text: 'The tags' }), h('ul', { class: 'list' }, D.data.tagIssues.map((i) => h('li', { text: i })))) : null,
    h('div', { class: 'summary' },
      stat(heroes.filter((c) => tags.umas[c.id]).length, `of ${heroes.length} Umas tagged`),
      stat(used('class', voc.classes), `of ${voc.classes.length} story classes in use`),
      stat(used('personality', voc.personalities), `of ${voc.personalities.length} personalities in use`),
      stat(used('story', voc.storyTypes), `of ${voc.storyTypes.length} story types in use`),
    ),
    h('h2', { class: 'section-head', text: 'Story classes, by Way' }),
    voc.ways.map((w) => {
      const classes = voc.classes.filter((c) => c.way === w.id)
      const n = heroes.filter((c) => D.classById.get(tags.umas[c.id]?.class?.id)?.way === w.id).length
      return h('section', { class: 'panel tag-group' },
        h('div', { class: 'section-head' }, h('h3', {}, h('a', { href: `#/w/${w.id}`, title: 'Her stories on this Way', text: `The Way of the ${w.name}` })), h('span', { class: 'muted small', text: `${w.home} · starts as ${w.starts.join(' or ')} · ${n} Umas` })),
        h('table', { class: 'table' }, h('tr', {}, ['Story class', 'Starts as', 'Tier 2 branch', 'Umas', ''].map((x) => h('th', { text: x }))),
          classes.map((c) => { const list = under('class', c.id); return h('tr', { class: list.length ? '' : 'unused' },
            h('td', {}, tagLink('class', c.id, c.name), c.note ? h('div', { class: 'small muted', text: c.note }) : null),
            h('td', { class: 'small', text: c.start }), h('td', { class: 'small', text: c.branch ?? '—' }),
            h('td', {}, faces(list, 'class')), h('td', {}, count(list.length))) })))
    }),
    h('h2', { class: 'section-head', text: 'Personalities, by face type' }),
    h('p', { class: 'muted small', text: 'A personality marked * is a candidate for a face set of its own, if several Umas carry it (SC8).' }),
    voc.faces.map((f) => {
      const list = voc.personalities.filter((p) => p.face === f)
      const n = heroes.filter((c) => D.persById.get(tags.umas[c.id]?.personality?.id)?.face === f).length
      return h('section', { class: 'panel tag-group' },
        h('div', { class: 'section-head' }, h('h3', { text: `Face: ${f}` }), h('span', { class: 'muted small', text: `${n} Umas` })),
        h('table', { class: 'table' }, list.map((p) => { const who2 = under('personality', p.id); return h('tr', { class: who2.length ? '' : 'unused' },
          h('td', {}, tagLink('personality', p.id, `${p.id}${p.candidate ? '*' : ''}`)), h('td', {}, faces(who2, 'personality')), h('td', {}, count(who2.length))) })))
    }),
    h('h2', { class: 'section-head', text: 'Story types' }),
    h('section', { class: 'panel tag-group' }, h('table', { class: 'table' }, voc.storyTypes.map((s) => {
      const list = under('story', s), t = D.themes.get(s)
      return h('tr', { class: list.length ? '' : 'unused' }, h('td', {}, tagLink('story', s, t?.name ?? s, { vars: { '--theme': t?.color } })), h('td', { class: 'small muted', text: t?.blurb ?? '' }), h('td', {}, faces(list, 'story')), h('td', {}, count(list.length)))
    }))),
  )
}

// Her sisters in the cast, or the sister she's named for.
function siblingsOf(c) {
  const family = D.data.pack.characters.filter((x) => x.role === 'hero' && x.id !== c.id && x.characterId === c.characterId)
  if (!family.length) return null
  return h('div', {}, h('h3', { class: 'section-head', text: 'Her family in the cast' }), h('div', { class: 'legend-list' }, family.map((x) => h('a', { class: 'boss', href: `#/c/${x.id}` },
    face(x, 'lg'), h('div', {}, h('div', { class: 'ch-num', text: `${x.sister ? x.sister.relation : 'the sister she is named for'} · ${x.tier}` }), h('div', { class: 'boss-name', text: x.name }), x.sister ? h('div', { class: 'boss-tie', text: x.sister.age }) : null)))))
}

// ── The cast ──────────────────────────────────────────────────────────────────
export function castView() {
  const p = D.data.pack, r = p.ranker
  return h('div', {},
    h('h1', { text: 'The cast' }),
    h('p', { class: 'muted', text: r
      ? `From the Uma Ranker: Playable Umas at board revision ${r.boardRevision}, the profiles at revision ${r.profilesRevision}, the plan of ${new Date(r.planGeneratedAt).toLocaleString()}. The bosses are carried over from ${r.bossesFrom} until the boss approach is decided. Each Uma’s story, and the story each boss is placed in.`
      : `From the Studio’s ${p.tier} export of ${new Date(p.exportedAt).toLocaleDateString()}: each hero’s story, and the story each boss is placed in.` }),
    D.data.pack.franchises.map((f) => h('section', { class: 'franchise' },
      h('div', { class: 'section-head' }, h('h2', { text: f.title }), h('span', { class: 'muted small', text: `${f.count} ${f.role === 'hero' ? 'heroes' : 'bosses'} · ${D.factions.get(f.id)?.name ?? ''}` })),
      h('div', { class: 'cast' }, D.data.pack.characters.filter((c) => c.franchise === f.id).map((c) => {
        const storyHero = c.role === 'hero' ? (D.bundles.has(c.id) ? c.id : null) : D.bossStory.get(c.id)
        const st = storyHero ? D.bundles.get(storyHero).bundle : null
        return h('a', { href: c.role === 'hero' ? `#/s/${c.id}` : `#/c/${c.id}` }, face(c), h('b', { text: c.name }),
          st ? h('span', { class: `where ${st.status === 'placeholder' ? 'unplaced' : ''}` }, c.role === 'boss' ? face(who(storyHero), 'sm') : null, c.role === 'boss' ? `Ch ${st.bosses.find((x) => x.id === c.id)?.chapter} · ${who(storyHero).name}` : `${c.tier ? `${c.tier} · ` : ''}${st.title ?? 'placeholder'}`) : h('span', { class: 'where unplaced', text: 'unplaced' }))
      })),
    )),
  )
}

// ── The whole cast's ring (Q60; it takes the old Crossings page's place) ────
// Every Uma on one ring, era by era and circle by circle (each era's sisters last), with every relationship drawn across
// it. Hover a face to light her ties; the chips keep only the major ties, or only those from the record.
function castRing() {
  const rel = relData()
  const order = [], arcs = []
  rel.eras.forEach((e, ei) => {
    const start = order.length
    for (const c of rel.circles.filter((x) => x.era === e.id)) for (const m of c.members) order.push({ id: m, ei, circle: c })
    if (order.length > start) arcs.push({ e, ei, start, end: order.length - 1 })
  })
  const GAP = 2, slots = order.length + GAP * rel.eras.length
  const W = 1100, H = 1000, cx = W / 2, cy = H / 2, R = 390, r = 14
  const angleOf = (i, ei) => ((-90 + (360 * (i + GAP * ei + GAP / 2)) / slots) * Math.PI) / 180
  const at = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]
  const pos = new Map(order.map((o, i) => { const [x, y] = at(R, angleOf(i, o.ei)); return [o.id, { x, y }] }))
  const arcPath = (rad, a1, a2) => { const [x1, y1] = at(rad, a1), [x2, y2] = at(rad, a2); return `M${x1},${y1} A${rad},${rad} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${x2},${y2}` }
  const near = new Map(order.map((o) => [o.id, new Set()]))
  for (const x of rel.relationships) { near.get(x.a)?.add(x.b); near.get(x.b)?.add(x.a) }
  const idle = 'Hover a face to light her ties; click it to open her page.'
  const info = h('p', { class: 'muted small ring-info', text: idle })
  let svgEl = null
  const light = (id) => {
    svgEl.classList.toggle('focus', !!id)
    for (const el of svgEl.querySelectorAll('[data-a]')) el.classList.toggle('on', !!id && (el.dataset.a === id || el.dataset.b === id))
    for (const el of svgEl.querySelectorAll('[data-node]')) el.classList.toggle('on', !!id && (el.dataset.node === id || near.get(id)?.has(el.dataset.node)))
    const ties = id ? tiesOfUma(id) : []
    info.textContent = id ? `${who(id).name} · ${circleOfUma(id)?.name ?? ''}: ${ties.length} ties, ${ties.filter((t) => t.weight === 'major').length} major, ${ties.filter((t) => t.source === 'real').length} from the record.` : idle
  }
  svgEl = s('svg', { class: 'web cast-ring', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `The whole cast: ${order.length} Umas and ${rel.relationships.length} relationships` },
    s('defs', {}, order.map((o, i) => { const p = pos.get(o.id); return s('clipPath', { id: `ring-${i}` }, s('circle', { cx: p.x, cy: p.y, r })) })),
    arcs.map(({ e, ei, start, end }) => {
      const a1 = angleOf(start, ei) - 0.03, a2 = angleOf(end, ei) + 0.03, [lx, ly] = at(R + 50, (a1 + a2) / 2)
      return s('g', {}, s('path', { class: 'era-arc', d: arcPath(R + 28, a1, a2) }), s('a', { href: `#/rel/${e.id}` }, s('text', { class: 'era-label', x: lx, y: ly + 4, 'text-anchor': 'middle', text: e.name })))
    }),
    rel.relationships.map((x) => {
      const a = pos.get(x.a), b = pos.get(x.b)
      if (!a || !b) return null
      const qx = cx + ((a.x + b.x) / 2 - cx) * 0.3, qy = cy + ((a.y + b.y) / 2 - cy) * 0.3
      return s('path', { class: `edge ${edgeClass(x)} ${x.source === 'real' ? 'real' : ''}`, 'data-a': x.a, 'data-b': x.b, d: `M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}` },
        s('title', { text: `${who(x.a).name} ↔ ${who(x.b).name}: ${x.kind}. ${x.line}` }))
    }),
    order.map((o, i) => {
      const p = pos.get(o.id), u = who(o.id)
      return s('a', { href: `#/c/${o.id}`, class: 'ring-node', 'data-node': o.id, onmouseenter: () => light(o.id), onmouseleave: () => light(null), onfocus: () => light(o.id), onblur: () => light(null) },
        u.images?.face ? s('image', { href: u.images.face, x: p.x - r, y: p.y - r, width: r * 2, height: r * 2, preserveAspectRatio: 'xMidYMin slice', 'clip-path': `url(#ring-${i})` }) : s('circle', { cx: p.x, cy: p.y, r, fill: 'var(--panel-2)' }),
        s('circle', { class: 'ring', cx: p.x, cy: p.y, r }),
        s('title', { text: `${u.name} · ${o.circle.name}` }))
    }),
  )
  const toggle = (cls, label) => h('button', { class: 'chip off', onclick: (ev) => { const on = svgEl.classList.toggle(cls); ev.currentTarget.classList.toggle('off', !on) }, text: label })
  return h('div', { class: 'ring-wrap' }, h('div', { class: 'filters' }, toggle('only-major', 'Major ties only'), toggle('only-real', 'From the record only')), svgEl, info)
}

// The dual and party stories the ties suggest (the setting's), once on the Crossings page.
function dualsSection() {
  const duals = D.data.setting?.duals ?? []
  if (!duals.length) return null
  return [h('h2', { class: 'section-head', text: 'Dual and party stories' }), h('div', { class: 'cards' }, duals.map((d) => h('div', { class: 'panel' },
    h('div', { class: 'row' }, d.heroes.map((id) => face(who(id), 'lg'))),
    h('h3', { text: d.title }), h('div', { class: 'small muted', text: `${d.mode} · ${d.heroes.map((id) => who(id).name).join(' + ')}` }), h('p', { text: d.premise }))))]
}

// ── The Counts page (Q60, SC17) ───────────────────────────────────────────────
// Every count with the Umas behind it; every Uma ranked by her ties; and the private read of what looks unbalanced.
export function countsView() {
  const c = D.data.counts
  if (!c) return h('div', {}, h('h1', { text: 'The counts' }), h('p', { class: 'empty', text: 'No counts yet.' }))
  const faces = (ids) => h('div', { class: 'row tag-umas' }, ids.map((id) => h('a', { href: `#/s/${id}`, title: who(id).name }, face(who(id), 'sm'))))
  const table = (items, label, link, extra = () => null) => {
    const max = Math.max(1, ...items.map((x) => x.n))
    return h('table', { class: 'table counts' }, items.map((x) => h('tr', { class: x.n ? '' : 'unused' },
      h('td', { class: 'count-label' }, link ? h('a', { href: link(x), text: label(x) }) : label(x), extra(x)),
      h('td', { class: 'bar-cell' }, h('span', { class: 'bar' }, h('span', { class: 'bar-fill', vars: { '--w': `${(100 * x.n) / max}%` } }))),
      h('td', {}, h('span', { class: `tag-count ${x.n ? '' : 'none'}`, text: x.n })),
      h('td', {}, faces(x.umas)))))
  }
  const notes = D.data.countsNotes?.items ?? []
  const cls = new Map((D.data.tags?.vocabularies?.classes ?? []).map((x) => [x.id, x]))
  const circleName = (id) => circleOfUma(id)?.name ?? ''
  return h('div', {},
    h('h1', { text: 'The counts' }),
    h('p', { class: 'muted', text: 'Every count of the story cast with the Umas behind it, and every Uma ranked by her relationships (story-cast.md SC17). A label opens the Umas behind it.' }),
    notes.length ? h('div', { class: 'panel notes' }, h('h3', { text: D.data.countsNotes?.title ?? 'What looks unbalanced, and what I recommend' }),
      D.data.countsNotes?.about ? h('p', { class: 'small muted', text: D.data.countsNotes.about }) : null,
      h('ol', { class: 'list' }, notes.map((n) => h('li', {}, h('b', { text: `${n.topic}: ` }), n.finding,
        n.answer ? h('div', { class: 'small answer' }, h('b', { text: 'Your answer: ' }), n.answer) : null,
        h('div', { class: 'small recommend' }, h('b', { text: n.done ? 'Done: ' : 'Recommendation: ' }), n.done ?? n.recommendation))))) : null,
    h('div', { class: 'summary' },
      stat(c.umas, 'Umas'),
      stat(c.relationships, `relationships, ${((c.relationships * 2) / Math.max(1, c.umas)).toFixed(1)} an Uma`),
      stat(c.few.length, 'with fewer than four ties'),
      stat(c.noMajor.length, 'with no major tie'),
      stat(c.unused.classes.length, 'story classes unused'),
      stat(c.candidates.filter((p) => p.n).length, 'face-set candidates in use'),
    ),
    h('h2', { class: 'section-head', text: 'Ways' }),
    table(c.ways, (x) => `The Way of the ${x.name}`, (x) => `#/w/${x.id}`),
    h('h2', { class: 'section-head', text: 'Story classes, by Way' }),
    c.ways.map((w) => [h('h3', { class: 'section-head', text: `The Way of the ${w.name}` }), table(c.classes.filter((x) => x.way === w.id), (x) => x.name, (x) => `#/t/class/${x.id}`)]),
    h('h2', { class: 'section-head', text: 'Face types' }),
    table(c.faces, (x) => x.id),
    h('h2', { class: 'section-head', text: 'Personalities, by face type' }),
    h('p', { class: 'muted small', text: 'A personality marked * is a candidate for a face set of its own (SC8).' }),
    c.faces.map((f) => [h('h3', { class: 'section-head', text: `Face: ${f.id}` }), table(c.personalities.filter((p) => p.face === f.id), (p) => `${p.id}${p.candidate ? '*' : ''}`, (p) => `#/t/personality/${p.id}`)]),
    h('h2', { class: 'section-head', text: 'Story types' }),
    table(c.storyTypes, (x) => D.themes.get(x.id)?.name ?? x.id, (x) => `#/t/story/${x.id}`),
    h('h2', { class: 'section-head', text: 'Eras' }),
    table(c.eras, (x) => x.name, (x) => `#/rel/${x.id}`),
    h('h2', { class: 'section-head', text: 'Circles' }),
    table(c.circles, (x) => x.name, (x) => `#/rel/${x.era}`, (x) => h('div', { class: 'small muted', text: x.kind })),
    h('h2', { class: 'section-head', text: 'Every Uma, ranked by her relationships' }),
    h('p', { class: 'muted small', text: 'Ties in all, then major ones. Fewer than four ties is flagged (SC15 asks about four to six), and so is no major tie.' }),
    h('table', { class: 'table ranking' }, h('tr', {}, ['#', 'Uma', 'Ties', 'Major', 'Minor', 'From the record', 'Class', 'Circle', ''].map((x) => h('th', { text: x }))),
      c.ranking.map((t) => h('tr', { class: t.few ? 'few' : '' },
        h('td', { text: t.rank }),
        h('td', {}, h('a', { class: 'row', href: `#/c/${t.id}` }, face(who(t.id), 'sm'), who(t.id).name)),
        h('td', {}, h('b', { text: t.total })), h('td', { text: t.major }), h('td', { text: t.minor }), h('td', { text: t.real }),
        h('td', { class: 'small', text: cls.get(D.data.tags?.umas?.[t.id]?.class?.id)?.name ?? '' }),
        h('td', { class: 'small muted', text: circleName(t.id) }),
        h('td', {}, t.few ? h('span', { class: 'badge flag', text: 'few ties' }) : null, !t.major ? h('span', { class: 'badge', text: 'no major' }) : null)))),
    h('h2', { class: 'section-head', text: 'Candidates for a face set of their own' }),
    table(c.candidates, (p) => `${p.id} (now on the ${p.face} face)`, (p) => `#/t/personality/${p.id}`),
  )
}

// ── The world ─────────────────────────────────────────────────────────────────
export function worldView(focus) {
  const setting = D.data.setting
  if (!setting) return h('p', { class: 'empty', text: 'No setting.json yet.' })
  const W = 980, c = W / 2, r0 = 70, ring = 64
  const regions = setting.regions
  const story = focus ? D.bundles.get(focus)?.bundle : null
  const onRoute = new Set((story?.chapters ?? []).map((ch) => ch.city))
  const polar = (rad, deg) => [c + rad * Math.cos(deg * Math.PI / 180), c + rad * Math.sin(deg * Math.PI / 180)]
  const sector = (r1, r2, a1, a2) => { const [x1, y1] = polar(r1, a1), [x2, y2] = polar(r2, a1), [x3, y3] = polar(r2, a2), [x4, y4] = polar(r1, a2); return `M${x1},${y1} L${x2},${y2} A${r2},${r2} 0 0 1 ${x3},${y3} L${x4},${y4} A${r1},${r1} 0 0 0 ${x1},${y1} Z` }
  const centre = new Map()
  const cells = []
  regions.forEach((reg, i) => {
    const a1 = -126 + 72 * i, a2 = a1 + 72
    for (let band = 1; band <= 5; band++) {
      const city = setting.cities.find((x) => x.region === reg.id && x.band === band)
      const [fill] = BIOMES[city?.biome] ?? ['#444']
      const [tx, ty] = polar(r0 + ring * (band - 0.5), (a1 + a2) / 2)
      if (city) centre.set(city.id, [tx, ty])
      cells.push(s('a', { href: city ? `#/world/${focus ?? ''}` : '#/world' },
        s('path', { class: `cell ${city && onRoute.has(city.id) ? 'on' : ''}`, d: sector(r0 + ring * (band - 1), r0 + ring * band, a1, a2), fill }),
        city ? s('text', { x: tx, y: ty + 4, text: city.name }) : null,
        city ? s('title', { text: `${city.name} — ${city.biome}, band ${band}: ${city.blurb ?? ''} (${(D.data.cross.towns?.[city.id] ?? []).length} stories)` }) : null))
    }
    const [lx, ly] = polar(r0 + ring * 5 + 22, (a1 + a2) / 2)
    cells.push(s('text', { class: 'region', x: lx, y: ly, text: reg.name }))
  })
  const hub = setting.cities.find((x) => x.region === 'hub')
  if (hub) centre.set(hub.id, [c, c])
  const route = story?.chapters?.length ? s('path', { class: 'route', d: 'M' + [...story.chapters].sort((a, b) => a.n - b.n).map((ch) => centre.get(ch.city)).filter(Boolean).map(([x, y]) => `${x},${y}`).join(' L') }) : null
  const map = s('svg', { class: 'map', viewBox: `0 0 ${W} ${W}`, role: 'img', 'aria-label': 'World map' },
    s('circle', { cx: c, cy: c, r: r0 + ring * 5 + 8, fill: 'none', stroke: 'var(--line-2)', 'stroke-width': 10 }),
    cells, s('circle', { cx: c, cy: c, r: r0, fill: BIOMES.hub[0] }), hub ? s('text', { class: 'region', x: c, y: c + 5, text: hub.name }) : null, route)
  const world = D.data.world
  const storiesIn = (ids) => h('div', { class: 'row' }, ids.map((hero) => h('a', { href: `#/s/${hero}/road`, title: D.bundles.get(hero)?.bundle.title ?? hero }, face(who(hero), 'sm'))))
  return h('div', {},
    h('h1', { text: 'The world' }),
    h('p', { class: 'muted', text: world?.summary ?? setting.summary ?? '' }),
    world ? h('p', { class: 'row small' }, ['map', 'circuit', 'towns', 'history', 'customs'].map((a) => h('a', { class: 'chip', href: `#/world`, onclick: (ev) => { ev.preventDefault(); document.getElementById(`w-${a}`)?.scrollIntoView({ behavior: 'smooth' }) }, text: { map: 'The map', circuit: 'The circuit', towns: 'The towns', history: 'History', customs: 'Customs' }[a] }))) : null,
    D.data.worldIssues?.length ? h('div', { class: 'error-box' }, h('b', { text: 'The world pack' }), h('ul', { class: 'list' }, D.data.worldIssues.map((i) => h('li', { text: i })))) : null,
    world?.principles?.length ? h('div', { class: 'panel' }, h('h3', { text: 'The world’s rules' }), bullets(world.principles)) : null,
    h('div', { class: 'world', id: 'w-map' },
      h('div', {}, map, story ? h('p', { class: 'muted' }, 'Showing ', h('a', { href: `#/s/${focus}`, text: story.title }), '’s road. ', h('a', { href: '#/world', text: 'Clear' })) : h('p', { class: 'muted small', text: 'Open a story’s “Show the route on the map” to draw its road.' })),
      h('div', { class: 'legend-list' },
        h('h3', { text: 'The five powers' }),
        setting.factions.map((f) => h('div', { class: 'legend-item' }, h('b', { text: f.name }), h('div', { class: 'small muted', text: franchiseTitle(f.franchise) }), h('div', { text: f.blurb }))),
      ),
    ),
    h('h2', { class: 'section-head', text: 'Themes' }),
    h('div', { class: 'cards' }, setting.themes.map((t) => h('div', { class: 'panel', vars: { '--theme': t.color } }, themeChip(t), h('p', { class: 'small', text: t.blurb }), h('div', { class: 'row' }, D.data.bundles.filter((b) => b.bundle.theme === t.id).map((b) => h('a', { href: `#/s/${b.bundle.hero}`, title: b.bundle.title }, face(who(b.bundle.hero), 'sm'))))))),
    world ? circuitSection(world, storiesIn) : null,
    h('h2', { class: 'section-head', id: 'w-towns', text: 'Towns' }),
    h('p', { class: 'muted small', text: `A town hosts at most ${D.data.townLimit} stories’ chapters, and every town hosts at least one.${world ? ' Each town has two dungeons: the easier (a) and the harder (b).' : ''}` }),
    world ? townsSection(world, regions, storiesIn) : h('table', { class: 'table' }, h('tr', {}, ['Town', 'Region', 'Band', 'Biome', 'What it is', 'Stories here'].map((x) => h('th', { text: x }))),
      setting.cities.map((city) => h('tr', {}, h('td', { text: city.name }), h('td', { text: regions.find((r) => r.id === city.region)?.name ?? city.region }), h('td', { text: city.band ?? '—' }), h('td', { text: city.biome }), h('td', { text: city.blurb ?? '' }),
        h('td', {}, storiesIn(D.data.cross.towns?.[city.id] ?? []))))),
    world?.history?.length ? h('div', { id: 'w-history' }, h('h2', { class: 'section-head', text: 'History' }),
      h('table', { class: 'table' }, world.history.map((x) => h('tr', {}, h('td', {}, h('b', { text: x.era })), h('td', { class: 'small muted', text: x.when ?? '' }), h('td', { text: x.text }))))) : null,
    world?.customs?.length ? h('div', { id: 'w-customs' }, h('h2', { class: 'section-head', text: 'Customs' }),
      h('div', { class: 'cards' }, world.customs.map((x) => h('div', { class: 'panel' }, h('h3', { text: x.name }), paras(x.text))))) : null,
  )
}

// The tourney circuit, by month: each event's grade, host, format, who may enter, and the stories built on it.
function circuitSection(world, storiesIn) {
  const formats = new Map(world.formats.map((f) => [f.id, f]))
  const used = D.data.cross.tourneys ?? {}
  const rows = [...world.circuit].sort((a, b) => a.month - b.month || String(a.grade).localeCompare(String(b.grade)))
  return h('div', { id: 'w-circuit' },
    h('h2', { class: 'section-head', text: `The circuit · ${world.circuit.length} tourneys` }),
    world.circuitIntro ? h('p', { class: 'muted', text: world.circuitIntro }) : null,
    h('div', { class: 'cards' }, world.formats.map((f) => h('div', { class: 'panel small' }, h('b', { text: f.name }), h('div', { text: f.about })))),
    h('table', { class: 'table' }, h('tr', {}, ['Month', 'Tourney', 'Held at', 'Format', 'Who may enter', 'What it is', 'From the real race', 'Stories'].map((x) => h('th', { text: x }))),
      rows.map((e) => h('tr', {},
        h('td', { text: MONTHS[e.month - 1] }),
        h('td', {}, h('b', { text: e.name }), h('div', { class: 'small muted', text: e.grade })),
        h('td', { text: hostName(e) }),
        h('td', { text: formats.get(e.format)?.name ?? e.format }),
        h('td', { class: 'small', text: e.entry ?? '' }),
        h('td', { class: 'small', text: e.blurb }),
        h('td', { class: 'small muted', text: e.real ?? '' }),
        h('td', {}, storiesIn(used[e.id] ?? [])),
      ))),
  )
}

// The gazetteer: every town by region, with its look, people, landmarks, two dungeons, tourneys and stories.
function townsSection(world, regions, storiesIn) {
  const entries = new Map(world.towns.map((t) => [t.id, t]))
  const hosted = (id) => world.circuit.filter((e) => e.host === id || e.port === id)
  const card = (city) => {
    const t = entries.get(city.id) ?? {}
    return h('div', { class: 'panel' },
      h('h3', { text: city.name }),
      h('div', { class: 'small muted', text: `${t.epithet ?? ''}${city.band ? ` · band ${city.band} · ${city.biome}` : ''}` }),
      t.look ? h('p', { text: t.look }) : null,
      t.people ? h('p', { class: 'small', text: t.people }) : null,
      t.landmarks?.length ? h('div', { class: 'small' }, h('b', { text: 'Landmarks: ' }), t.landmarks.join(' · ')) : null,
      t.dungeons ? h('ul', { class: 'list small' }, ['a', 'b'].map((d) => t.dungeons[d] ? h('li', {}, h('b', { text: `${t.dungeons[d].name} (${city.id}${d}): ` }), t.dungeons[d].blurb) : null)) : null,
      hosted(city.id).length ? h('div', { class: 'row' }, hosted(city.id).map((e) => tourneyChip(e.id))) : null,
      t.hooks?.length ? h('div', { class: 'small muted' }, h('b', { text: 'Rumours: ' }), t.hooks.join(' · ')) : null,
      storiesIn(D.data.cross.towns?.[city.id] ?? []),
    )
  }
  const hub = D.data.setting.cities.find((c) => c.region === 'hub')
  return h('div', {},
    hub ? h('div', { class: 'cards' }, card(hub)) : null,
    regions.map((reg) => {
      const lore = world.regions?.find((r) => r.id === reg.id)
      return h('div', {},
        h('h3', { class: 'section-head', text: `${reg.name} · the Way of the ${reg.way}` }),
        lore?.about ? h('p', { class: 'muted', text: lore.about }) : null,
        h('div', { class: 'cards' }, D.data.setting.cities.filter((c) => c.region === reg.id).sort((a, b) => a.band - b.band).map(card)))
    }),
  )
}

// ── The format ────────────────────────────────────────────────────────────────
export function formatView() {
  const used = new Map()
  for (const e of D.data.bundles) for (const sc of e.bundle.scenes ?? []) for (const st of sc.steps) used.set(st.t, (used.get(st.t) ?? 0) + 1)
  const modes = D.data.setting?.modes ?? []
  const first = D.data.bundles.find((e) => e.bundle.scenes?.length)
  return h('div', {},
    h('h1', { text: 'The format' }),
    h('p', { class: 'muted', text: 'What a bundle holds, and the steps a scene can use. Green steps play in uma-quest today; amber ones are what the sandbox tries first, so we learn which the game should add.' }),
    first ? h('p', {}, h('a', { class: 'btn primary', href: `#/play/${first.bundle.hero}/${first.bundle.scenes[0].id}`, text: `Play a scene from “${first.bundle.title}”` })) : null,
    h('div', { class: 'two' },
      h('div', { class: 'panel' }, h('h3', { text: 'Scene steps' }),
        h('table', { class: 'table' }, h('tr', {}, ['Step', 'Plays as', 'In the game', 'Used'].map((x) => h('th', { text: x }))),
          Object.entries(D.data.steps).map(([k, v]) => h('tr', {}, h('td', {}, h('code', { text: k })), h('td', { text: v.about }), h('td', {}, h('span', { class: `badge ${v.game ? 'game' : 'new'}`, text: v.game ? 'plays today' : 'sandbox first' })), h('td', { text: used.get(k) ?? 0 }))))),
      h('div', {},
        h('div', { class: 'panel' }, h('h3', { text: 'A bundle, from skeleton to script' }),
          h('ol', { class: 'list' },
            h('li', {}, h('b', { text: 'placeholder' }), ': every section present and empty, five chapters on the tournament shape, the bosses to be decided; written when her batch comes. No boss or outline checks yet.'),
            h('li', {}, h('b', { text: 'skeleton' }), ': title, theme, logline; five bosses, one per franchise, the final one from the finale franchise, each with her tie to the hero; links between them; crossings with other heroes.'),
            h('li', {}, h('b', { text: 'outline' }), `: the five chapters, each with its town (chapter N in a band-N town, chapter 1 in her Way’s first town), the boss placed in it and three to six beats; every crossing checked against its race. No town hosts more than ${D.data.townLimit} stories. On the tournament shape, chapter 1 is the junior circuit (its tourneys held in band 1) and chapter 2 her career’s climax (tourneys in bands 1–2 or beyond the rim), each with a career beat from her real record; chapters 3–5 are new stories.`),
            h('li', {}, h('b', { text: 'bible' }), ': her background, goals, objectives, voice; each boss’s background, want, wound, voice and fate. You read it here before scenes are written.'),
            h('li', {}, h('b', { text: 'scripted' }), ': scenes in the step format, played here, then moved into the game’s chapter files.'),
          )),
        h('div', { class: 'section-head' }),
        h('div', { class: 'panel' }, h('h3', { text: 'Story modes' }), modes.length ? modes.map((m) => h('p', {}, h('b', { text: `${m.name}: ` }), m.about)) : h('p', { class: 'muted', text: 'Not set.' })),
        h('div', { class: 'section-head' }),
        h('div', { class: 'panel small' }, h('h3', { text: 'Emotes and bubbles' }), h('p', { text: `Emotes: ${['nod', 'surprise', 'laugh', 'sad', 'angry', 'wave'].join(', ')}. Bubbles: ! ? … ♪ sweat anger heart zzz. A game line is at most ${D.data.lineLimit} characters; longer ones are flagged in the player.` })),
      ),
    ),
  )
}
