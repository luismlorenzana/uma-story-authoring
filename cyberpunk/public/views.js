// The Cyberpunk Story Sandbox's pages. Everything shown is the server's state: the story as the game's parser reads it,
// the game's own findings, the cast pack's names, and the owner's verdicts. No name or line lives in this file.
import { castIndex, countWords, deliverables, enemyWords, FOE_RANKS, hexOrNull, storyIndex, VERDICTS, walk } from '/model.js'

/** The loaded state and what's derived from it. */
export const D = { data: null, cast: null, index: null, foes: new Map() }
export function index(data) {
  D.data = data
  D.cast = castIndex(data.cast, data.pack?.casting)
  D.index = storyIndex(data.pack)
  D.foes = new Map((data.foes?.factions ?? []).flatMap((f) => f.units.map((u) => [u.id, { faction: f, unit: u }])))
  D.ties = { byUma: new Map(), byFoe: new Map() }
  for (const t of data.ties?.doc?.ties ?? []) {
    (D.ties.byUma.get(String(t.uma)) ?? D.ties.byUma.set(String(t.uma), []).get(String(t.uma))).push(t)
    ;(D.ties.byFoe.get(t.foe) ?? D.ties.byFoe.set(t.foe, []).get(t.foe)).push(t)
  }
}

/** A DOM element: h('div', { class: 'card', text: 'x', onclick }, child, …). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElementNS(tag === 'svg' || attrs?.svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag)
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false || key === 'svg') continue
    if (key === 'text') el.textContent = value
    // Through the CSSOM, which the page's content policy allows; a style attribute would be refused.
    else if (key === 'style') el.style.cssText = value
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value)
    else el.setAttribute(key, value === true ? '' : value)
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) el.append(child)
  return el
}
const s = (tag, attrs, ...children) => h(tag, { ...attrs, svg: true }, ...children)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const minutes = (seconds) => (seconds < 60 ? `${seconds} s` : `${(seconds / 60).toFixed(seconds < 600 ? 1 : 0)} min`)
const pill = (cls, label = cls) => h('span', { class: `pill ${cls}`, text: label })
const layerOf = (key) => D.data.layers[key] ?? 'placeholder'
const link = (href, label) => h('a', { href, text: label })

export function face(id, size = 34) {
  const who = D.cast.who(id)
  return h('span', { class: `face ${who.kind}`, style: `width:${size}px;height:${size}px`, title: `${who.name} · ${who.id}` },
    who.face ? h('img', { src: who.face, alt: '', loading: 'lazy' }) : who.initials)
}
export function person(id, extra = null) {
  const who = D.cast.who(id)
  const name = who.record ? h('a', { href: `#/profile/${encodeURIComponent(who.id)}`, text: who.name }) : who.name
  return h('span', { class: 'who' }, face(id), h('span', {}, name, who.known ? null : h('small', { text: ' · no name for this id yet' }), extra ? h('small', { text: ` · ${extra}` }) : null))
}
const verdictMark = (item) => { const r = D.data.reviews.items[item]; return h('span', { class: `mark ${r?.status ?? ''}`, title: r?.status ?? (r?.note ? 'A note' : 'No verdict') }) }
const findingsFor = (file) => D.data.findings.filter((f) => f.file === file && f.level !== 'note')
function findingsList(list) {
  if (!list.length) return null
  return h('div', { class: 'card' }, h('h4', { text: 'From the game’s check' }),
    list.map((f) => h('p', {}, pill(f.level, f.level === 'todo' ? 'to do' : f.level), ' ', f.where ? h('code', { text: f.where }) : null, ' ', f.message)))
}

/** The owner's verdict on an item: liked, rework or question, and a note. */
export function reviewPanel(item, saveReview) {
  if (D.data.standIn) return h('div', { class: 'card muted', text: 'Verdicts start with the story’s first file: this is the game’s stand-in.' })
  if (D.data.reviewsProblem) return h('div', { class: 'error-box', text: `The verdicts file can’t be read, so none can be saved: ${D.data.reviewsProblem}` })
  const saved = D.data.reviews.items[item]
  let status = saved?.status ?? null
  const note = h('textarea', { 'aria-label': 'A note for the writer', placeholder: 'A note for the writer', maxlength: 4000 })
  note.value = saved?.note ?? ''
  const state = h('span', { class: 'muted', role: 'status', text: saved ? `Saved ${new Date(saved.updatedAt).toLocaleString()}` : 'No verdict yet' })
  const buttons = VERDICTS.map((v) => h('button', { class: `btn ${status === v ? 'on' : ''}`, type: 'button', 'data-verdict': v, text: v[0].toUpperCase() + v.slice(1),
    onclick: () => { status = status === v ? null : v; for (const b of buttons) b.classList.toggle('on', b.dataset.verdict === status) } }))
  const save = h('button', { class: 'btn primary', type: 'button', text: 'Save', onclick: async () => {
    state.textContent = 'Saving…'
    try { await saveReview({ item, status, note: note.value }); state.textContent = 'Saved' } catch (error) { state.textContent = `Not saved: ${error.message}` }
  } })
  return h('div', { class: 'card review' }, h('h4', { text: 'Your verdict' }), h('div', { class: 'row' }, buttons), h('p', {}), note, h('div', { class: 'row' }, save, state))
}

/** A line's inline marks as nodes: **bold**, `code` and [links](…) shown as their words. Text only: nothing is parsed
 * as HTML. */
function inline(text) {
  const out = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(m[1] !== undefined ? h('b', { text: m[1] }) : m[2] !== undefined ? h('code', { text: m[2] }) : m[3])
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())

/** Markdown as the page shows it: headings, nested list lines, tables, quotes and paragraphs, with inline marks. */
function md(text) {
  const out = h('div', { class: 'md' }); let para = [], table = [], item = null
  const flushTable = () => {
    if (!table.length) return
    const rows = table.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map(cells)
    const [head, ...body] = rows
    out.append(h('div', { class: 'scroll' }, h('table', {},
      head && head.some((c) => c) ? h('thead', {}, h('tr', {}, head.map((c) => h('th', {}, inline(c))))) : null,
      h('tbody', {}, (head && head.some((c) => c) ? body : rows).map((r) => h('tr', {}, r.map((c) => h('td', {}, inline(c)))))))))
    table = []
  }
  // A list item runs on over its indented lines, so a bold that wraps stays one bold.
  const flushItem = () => { if (item) out.append(h('p', { class: 'li', style: `padding-left:${1 + item.indent / 2}em` }, '• ', inline(item.text))); item = null }
  const flush = () => { flushItem(); if (para.length) out.append(h('p', {}, inline(para.join(' ')))); para = []; flushTable() }
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const head = /^(#{1,4})\s+(.*)$/.exec(line), bullet = /^(\s*)[-*]\s+(.*)$/.exec(line), quote = /^>\s?(.*)$/.exec(line)
    if (head) { flush(); out.append(h(`h${Math.min(4, head[1].length + 1)}`, {}, inline(head[2]))) }
    else if (line.trim() === '') flush()
    else if (line.trimStart().startsWith('|')) { flushItem(); if (para.length) { out.append(h('p', {}, inline(para.join(' ')))); para = [] } table.push(line) }
    else if (bullet) { flush(); item = { indent: bullet[1].length, text: bullet[2] } }
    else if (quote) { flush(); out.append(h('p', { class: 'quote' }, inline(quote[1]))) }
    else if (item && /^\s+\S/.test(line)) item.text += ` ${line.trim()}`
    else { flushTable(); flushItem(); para.push(line.trim()) }
  }
  flush()
  return out
}

/** The story's bibles: the casting and each world's, then the foes', read and judged one file at a time. */
export function biblesView(name, saveReview) {
  const list = D.data.bibles ?? []
  if (!name) {
    const isFoe = (b) => b.name === 'foes' || b.name.startsWith('foes-') || b.name === 'ties'
    const cards = (group) => h('div', { class: 'grid' }, group.map((b) => {
      const title = /^#\s+(.*)$/m.exec(b.text)?.[1] ?? b.name
      return h('div', { class: 'card' }, h('h3', {}, verdictMark(b.path), ' ', h('a', { href: `#/bibles/${b.name}`, text: title })),
        h('p', { class: 'muted', text: `${b.path} · ${b.text.trim().split(/\s+/).length} words` }))
    }))
    const story = list.filter((b) => !isFoe(b)), foes = list.filter(isFoe)
    return h('div', {}, h('h1', { text: 'Bibles' }),
      h('p', { class: 'muted' }, 'The story’s private bibles in ', h('code', { text: 'content/stories/bibles/' }), ': the casting and each world in depth, then the foes, faction by faction.'),
      list.length ? [
        story.length ? [h('h2', { text: 'The story' }), cards(story)] : null,
        foes.length ? [h('h2', { text: 'The foes' }), h('p', { class: 'muted' }, 'Their looks and every unit are on the ', h('a', { href: '#/foes', text: 'Foes' }), ' page.'), cards(foes)] : null,
      ] : h('div', { class: 'card muted', text: 'No bible yet: content/stories/bibles/<name>.md.' }))
  }
  const bible = list.find((b) => b.name === name)
  if (!bible) return h('div', { class: 'error-box', text: `No bible ${name}.` })
  return h('div', {}, h('p', {}, h('a', { href: '#/bibles', text: '‹ Bibles' })), h('div', { class: 'card' }, md(bible.text)), reviewPanel(bible.path, saveReview))
}

// --- the foes: the Standard every foe shares, each faction's kit and variants, and every ranked unit with a brief

const RANK_NAMES = { boss: 'Bosses', key: 'Keys', regular: 'Regulars' }
const ROLE_NAMES = { vanguard: 'Vanguard', striker: 'Striker', gunner: 'Gunner', netrunner: 'Netrunner', medic: 'Medic' }
function swatch(hex, label = '', size = 18, extra = '') {
  const colour = hexOrNull(hex)
  return h('span', { class: `swatch ${extra}`, title: label ? `${label} · ${hex}` : String(hex ?? 'none'), style: `width:${size}px;height:${size}px;background:${colour ?? 'transparent'}` })
}
const chip = (label, hex) => h('span', { class: 'chip' }, swatch(hex, label), label, ' ', h('code', { text: String(hex ?? '') }))
const namedChip = (pair) => (Array.isArray(pair) && pair.length === 2 ? chip(pair[0], pair[1]) : null)
const lightOf = (id) => D.data.foes?.standard?.lights?.find((l) => l.id === id) ?? null
const variantOf = (faction, id) => faction.variants.find((v) => v.id === id) ?? null
const rows = (pairs) => h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, pairs.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => h('tr', {}, h('th', { text: k }), h('td', {}, v))))))
function copyBox(label, value) {
  const box = h('textarea', { class: 'brief', readonly: true, 'aria-label': label })
  box.value = value ?? ''
  const state = h('span', { class: 'muted', role: 'status' })
  const copy = h('button', { class: 'btn', type: 'button', text: 'Copy', onclick: async () => {
    try { await navigator.clipboard.writeText(box.value); state.textContent = 'Copied' } catch { box.select(); state.textContent = 'Selected: copy it with Ctrl+C' }
  } })
  return h('div', { class: 'card' }, h('h4', { text: label }), box, h('div', { class: 'row' }, copy, state))
}

function standardCard(std) {
  if (!std) return h('div', { class: 'card muted', text: 'No standard.json yet.' })
  const holds = Object.entries(std.holds ?? {}).map(([id, x]) => h('tr', {}, h('th', { text: x.name ?? id }), h('td', {}, Object.entries(x.colours ?? {}).map(([k, c]) => chip(k, c)), h('p', { text: x.look ?? '' }))))
  return h('div', { class: 'card' },
    h('h2', { text: std.title ?? 'The Standard' }), h('p', { text: std.summary ?? '' }),
    h('p', {}, h('a', { href: '#/bibles/foes', text: 'Read the Standard’s bible ›' })),
    h('h4', { text: 'Four colour roles' }),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Role', 'Whose', 'Where', 'From'].map((t) => h('th', { text: t })))),
      h('tbody', {}, (std.colourRoles ?? []).map((r) => h('tr', {}, h('td', {}, h('b', { text: r.role })), h('td', { text: r.who }), h('td', { text: r.where }), h('td', { text: r.from })))))),
    h('h4', { text: 'Ranks' }),
    h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Rank', 'Helmet', 'Marks', 'Her art'].map((t) => h('th', { text: t })))),
      h('tbody', {}, FOE_RANKS.map((k) => std.ranks?.[k]).filter(Boolean).map((r) => h('tr', {}, h('td', {}, h('b', { text: r.name })), h('td', { text: r.helmet }), h('td', { text: r.marks }), h('td', { text: r.art })))))),
    h('p', { class: 'muted', text: std.rankFromBoards ?? '' }),
    h('h4', { text: 'The Holds' }), h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, holds))),
    h('h4', { text: 'The lights' }), h('div', {}, (std.lights ?? []).map((l) => chip(l.name, l.hex))),
    h('h4', { text: 'Roles, by the back unit' }), (std.roles ?? []).map((r) => h('p', { class: 'li' }, h('b', { text: `${r.name} · ${r.back}` }), `: ${r.look}`)),
    h('h4', { text: 'Never' }), h('p', { text: (std.never ?? []).join(' · ') }),
    h('p', { class: 'muted', text: std.crewContrast ?? '' }))
}

function factionCard(f) {
  const counts = f.counts ?? {}
  return h('div', { class: 'card' },
    h('h3', {}, verdictMark(f.path), ' ', h('a', { href: `#/foes/${f.id}`, text: f.title })),
    h('p', { class: 'muted', text: `${f.frameLine ?? ''} · ${f.franchise ?? ''}` }),
    h('div', {}, Object.values(f.palette).map(namedChip)),
    h('p', {}, FOE_RANKS.filter((r) => counts[r]).map((r) => [pill('bible', `${counts[r]} ${RANK_NAMES[r]}`), ' ']), counts.featured ? [pill('bible', `${counts.featured} with a part`), ' '] : null,
      counts.notPreRanked ? pill('placeholder', `${counts.notPreRanked} not ranked yet`) : null),
    h('p', { class: 'muted', text: f.variants.map((v) => v.name).join(' · ') }),
    h('p', {}, h('a', { href: `#/bibles/foes-${f.id}`, text: 'Its bible ›' })))
}

function unitTile(f, u) {
  const v = variantOf(f, u.variant), light = lightOf(u.light)
  return h('a', { class: 'unit', href: `#/foes/${f.id}/${encodeURIComponent(u.id)}`, 'data-variant': u.variant ?? '', 'data-role': u.role ?? '' },
    face(u.id, 46),
    h('span', {},
      h('b', { text: D.cast.name(u.id) }),
      h('small', { text: `${ROLE_NAMES[u.role] ?? u.role} · ${v?.name ?? u.variant ?? ''}${light ? ` · ${light.name}` : ''}` }),
      u.story ? h('small', { class: 'story', text: u.story }) : null,
      h('span', { class: 'sw' }, light ? swatch(light.hex, `Light: ${light.name}`, 12, 'light') : null, (u.palette ?? []).map((c) => swatch(c.hex, `${Math.round(c.share * 100)}%`, 12, c.hex === u.accent ? 'accent' : '')))))
}

function foeFaction(f, saveReview) {
  const tiles = []
  const select = (label, options, key) => {
    const s = h('select', { 'aria-label': label, onchange: () => filter() }, h('option', { value: '', text: `Every ${label.toLowerCase()}` }), options.map(([value, text]) => h('option', { value, text })))
    s.dataset.key = key
    return s
  }
  const variantSelect = select('Variant', f.variants.map((v) => [v.id, v.name]), 'variant')
  const roleSelect = select('Role', Object.entries(ROLE_NAMES), 'role')
  const filter = () => { for (const t of tiles) t.hidden = (variantSelect.value && t.dataset.variant !== variantSelect.value) || (roleSelect.value && t.dataset.role !== roleSelect.value) }
  const sections = FOE_RANKS.map((rank) => {
    const units = f.units.filter((u) => u.rank === rank)
    if (!units.length) return null
    const made = units.map((u) => unitTile(f, u)); tiles.push(...made)
    return [h('h3', { text: `${RANK_NAMES[rank]} · ${units.length}` }), h('div', { class: 'units' }, made)]
  })
  const kit = rows([['Silhouette', f.silhouette], ['Helmet', f.helmet], ['Mantle (Boss)', f.mantle], ['Emblem', f.emblem], ['Materials', f.materials], ['Tell', f.tell], ['Hold', f.holdLook], ['Ships', f.ships], ['Machines', (f.machines ?? []).join(' · ')]])
  return h('div', {},
    h('p', {}, h('a', { href: '#/foes', text: '‹ Foes' })),
    h('h1', { text: f.title }),
    h('p', { class: 'muted' }, `${f.frameLine} · ${f.where ?? ''} · `, h('a', { href: `#/bibles/foes-${f.id}`, text: 'its bible' })),
    h('div', { class: 'card' }, h('h4', { text: 'The kit' }), h('div', {}, Object.values(f.palette).map(namedChip)), kit),
    h('h2', { text: 'Variants' }),
    h('div', { class: 'grid' }, f.variants.map((v) => h('div', { class: 'card' },
      h('h3', { text: v.name }),
      h('div', {}, namedChip(v.base), namedChip(v.trim), v.tabard ? chip('Tabard', v.tabard) : null, v.lapel ? chip('Lapel', v.lapel) : null),
      h('p', { text: v.look }),
      h('p', { class: 'muted', text: `${f.units.filter((u) => u.variant === v.id).length} units` })))),
    h('div', { class: 'card' }, h('h4', { text: 'The five roles in this kit' }),
      Object.entries(f.roleLooks ?? {}).map(([r, look]) => h('p', { class: 'li' }, h('b', { text: `${ROLE_NAMES[r] ?? r}${f.hulls?.[r] ? ` (${f.hulls[r]})` : ''}` }), `: ${look}`))),
    copyBox('The faction’s prompt', f.prompt),
    h('h2', { text: 'Every unit' }),
    h('div', { class: 'row' }, variantSelect, roleSelect),
    sections,
    reviewPanel(f.path, saveReview))
}

function foeUnit(f, uid, saveReview) {
  const u = f.units.find((x) => x.id === uid)
  if (!u) return h('div', { class: 'error-box', text: `No unit ${uid} in ${f.title}.` })
  const who = D.cast.who(u.id), v = variantOf(f, u.variant), light = lightOf(u.light)
  const fittings = f.units.filter((x) => x.model === u.model && x.id !== u.id)
  return h('div', {},
    h('p', {}, h('a', { href: `#/foes/${f.id}`, text: `‹ ${f.title}` })),
    h('h1', {}, verdictMark(`${f.path}#${u.id}`), ' ', who.name),
    h('p', { class: 'muted' }, `${f.title} · ${{ boss: 'Boss', key: 'Key', regular: 'Regular' }[u.rank] ?? u.rank}${u.drawnAs !== u.rank ? ', drawn as a Boss for the story' : ''} · ${u.board} ${u.tier} · ${u.id} · `,
      h('a', { href: `#/profile/${encodeURIComponent(u.id)}`, text: 'her profile' })),
    h('div', { class: 'two' },
      h('div', {}, who.art ? h('img', { class: 'foe-art', src: who.art, alt: '' }) : face(u.id, 160)),
      h('div', { class: 'card' }, rows([
        ['Story', u.story],
        ['Her Umas', orNull((D.ties.byFoe.get(u.id) ?? []).map((t) => h('div', {}, tieLine(t, String(t.uma)))))],
        ['Role', `${ROLE_NAMES[u.role] ?? u.role}: ${f.roleLooks?.[u.role] ?? ''}${u.hull ? ` (${u.hull})` : ''} · ${u.roleFrom === 'source' ? 'from her class' : u.roleFrom === 'story' ? 'set by the story' : u.roleFrom === 'default' ? 'a default by her type' : 'a stable pick: check her weapon'}`],
        ['Variant', v ? [h('b', { text: v.name }), `: ${v.look}`] : u.variant],
        ['Light', light ? [swatch(light.hex, light.name), ` ${light.name} `, h('code', { text: light.hex })] : 'Her accent (no element)'],
        ['Accent', u.accent ? [swatch(u.accent, 'Accent', 18, 'accent'), ' ', h('code', { text: u.accent }), u.accentFrom === 'muted' ? ' · muted: check it by eye' : ''] : 'Pick from her reference'],
        ['Her colours', [(u.palette ?? []).map((c) => [swatch(c.hex, `${Math.round(c.share * 100)}%`, 22, c.hex === u.accent ? 'accent' : ''), ' ']), h('small', { class: 'muted', text: ` read from her ${u.paletteFrom ?? 'art'}` })]],
        ['Hold', u.hold],
        ['Other fittings', fittings.length ? fittings.map((x) => [h('a', { href: `#/foes/${f.id}/${encodeURIComponent(x.id)}`, text: D.cast.name(x.id) }), ' ']) : null],
        ['The Ranker’s data', (u.details ?? []).join(' · ')],
      ]))),
    copyBox('Her brief, for the design', u.brief),
    reviewPanel(`${f.path}#${u.id}`, saveReview))
}

/** The foes: the Standard, the eight factions' kits and variants, and every ranked unit with her palette and brief. */
export function foesView(fid, uid, saveReview) {
  const F = D.data.foes
  const problems = F?.problems?.length ? h('div', { class: 'error-box' }, F.problems.map((p) => h('p', { text: p }))) : null
  if (!F?.factions?.length) return h('div', {}, h('h1', { text: 'Foes' }), problems, h('div', { class: 'card muted', text: 'No foe data yet: the story session writes content/stories/foes/.' }))
  if (fid) {
    const faction = F.factions.find((f) => f.id === fid)
    if (!faction) return h('div', { class: 'error-box', text: `No faction ${fid}.` })
    return uid ? foeUnit(faction, uid, saveReview) : foeFaction(faction, saveReview)
  }
  const total = F.factions.reduce((n, f) => n + f.units.length, 0)
  return h('div', {}, h('h1', { text: 'Foes' }),
    h('p', { class: 'muted' }, `Every foe wears the Standard. ${total} of the owner's pre-ranked bosses in ${F.factions.length} factions, in `, h('code', { text: 'content/stories/foes/' }), '; each Uma’s boss is on the ', h('a', { href: '#/ties', text: 'Ties' }), ' page.'),
    problems, standardCard(F.standard), h('h2', { text: 'The factions' }), h('div', { class: 'grid' }, F.factions.map(factionCard)))
}

// --- profiles: what Uma Studio holds on each Uma and heroine (the cast pack), and what the story does with her

const FRANCHISES = {
  azurlane: ['Azur Lane', ['Source tier']], nikke: ['NIKKE', ['Source tier']],
  genshin: ['Genshin Impact', ['Rarity', 'Element', 'Weapon', 'Region']], hsr: ['Honkai: Star Rail', ['Rarity', 'Path', 'Element']],
  zzz: ['Zenless Zone Zero', ['Rank', 'Specialty', 'Attribute', 'Attribute']], wuwa: ['Wuthering Waves', ['Rarity', 'Element', 'Weapon']],
  pgr: ['Punishing: Gray Raven', ['Rank', 'Class', 'Element', 'Note']], hi3: ['Honkai Impact 3rd', ['Character', 'Rank', 'Type']],
}
const PREFIX = { al: 'azurlane', nk: 'nikke', gi: 'genshin', hsr: 'hsr', zzz: 'zzz', ww: 'wuwa', pgr: 'pgr', hi3: 'hi3' }
const franchiseOf = (x) => x.franchise || PREFIX[String(x.id).split('-')[0]] || ''
const STYLES = { front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' }
const styleName = (s) => (s ? s.split('-').map((p) => STYLES[p] ?? p).join(' / ') : null)
const inStory = () => new Set((D.data.foes?.factions ?? []).map((f) => f.franchise))
const profileHref = (id) => `#/profile/${encodeURIComponent(id)}`

function profilesIndex() {
  const pack = D.data.cast
  if (!pack) return h('div', {}, h('h1', { text: 'Profiles' }), h('div', { class: 'banner' }, h('b', { text: 'No cast pack yet. ' }), h('code', { text: 'pnpm stories:import-cast' }), ' builds it from Uma Studio’s Ranker.'))
  const cards = [], sections = []
  const card = (id, sub) => {
    const el = h('a', { class: 'unit', href: profileHref(id) }, face(id, 40), h('span', {}, h('b', { text: D.cast.name(id) }), sub ? h('small', { text: sub }) : null))
    el.dataset.name = D.cast.name(id).toLowerCase()
    cards.push(el)
    return el
  }
  const section = (title, items) => { const el = h('div', {}, h('h3', { text: `${title} · ${items.length}` }), h('div', { class: 'units' }, items)); sections.push(el); return el }
  const search = h('input', { type: 'search', placeholder: 'Find by name', 'aria-label': 'Find by name', oninput: () => {
    const q = search.value.trim().toLowerCase()
    for (const c of cards) c.hidden = Boolean(q) && !c.dataset.name.includes(q)
    for (const s of sections) s.hidden = ![...s.querySelectorAll('.unit')].some((c) => !c.hidden)
  } })
  const batches = {}
  for (const u of pack.umas) (batches[u.batch ?? 'npcs'] ??= []).push(u)
  const story = inStory(), byFranchise = {}
  for (const x of pack.heroines) (byFranchise[franchiseOf(x)] ??= []).push(x)
  const order = Object.keys(FRANCHISES).sort((a, b) => Number(story.has(b)) - Number(story.has(a)))
  return h('div', {}, h('h1', { text: 'Profiles' }),
    h('p', { class: 'muted', text: `Everyone Uma Studio’s Ranker gives the story: ${plural(pack.umas.length, 'Uma')} and ${plural(pack.heroines.length, 'heroine')}, with their art, their facts and what the story does with them.` }),
    h('div', { class: 'row' }, search),
    h('h2', { text: 'Umas' }),
    Object.entries(batches).sort(([a], [b]) => (a === 'npcs') - (b === 'npcs') || a - b).map(([batch, list]) =>
      section(batch === 'npcs' ? 'Uma NPCs' : `Batch ${batch} · ${list[0].tier}`, list.sort((a, b) => a.order - b.order).map((u) => card(String(u.outfit), u.title || u.tier)))),
    h('h2', { text: 'Heroines' }),
    order.filter((f) => byFranchise[f]?.length).map((f) => section(`${FRANCHISES[f][0]}${story.has(f) ? '' : ' (not in the story)'}`,
      byFranchise[f].map((x) => card(x.id, `${x.board.replace(/-bosses$/, ' bosses').replace(/-enemies$/, ' enemies')} ${x.tier}`)))))
}

function umaProfile(who) {
  const r = who.record, casting = D.data.pack.casting, key = String(r.outfit)
  const lead = casting.leads.find((l) => String(l.outfit) === key)
  const crewAt = casting.crewOrder.map(String).indexOf(key)
  const tastes = casting.tastes?.[key]
  const tag = (t) => (t ? [h('b', { text: t.name.charAt(0).toUpperCase() + t.name.slice(1) }), t.why ? ` · ${t.why}` : ''] : null)
  return h('div', {},
    h('p', {}, h('a', { href: '#/profiles', text: '‹ Profiles' })),
    h('h1', {}, who.name),
    h('p', { class: 'muted', text: [r.title, `outfit ${r.outfit}`, r.board === 'npcs' ? 'an Uma NPC' : null].filter(Boolean).join(' · ') }),
    h('div', { class: 'two' },
      h('div', {}, r.images?.art ? h('img', { class: 'foe-art', src: who.art, alt: '' }) : face(key, 160)),
      h('div', { class: 'card' }, rows([
        ['The Ranker', `${r.tier}${r.batch ? ` · batch ${r.batch}` : ''} · #${r.order}${r.sister ? ' · a sister' : ''}`],
        ['Running style', styleName(r.playstyle)],
        ['Sister', r.about?.sister ? [h('b', { text: r.about.sister.relation }), r.about.sister.era ? ` · ${r.about.sister.era}` : ''] : null],
        ['Her profile', r.about?.sister?.text || null],
        ['Personality', tag(r.about?.tags?.personality)],
        ['Story type', tag(r.about?.tags?.story)],
        ['Class (uma-quest’s)', tag(r.about?.tags?.class)],
        ['In this story', lead ? [h('b', { text: 'Lead' }), ` of `, link(`#/w/${lead.world}`, lead.world), lead.opens ? ` · opens the ${lead.opens}` : '']
          : crewAt >= 0 ? `Crew, #${crewAt + 1} in the crew’s order${D.index.joins[key] ? ` · joins in ${D.index.joins[key].scene}` : ''}` : 'Not cast yet'],
        ['Her boss', orNull((D.ties.byUma.get(key) ?? []).map((t) => h('div', {}, tieLine(t, t.foe))))],
        ['Role', casting.roles?.[key] ?? null],
        ['Tastes', tastes ? `favourite ${tastes.favourite} · dislikes ${tastes.disliked} · gift ${tastes.gift} · topics ${(tastes.topics ?? []).join(', ')}` : null],
      ]))))
}

function heroineProfile(who) {
  const r = who.record, fr = franchiseOf(r), [title, labels] = FRANCHISES[fr] ?? [fr || 'Unknown', []]
  const cast = D.data.pack.casting.heroines.find((x) => x.board === r.id)
  const foe = D.foes.get(r.id), story = inStory()
  const v = foe ? variantOf(foe.faction, foe.unit.variant) : null
  const fittings = foe ? foe.faction.units.filter((x) => x.model === foe.unit.model && x.id !== r.id) : []
  return h('div', {},
    h('p', {}, h('a', { href: '#/profiles', text: '‹ Profiles' })),
    h('h1', {}, who.name),
    h('p', { class: 'muted', text: `${title} · ${r.board} ${r.tier} · ${r.id}` }),
    h('div', { class: 'two' },
      h('div', {}, r.images?.art ? h('img', { class: 'foe-art', src: who.art, alt: '' }) : face(r.id, 160)),
      h('div', { class: 'card' }, rows([
        ...(r.details ?? []).map((d, i) => [labels[i] ?? 'Detail', d]),
        ['The Ranker', `${r.board} · ${r.tier}${r.category ? ` · ${r.category}` : ''}`],
        ['In this story', !story.has(fr) ? 'Not in the story: its franchise left (D36)'
          : cast ? [h('b', { text: 'Cast' }), ` · ${cast.faction} · Hold ${cast.hold}`]
          : foe?.unit.story ? 'A part in her faction’s foe bible, drawn as a Boss; not in the casting yet'
          : foe ? 'In the foe pool, by the Ranker’s order' : 'Not in the foe data'],
        ['Her part', foe?.unit.story ?? null],
        ['Her Umas', orNull((D.ties.byFoe.get(r.id) ?? []).map((t) => h('div', {}, tieLine(t, String(t.uma)))))],
        ['As a foe', foe ? [h('a', { href: `#/foes/${foe.faction.id}/${encodeURIComponent(r.id)}`, text: foe.faction.title }), ` · ${{ boss: 'Boss', key: 'Key', regular: 'Regular' }[foe.unit.rank]} · ${v?.name ?? foe.unit.variant} · ${ROLE_NAMES[foe.unit.role] ?? foe.unit.role}${lightOf(foe.unit.light) ? ` · ${lightOf(foe.unit.light).name}` : ''}`] : null],
        ['Other fittings', fittings.length ? fittings.map((x) => [h('a', { href: profileHref(x.id), text: D.cast.name(x.id) }), ' ']) : null],
      ]))),
    r.images?.splash ? h('div', { class: 'card' }, h('h4', { text: 'Her splash art' }), h('img', { class: 'splash', src: who.record.images.splash, alt: '', loading: 'lazy' })) : null)
}

// --- the ties: each Uma's boss, the conflict and its turn

const orNull = (list) => (list.length ? list : null)
const kindName = (id) => D.data.ties?.doc?.kinds?.find((k) => k.id === id)?.name ?? id
const heatMark = (n) => h('span', { class: `heat h${n}`, title: `Heat ${n} of 3`, text: '●'.repeat(n) + '○'.repeat(3 - n) })
const tieLine = (t, other) => [h('a', { href: profileHref(other), text: D.cast.name(other) }), ' ', pill('bible', kindName(t.kind)), ' ', heatMark(t.heat), ' ', h('b', { text: t.title }), h('br'), h('small', { class: 'muted', text: t.why })]

function tieCard(t) {
  const el = h('div', { class: 'card tie' },
    h('div', { class: 'row' }, person(String(t.uma)), h('span', { class: 'vs', text: '×' }), person(t.foe)),
    h('p', {}, pill('bible', kindName(t.kind)), ' ', heatMark(t.heat), ' ', link(`#/w/${t.world}`, t.world), ' · ', h('b', { text: t.title })),
    h('p', { text: t.why }),
    h('p', { class: 'muted' }, h('b', { text: 'The turn: ' }), t.turn))
  Object.assign(el.dataset, { kind: t.kind, faction: t.faction ?? '', heat: String(t.heat) })
  return el
}

/** The ties: every Uma with her boss, by heat and the Ranker's order, filtered by faction, kind and heat. */
export function tiesView(saveReview) {
  const T = D.data.ties
  if (T?.problem) return h('div', { class: 'error-box', text: `The ties can’t be read: ${T.problem}` })
  if (!T?.doc) return h('div', {}, h('h1', { text: 'Ties' }), h('div', { class: 'card muted', text: 'No ties yet: the story session writes content/stories/ties.json.' }))
  const order = (t) => D.cast.umas.get(String(t.uma))?.order ?? 999
  const ties = [...T.doc.ties].sort((a, b) => b.heat - a.heat || order(a) - order(b))
  const cards = ties.map(tieCard)
  const filter = () => { for (const c of cards) c.hidden = (faction.value && c.dataset.faction !== faction.value) || (kind.value && c.dataset.kind !== kind.value) || (heat.value && c.dataset.heat !== heat.value) }
  const select = (label, options) => h('select', { 'aria-label': label, onchange: () => filter() }, h('option', { value: '', text: `Every ${label.toLowerCase()}` }), options.map(([value, text]) => h('option', { value, text })))
  const faction = select('Faction', (D.data.foes?.factions ?? []).map((f) => [f.id, f.title]))
  const kind = select('Kind', T.doc.kinds.map((k) => [k.id, k.name]))
  const heat = select('Heat', [['3', 'Heat 3: a lead’s'], ['2', 'Heat 2: open'], ['1', 'Heat 1: simmering']])
  return h('div', {}, h('h1', { text: 'Ties' }),
    h('p', { class: 'muted', text: T.doc.about ?? '' }),
    h('div', { class: 'card' }, h('h4', { text: 'The kinds' }), T.doc.kinds.map((k) => h('p', { class: 'li' }, h('b', { text: k.name }), `: ${k.what}`)),
      T.doc.unpaired?.length ? h('p', { class: 'muted' }, 'Free for later: ', T.doc.unpaired.map((id) => [h('a', { href: profileHref(id), text: D.cast.name(id) }), ' '])) : null,
      h('p', {}, h('a', { href: '#/bibles/ties', text: 'Read the ties’ bible ›' }))),
    h('div', { class: 'row' }, faction, kind, heat),
    h('div', { class: 'ties' }, cards),
    reviewPanel('ties.json', saveReview))
}

/** Profiles: everyone the Ranker gives the story, by Umas' batch and heroines' franchise, each with her art and facts. */
export function profilesView(id) {
  if (!id) return profilesIndex()
  const who = D.cast.who(id)
  if (!who.record) return h('div', { class: 'error-box', text: `No profile for ${id}: it isn’t in the cast pack.` })
  return who.kind === 'uma' ? umaProfile(who) : heroineProfile(who)
}

const sceneKey = (chapter, id) => (id === 'debrief' ? `${chapter.id}/debrief` : id)
const chapterSeconds = (c) => [...c.scenes.map((x) => x.id), `${c.id}/debrief`].reduce((n, id) => n + (D.data.seconds[id] ?? 0), 0)
const chapterWords = (c) => c.scenes.reduce((n, x) => n + countWords(x.steps), 0) + countWords(c.debrief.steps)

function chapterRows(chapters) {
  return h('div', { class: 'scroll' }, h('table', {},
    h('thead', {}, h('tr', {}, ['', 'Chapter', 'Leads', 'No.', 'Danger', 'Layer', 'Scenes', 'Battles', 'Words', 'Reads in'].map((t) => h('th', { text: t })))),
    h('tbody', {}, chapters.map((c) => h('tr', {},
      h('td', {}, verdictMark(`chapters/${c.id}.json`)),
      h('td', {}, link(`#/ch/${c.id}`, c.id), findingsFor(`chapters/${c.id}.json`).some((f) => f.level === 'error') ? [' ', pill('error')] : null),
      h('td', {}, c.leads.map((l) => person(l))),
      h('td', { text: c.number === 1 ? '1 · her pickup' : String(c.number) }), h('td', { text: String(c.danger) }),
      h('td', {}, pill(layerOf(`chapter:${c.id}`))), h('td', { text: String(c.scenes.length) }), h('td', { text: String(c.missions.length) }),
      h('td', { text: String(chapterWords(c)) }), h('td', { text: minutes(chapterSeconds(c)) }))))))
}

// --- Story: where the whole thing stands

export function storyView() {
  const { data } = D, t = D.index.totals
  const errors = data.findings.filter((f) => f.level === 'error').length, todos = data.findings.filter((f) => f.level === 'todo').length
  const seconds = Object.values(data.seconds).reduce((a, b) => a + b, 0)
  const tile = (value, label, cls = '') => h('div', { class: `tile ${cls}` }, h('b', { text: String(value) }), h('span', { text: label }))
  const byLayer = {}
  for (const [key, layer] of Object.entries(data.layers)) (byLayer[layer] ??= []).push(key)
  return h('div', {},
    data.standIn
      ? h('div', { class: 'banner stand-in' }, h('b', { text: 'No story yet. ' }), `Nothing is in ${data.dir}, so this is the game’s invented stand-in story, with made-up ids and labels. Every page works on it; the story’s first file replaces it.`)
      : h('div', { class: 'banner' }, 'Reading ', h('code', { text: data.dir }), ` · ${plural(data.paths.length, 'file')}`, data.clean ? '' : ' · some files don’t parse yet: see Checks',
        (data.bibles ?? []).some((b) => b.name === 'roadmap') ? [' · ', h('a', { href: '#/bibles/roadmap', text: 'the story roadmap ›' })] : null),
    h('div', { class: 'tiles' },
      tile(t.worlds, 'worlds'), tile(t.leads, 'leads'), tile(t.chapters, 'chapters'), tile(t.scenes, 'scenes'), tile(t.missions, 'battles'),
      tile(t.words, 'words'), tile(minutes(seconds), 'of reading'), tile(errors, 'errors', errors ? 'bad' : ''), tile(todos, 'to do', todos ? 'warn' : '')),
    h('div', { class: 'card' }, h('h3', { text: 'What the story delivers' }),
      h('p', { class: 'muted', text: 'The story brief’s five deliverables (SB9), read off the files. You read each layer before the next is written.' }),
      h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, deliverables(data.pack, data.layers, data.standIn).map((d) => h('tr', {},
        h('td', { text: String(d.n) }), h('td', {}, pill(d.state, d.state === 'manual' ? 'in git' : d.state === 'todo' ? 'to write' : d.state)),
        h('td', { text: d.what }), h('td', {}, h('code', { text: d.where })), h('td', { class: 'muted', text: d.detail }))))))),
    h('div', { class: 'card' }, h('h3', { text: 'By layer' }),
      h('div', { class: 'row' }, data.format.layers.map((layer) => h('span', {}, pill(layer), ` ${(byLayer[layer] ?? []).length}`)))),
    Object.values(data.pack.worlds).map((w) => h('div', { class: 'card' },
      h('h3', {}, link(`#/w/${w.id}`, w.id), ' ', pill(layerOf(`world:${w.id}`))),
      w.look ? h('p', { text: w.look }) : null,
      D.index.chaptersByWorld[w.id]?.length ? chapterRows(D.index.chaptersByWorld[w.id]) : h('p', { class: 'muted', text: 'No chapter on this world yet.' }))),
    Object.keys(data.pack.worlds).length ? null : h('div', { class: 'card muted', text: 'No world file yet.' }))
}

// --- Worlds

function nodeMap(nodes, links, hrefOf) {
  const placed = nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y))
  if (!placed.length) return null
  const at = new Map(placed.map((n) => [n.id, n]))
  return s('svg', { class: 'map', viewBox: '0 0 100 62', role: 'img', 'aria-label': 'Map' },
    links.filter(([a, b]) => at.has(a) && at.has(b)).map(([a, b]) => s('line', { x1: at.get(a).x, y1: at.get(a).y * 0.6, x2: at.get(b).x, y2: at.get(b).y * 0.6 })),
    placed.map((n) => s('a', { href: hrefOf(n) ?? '#/worlds' },
      s('circle', { cx: n.x, cy: n.y * 0.6, r: 2.2, class: n.locked ? 'locked' : '' }),
      // A node on the right half takes its label on its left, so a long label never runs off the map.
      s('text', { x: n.x > 50 ? n.x - 3.2 : n.x + 3.2, y: n.y * 0.6 + 1, 'text-anchor': n.x > 50 ? 'end' : 'start', text: n.label }))))
}

export function worldsView() {
  const worlds = Object.values(D.data.pack.worlds)
  return h('div', {}, h('h1', { text: 'Worlds' }),
    h('p', { class: 'muted', text: 'The star map: each world where its file places it. A lead’s Chapter 1 on her own world brings her aboard.' }),
    nodeMap(worlds.map((w) => ({ id: w.id, x: w.x, y: w.y, label: w.id })), [], (n) => `#/w/${n.id}`),
    h('div', { class: 'grid', style: 'margin-top:14px' }, worlds.map((w) => h('div', { class: 'card' },
      h('h3', {}, verdictMark(`worlds/${w.id}.json`), ' ', link(`#/w/${w.id}`, w.id), ' ', pill(layerOf(`world:${w.id}`))),
      w.look ? h('p', { text: w.look }) : h('p', { class: 'muted', text: 'No look written yet.' }),
      h('p', { class: 'muted', text: `${plural(w.locations.length, 'place')} · ${plural((D.index.chaptersByWorld[w.id] ?? []).length, 'chapter')} · factions: ${w.factions.join(', ') || 'none yet'}` }),
      h('div', {}, D.data.pack.casting.leads.filter((l) => l.world === w.id).map((l) => person(l.outfit, 'lead')))))),
    worlds.length ? null : h('div', { class: 'card muted', text: 'No world file yet: content/stories/worlds/<id>.json.' }))
}

export function worldView(id, saveReview) {
  const w = D.data.pack.worlds[id]
  if (!w) return h('div', { class: 'error-box', text: `No world ${id}.` })
  const links = w.locations.flatMap((p) => p.links.map((to) => [p.id, to]))
  return h('div', {},
    h('p', {}, link('#/worlds', '‹ Worlds')),
    h('h1', {}, w.id, ' ', pill(layerOf(`world:${w.id}`))),
    findingsList(findingsFor(`worlds/${w.id}.json`)),
    h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', { text: 'Look' }), h('dd', { text: w.look ?? '—' }), h('dt', { text: 'Mood' }), h('dd', { text: w.mood ?? '—' }),
      h('dt', { text: 'Factions' }), h('dd', { text: w.factions.join(', ') || '—' }),
      h('dt', { text: 'Leads' }), h('dd', {}, D.data.pack.casting.leads.filter((l) => l.world === w.id).map((l) => person(l.outfit)), null))),
    h('div', { class: 'card' }, h('h3', { text: 'Places' }),
      nodeMap(w.locations.map((p) => ({ id: p.id, x: p.x, y: p.y, label: p.id, locked: p.needs.length > 0 })), links, () => `#/w/${w.id}`),
      h('div', { class: 'scroll' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Place', 'Danger', 'Opens with', 'Leads to', 'Scenes here'].map((t) => h('th', { text: t })))),
        h('tbody', {}, w.locations.map((p) => h('tr', {}, h('td', {}, h('code', { text: p.id })), h('td', { text: String(p.danger) }),
          h('td', { text: p.needs.join(', ') || 'open' }), h('td', { text: p.links.join(', ') || '—' }),
          h('td', {}, Object.values(D.index.scenes).filter((x) => x.scene.place === p.id).map((x) => [link(`#/play/${x.chapter.id}/${x.scene.id}`, x.scene.id), ' '])))))))),
    h('div', { class: 'card' }, h('h3', { text: 'Chapters here' }),
      D.index.chaptersByWorld[w.id]?.length ? chapterRows(D.index.chaptersByWorld[w.id]) : h('p', { class: 'muted', text: 'None yet.' })),
    reviewPanel(`worlds/${w.id}.json`, saveReview))
}

// --- Chapters

export function chaptersView() {
  const chapters = Object.values(D.index.chaptersByWorld).flat()
  return h('div', {}, h('h1', { text: 'Chapters' }),
    h('p', { class: 'muted', text: 'Every chapter, in danger order. A scene is three minutes at most, a chapter two to four battles, a Chapter 1 one or two.' }),
    chapters.length ? h('div', { class: 'card' }, chapterRows(chapters)) : h('div', { class: 'card muted', text: 'No chapter file yet: content/stories/chapters/<id>.json.' }))
}

/** A script as a list, the steps inside a choice indented. `now`: the path of the step being played. */
export function scriptList(steps, now = null) {
  const name = (id) => D.cast.name(id)
  const line = (step) => {
    switch (step.kind) {
      case 'line': return [h('b', { text: `${name(step.speaker)}: ` }), step.text]
      case 'thought': return [h('b', { text: `${name(step.speaker)}, thinking: ` }), h('i', { text: step.text })]
      case 'narrate': return h('i', { text: step.text })
      case 'slot': return [h('b', { text: 'Whoever’s in the squad: ' }), Object.entries(step.lines).map(([id, t]) => h('div', {}, `${name(id)}: ${t}`)), h('div', { class: 'muted', text: `Otherwise: ${step.fallback}` })]
      case 'emote': return h('span', { class: 'event', text: `${name(step.actor)} · ${step.emote}` })
      case 'wait': return h('span', { class: 'muted', text: `${step.ms} ms` })
      case 'choice': return step.options.map((o, i) => h('div', {}, `${i + 1}. ${o.text}`, o.lead ? h('small', { class: 'event', text: ` · Lead ${o.lead}` }) : null))
      case 'flag': return h('span', { class: 'event', text: `${step.set ? 'Sets' : 'Clears'} ${step.flag}` })
      case 'lead': return h('span', { class: 'event', text: `Gains the Lead ${step.lead}` })
      case 'file': return h('span', { class: 'event', text: `Fills in ${step.file}, line ${step.line + 1}` })
      case 'anomaly': return h('span', { class: 'event', text: `${step.open ? 'Opens' : 'Closes'} the Anomaly ${step.anomaly}` })
      case 'join': return h('span', { class: 'event', text: `${name(step.outfit)} joins the crew` })
      case 'aboard': return h('span', { class: 'event', text: `${name(step.outfit)} comes aboard` })
      case 'call': return h('span', { class: 'event', text: `The Call ${step.call}` })
      case 'battle': return h('span', { class: 'event', text: `Battle: ${step.mission}` })
      default: return String(step.kind)
    }
  }
  return h('div', { class: 'script' }, [...walk(steps)].map(({ step, path }) =>
    h('div', { class: `step ${path.includes('.then') ? 'nested' : ''} ${path === now ? 'now' : ''}`, 'data-path': path }, h('span', { class: 'kind', text: step.kind }), line(step))))
}

export function missionCard(mission) {
  return h('div', { class: 'card' },
    h('h3', {}, mission.id, ' ', pill('note', mission.objective.kind)),
    h('dl', { class: 'kv' },
      h('dt', { text: 'Place' }), h('dd', {}, h('code', { text: mission.place })),
      h('dt', { text: 'The map' }), h('dd', { text: mission.brief || '—' }),
      h('dt', { text: 'Enemies' }), h('dd', {}, mission.enemies.map((e) => h('div', { text: enemyWords(e, D.cast.name) }))),
      mission.fixedSquad ? [h('dt', { text: 'Fixed squad' }), h('dd', {}, mission.fixedSquad.map((o) => person(o)))] : null,
      mission.side.length ? [h('dt', { text: 'Side objectives' }), h('dd', { text: mission.side.map((x) => `${x.kind} → ${x.gives}`).join(', ') })] : null,
      mission.scenario ? [h('dt', { text: 'The game’s scenario' }), h('dd', {}, h('code', { text: mission.scenario }))] : null))
}

export function chapterView(id, saveReview) {
  const c = D.data.pack.chapters[id]
  if (!c) return h('div', { class: 'error-box', text: `No chapter ${id}.` })
  const part = (key, label, steps, scene) => {
    const seconds = D.data.seconds[sceneKey(c, key)] ?? 0
    return h('div', { class: 'card' },
      h('div', { class: 'row' }, h('h3', {}, verdictMark(`chapters/${c.id}.json#${key}`), ' ', label), pill(seconds > 180 ? 'error' : 'note', `reads in ${minutes(seconds)}`),
        h('span', { class: 'muted', text: `${plural(steps.length, 'step')} · ${countWords(steps)} words` }),
        steps.length ? h('a', { class: 'btn primary', href: `#/play/${c.id}/${key}`, text: 'Play ›' }) : null),
      scene ? h('p', { class: 'muted' }, 'At ', h('code', { text: scene.place }), ' · ', Object.entries(scene.trigger).map(([k, v]) => `${k} ${v}`).join(''), ' · ', scene.cast.map((m) => person(m.outfit ?? m.heroine ?? m.minor))) : null,
      steps.length ? h('details', {}, h('summary', { text: 'The script' }), scriptList(steps)) : h('p', { class: 'muted', text: 'Not scripted yet.' }))
  }
  return h('div', {},
    h('p', {}, link('#/chapters', '‹ Chapters'), ' · ', link(`#/w/${c.world}`, c.world)),
    h('h1', {}, c.id, ' ', pill(layerOf(`chapter:${c.id}`))),
    findingsList(findingsFor(`chapters/${c.id}.json`)),
    h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', { text: c.leads.length > 1 ? 'Leads (crossed paths)' : 'Lead' }), h('dd', {}, c.leads.map((l) => person(l))),
      h('dt', { text: 'Chapter' }), h('dd', { text: c.number === 1 ? '1: it ends with her coming aboard' : String(c.number) }),
      h('dt', { text: 'Danger' }), h('dd', { text: String(c.danger) }),
      h('dt', { text: 'Opens with' }), h('dd', { text: c.needs.join(', ') || 'nothing: open from the start' }),
      h('dt', { text: 'Length' }), h('dd', { text: `${plural(c.scenes.length, 'scene')}, ${plural(c.missions.length, 'battle')}, ${chapterWords(c)} words, reads in ${minutes(chapterSeconds(c))}` }))),
    h('h2', { text: 'Scenes' }),
    c.scenes.length ? c.scenes.map((scene) => part(scene.id, scene.id, scene.steps, scene)) : h('div', { class: 'card muted', text: 'No scene yet.' }),
    h('h2', { text: 'Battles' }),
    c.missions.length ? c.missions.map(missionCard) : h('div', { class: 'card muted', text: 'No mission yet.' }),
    h('h2', { text: 'The debrief aboard' }),
    part('debrief', 'Debrief', c.debrief.steps, null),
    reviewPanel(`chapters/${c.id}.json`, saveReview))
}

// --- Cast

export function castView(saveReview) {
  const { casting } = D.data.pack, pack = D.data.cast
  const leads = new Set(casting.leads.map((l) => String(l.outfit))), crew = new Set(casting.crewOrder.map(String))
  const byFaction = {}
  for (const x of casting.heroines) (byFaction[x.faction] ??= []).push(x)
  const batches = {}
  for (const u of pack?.umas ?? []) if (u.batch) (batches[u.batch] ??= []).push(u)
  return h('div', {}, h('h1', { text: 'Cast' }),
    D.data.castProblem ? h('div', { class: 'error-box', text: `The cast pack can’t be read: ${D.data.castProblem}` }) : null,
    pack ? h('p', { class: 'muted', text: `Names and faces from the cast pack ${pack.id}: ${plural(pack.umas.length, 'Uma')}, ${plural(pack.heroines.length, 'heroine')}, the Ranker’s revision ${pack.ranker?.boardRevision ?? '?'}.` })
      : h('div', { class: 'banner' }, h('b', { text: 'No cast pack yet. ' }), 'Ids show as they are, or with the stand-in’s labels. ', h('code', { text: 'pnpm stories:import-cast' }), ' builds it from the Ranker’s plan.'),
    findingsList(findingsFor('casting.json')),
    h('div', { class: 'card' }, h('h3', {}, verdictMark('casting.json'), ' Leads ', pill(D.data.pack.casting.layer ?? 'placeholder')),
      casting.leads.length ? h('div', { class: 'scroll' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Lead', 'Outfit id', 'Her world', 'Opens', 'Talent', 'Role', 'Chapters', 'Aboard at'].map((t) => h('th', { text: t })))),
        h('tbody', {}, casting.leads.map((l) => h('tr', {}, h('td', {}, person(l.outfit)), h('td', {}, h('code', { text: String(l.outfit) })), h('td', {}, link(`#/w/${l.world}`, l.world)),
          h('td', { text: l.opens ?? '—' }), h('td', { text: l.talent ?? '—' }), h('td', { text: casting.roles?.[String(l.outfit)] ?? 'her running style’s' }),
          h('td', {}, (D.index.chaptersByLead[String(l.outfit)] ?? []).map((c) => [link(`#/ch/${c.id}`, c.id), ' '])),
          h('td', {}, D.index.aboard[String(l.outfit)] ? link(`#/play/${D.index.aboard[String(l.outfit)].chapter}/${D.index.aboard[String(l.outfit)].scene}`, D.index.aboard[String(l.outfit)].scene) : '—'))))))
        : h('p', { class: 'muted', text: 'No lead yet.' })),
    h('div', { class: 'card' }, h('h3', { text: 'The crew’s order' }),
      h('p', { class: 'muted', text: 'An interjection slot plays the line of the first of these who is in the squad and has one.' }),
      casting.crewOrder.length ? h('div', {}, casting.crewOrder.map((o, i) => person(o, `${i + 1}${D.index.joins[String(o)] ? ` · joins in ${D.index.joins[String(o)].scene}` : ''}`))) : h('p', { class: 'muted', text: 'Not set yet.' })),
    h('div', { class: 'card' }, h('h3', { text: 'Heroines, by faction and Hold' }),
      h('p', { class: 'muted', text: 'Freed, never killed: an Anchor or a Collar is broken in battle; with no Hold, the story brings her over.' }),
      Object.keys(byFaction).length ? Object.entries(byFaction).map(([faction, list]) => h('div', {}, h('h4', { text: `${faction} · ${list.length}` }),
        list.map((x) => h('span', { class: 'who' }, face(x.board), h('span', {}, h('a', { href: `#/profile/${encodeURIComponent(x.board)}`, text: D.cast.name(x.board) }), ' ', pill(x.hold))))))
        : h('p', { class: 'muted', text: 'None cast yet.' })),
    casting.minor.length ? h('div', { class: 'card' }, h('h3', { text: 'Minor characters' }), casting.minor.map((m) => person(m))) : null,
    Object.keys(batches).length ? h('div', { class: 'card' }, h('h3', { text: 'The Ranker’s Umas, by batch' }),
      h('p', { class: 'muted', text: 'Who’s cast so far: a lead, in the crew’s order, or not yet in the story.' }),
      Object.entries(batches).sort(([a], [b]) => a - b).map(([batch, list]) => h('div', {}, h('h4', { text: `Batch ${batch} · ${list[0].tier}` }),
        list.sort((a, b) => a.order - b.order).map((u) => person(u.outfit, leads.has(String(u.outfit)) ? 'lead' : crew.has(String(u.outfit)) ? 'crew' : null))))) : null,
    reviewPanel('casting.json', saveReview))
}

// --- Log: Files, Leads, Anomalies, flags

const where = (list) => (list ?? []).map((x) => [x.scene ? link(`#/play/${x.chapter}/${x.scene}`, x.scene) : h('span', { text: `${x.mission} (side)` }), ' '])

export function logView(saveReview) {
  const files = Object.values(D.data.pack.files), ix = D.index
  const table = (heads, rows) => h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, heads.map((t) => h('th', { text: t })))), h('tbody', {}, rows)))
  return h('div', {}, h('h1', { text: 'The Log' }),
    h('p', { class: 'muted', text: 'Files with redacted lines that scenes fill in, the Leads a scene or a side objective gives, and the Anomalies opened and explained.' }),
    files.length ? files.map((f) => h('div', { class: 'card' },
      h('h3', {}, verdictMark(`log/${f.id}.json`), ' ', f.id, f.world ? [' · ', link(`#/w/${f.world}`, f.world)] : null),
      findingsList(findingsFor(`log/${f.id}.json`)),
      table(['Line', 'Text', 'Filled in by'], f.lines.map((line, i) => h('tr', {}, h('td', { text: String(i + 1) }),
        h('td', {}, line.text, line.redacted ? [' ', pill('todo', 'redacted')] : null),
        h('td', {}, where(ix.fileLines[f.id]?.[String(i)]), !ix.fileLines[f.id]?.[String(i)] && line.redacted ? h('span', { class: 'muted', text: 'nothing yet' }) : null)))),
      reviewPanel(`log/${f.id}.json`, saveReview))) : h('div', { class: 'card muted', text: 'No Log File yet: content/stories/log/<id>.json.' }),
    h('div', { class: 'card' }, h('h3', { text: 'Leads' }),
      Object.keys(ix.leads).length ? table(['Lead', 'Gained in', 'How'], Object.entries(ix.leads).map(([id, list]) => h('tr', {}, h('td', {}, h('code', { text: id })), h('td', {}, where(list)), h('td', { text: list.map((x) => x.how).join(', ') }))))
        : h('p', { class: 'muted', text: 'None yet.' })),
    h('div', { class: 'card' }, h('h3', { text: 'Anomalies' }),
      Object.keys(ix.anomalies).length ? table(['Anomaly', 'Opened in', 'Explained in'], Object.entries(ix.anomalies).map(([id, a]) => h('tr', {}, h('td', {}, h('code', { text: id })), h('td', {}, where(a.opened)),
        h('td', {}, a.closed.length ? where(a.closed) : pill('todo', 'still open')))))
        : h('p', { class: 'muted', text: 'None yet.' })),
    h('div', { class: 'card' }, h('h3', { text: 'Flags' }),
      Object.keys(ix.flags).length ? table(['Flag', 'Set in'], Object.entries(ix.flags).map(([id, list]) => h('tr', {}, h('td', {}, h('code', { text: id })), h('td', {}, where(list)))))
        : h('p', { class: 'muted', text: 'None yet.' })))
}

// --- Calls

export function callsView(saveReview) {
  const calls = Object.values(D.data.pack.calls)
  return h('div', {}, h('h1', { text: 'Calls' }),
    h('p', { class: 'muted', text: 'A crew vote: the question, each voter’s argument, and branches of one or two missions that rejoin.' }),
    calls.length ? calls.map((c) => h('div', { class: 'card' },
      h('h3', {}, verdictMark(`calls/${c.id}.json`), ' ', c.id), h('p', { text: c.question }),
      findingsList(findingsFor(`calls/${c.id}.json`)),
      h('h4', { text: 'The arguments' }), c.voters.length ? c.voters.map((v) => h('p', {}, person(v.outfit), v.argument)) : h('p', { class: 'muted', text: 'None yet.' }),
      h('h4', { text: 'The branches' }), c.branches.map((b) => h('div', {}, h('p', {}, h('b', { text: b.text }), ' ', h('code', { text: b.id })), b.then.length ? scriptList(b.then) : null)),
      h('p', { class: 'muted' }, 'Held in: ', D.index.calls[c.id] ? where(D.index.calls[c.id]) : 'no scene yet'),
      reviewPanel(`calls/${c.id}.json`, saveReview))) : h('div', { class: 'card muted', text: 'No Call yet: content/stories/calls/<id>.json.' }))
}

// --- Checks and Format

export function checksView() {
  const group = (level, title, empty) => {
    const list = D.data.findings.filter((f) => f.level === level)
    return h('div', { class: 'card' }, h('h3', { text: `${title} · ${list.length}` }),
      list.length ? h('div', { class: 'scroll' }, h('table', {}, h('tbody', {}, list.map((f) => h('tr', {}, h('td', {}, f.file ? h('code', { text: f.file }) : null), h('td', {}, f.where ? h('code', { text: f.where }) : null), h('td', { text: f.message }))))))
        : h('p', { class: 'muted', text: empty }))
  }
  return h('div', {}, h('h1', { text: 'Checks' }),
    h('p', { class: 'muted' }, 'Exactly what ', h('code', { text: 'pnpm story:check' }), ' reports: the game’s own parser and cross-file rules, run on every load.',
      D.data.clean ? '' : ' Cross-file rules wait until every file parses.'),
    group('error', 'Errors', 'None: the game can read every file.'), group('todo', 'To do', 'Nothing flagged.'), group('note', 'Counts', 'Nothing counted yet.'))
}

const STEP_WORDS = {
  line: 'A speaker and her line, 160 characters at most', slot: 'An interjection: a line for each lead who might be in the squad, and a fallback',
  narrate: 'Narration, no speaker', thought: 'A speaker’s inner line', emote: 'An actor’s emote', wait: 'A beat, in milliseconds',
  choice: 'One-tap options; an option can gain a Lead and has its own steps', flag: 'Sets or clears a story flag', lead: 'Gains a Lead',
  file: 'Fills in a Log File’s line', anomaly: 'Opens or closes an Anomaly', join: 'A crew Uma comes aboard', aboard: 'The lead comes aboard: Chapter 1’s last step',
  call: 'Holds a Call', battle: 'Plays a mission of the same chapter',
}
export function formatView() {
  const f = D.data.format
  return h('div', {}, h('h1', { text: 'Format' }),
    h('p', { class: 'muted' }, 'The game’s own format, read from ', h('code', { text: 'packages/domain/src/story/' }), ': what the sandbox shows, the game plays.'),
    h('div', { class: 'card' }, h('h3', { text: 'The files' }), h('div', { class: 'scroll' }, h('table', {}, h('tbody', {},
      [['casting.json', 'Leads, the crew’s order, role tags, heroines by faction and Hold, minor characters'], ['worlds/<id>.json', 'A world: its look, mood, places (the map’s nodes) and factions'],
        ['chapters/<id>.json', 'A chapter: its leads, world, number, danger, keys, scenes, missions and debrief'], ['log/<id>.json', 'A Log File: its lines, and which are redacted'],
        ['calls/<id>.json', 'A Call: the question, the voters’ arguments, the branches'], ['world-notes.md', 'The world with its names; never parsed'], ['reviews.json', 'Your verdicts, written by this page']]
        .map(([file, what]) => h('tr', {}, h('td', {}, h('code', { text: file })), h('td', { text: what }))))))),
    h('div', { class: 'card' }, h('h3', { text: `The ${f.stepKinds.length} step kinds` }), h('div', { class: 'scroll' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Step', 'What it is', 'Used'].map((t) => h('th', { text: t })))),
      h('tbody', {}, f.stepKinds.map((k) => h('tr', {}, h('td', {}, h('code', { text: k })), h('td', { text: STEP_WORDS[k] ?? '' }), h('td', { text: String(D.index.kinds[k] ?? 0) }))))))),
    h('div', { class: 'card' }, h('h3', { text: 'Ids, objectives and layers' }), h('dl', { class: 'kv' },
      h('dt', { text: 'An Uma' }), h('dd', { text: 'Her outfit id (a sister shares her base Uma’s character id, so never the character id alone)' }),
      h('dt', { text: 'A heroine' }), h('dd', { text: 'Her board id from the Ranker' }),
      h('dt', { text: 'Everything ours' }), h('dd', { text: 'A lowercase slug that never changes once used' }),
      h('dt', { text: 'A line' }), h('dd', { text: `${f.lineMax} characters at most` }),
      h('dt', { text: 'Objectives' }), h('dd', { text: f.objectives.join(', ') }),
      h('dt', { text: 'Layers' }), h('dd', {}, f.layers.map((l) => [pill(l), ' '])))))
}

// --- Notes

export function notesView(saveReview) {
  return h('div', {}, h('h1', { text: 'Notes' }),
    h('div', { class: 'card' }, h('h3', {}, D.data.notes !== null ? verdictMark('world-notes.md') : null, ' The world, with its names'),
      h('p', { class: 'muted' }, 'Private: ', h('code', { text: 'content/stories/world-notes.md' })),
      D.data.notes !== null ? md(D.data.notes) : h('p', { class: 'muted', text: 'Not written yet.' })),
    D.data.notes !== null ? reviewPanel('world-notes.md', saveReview) : null,
    h('div', { class: 'card' }, h('h3', { text: 'The world doc, in git and nameless' }),
      h('p', { class: 'muted' }, h('code', { text: 'docs/design/world.md' }), ': the first pass (WD1–WD24), which the story’s first deliverable rewrites.'),
      D.data.worldDoc ? h('details', {}, h('summary', { text: 'Read it here' }), md(D.data.worldDoc)) : h('p', { class: 'muted', text: 'Not found.' })))
}
