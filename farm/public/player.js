// The player: a chapter scene, a story beat or a conversation on a stage, a tap a line, as the game's scene player
// shows them (a disc, the speaker's name, one line), with the script and the roles beside it. A chapter scene ends on
// its card: the goals after an opening, the reward and the next chapter after a closing.
import { choose } from './bonds.js'
import {
  D, castings, crew, h, lineOf, placeColors, placeName, reviewPanel, roleLabel, speakerOf, umaDisc, youDisc,
} from './views.js'

const SAMPLE = { farm: 'Hillside Farm', item: 'turnips' }

/** The steps to play, the stage's place and who stands where, for one route. */
function build(kind, id, extra) {
  if (kind === 'ch') {
    const entry = D.chapters.get(Number(id)), c = entry?.chapter
    const scene = c?.scenes.find((s) => s.kind === extra[0])
    if (!scene?.beats.length) return null
    const steps = scene.beats.map((beat, i) => {
      const who = speakerOf(beat.speaker)
      return { t: who.kind === 'narrator' ? 'narrate' : 'line', who, text: lineOf(beat, who), raw: beat, n: i }
    })
    steps.push({ t: 'card', card: scene.kind, chapter: c })
    const roles = [...new Set(steps.filter((s) => s.who?.role).map((s) => s.who.role))]
    return { title: `Chapter ${c.chapter} · ${scene.title}`, back: [`#/ch/${c.chapter}/scenes`, c.title], place: scene.place, steps, roles, limit: D.data.limits.scene, slots: 'dynamic', review: null, bubble: false }
  }
  if (kind === 'beat') {
    const entry = D.beats.get(id), b = entry?.beat
    if (!b) return null
    const key = `her:${b.temperament}`, her = umaOf(key), you = { kind: 'you', key: 'you', name: 'You', sub: 'the trainer', disc: (s) => youDisc(s) }
    const she = { kind: 'uma', key, role: key, uma: her, name: her.name, sub: `${roleLabel(key)} · ♥ ${b.hearts}`, disc: (s) => umaDisc(her, s) }
    const fill = (text) => text.replaceAll('{name}', her.name).replaceAll('{farm}', SAMPLE.farm)
    const steps = [{ t: 'title', text: b.title, sub: `${b.temperament[0].toUpperCase() + b.temperament.slice(1)} · ${b.hearts} hearts of affinity` }]
    if (b.lines) for (const l of b.lines) steps.push({ t: 'line', who: l.by === 'her' ? she : you, text: fill(l.text) })
    else steps.push({ t: 'narrate', text: `Outline only: ${b.premise}` })
    return { title: `Story beat · ${b.title}`, back: ['#/bonds', 'Bonds'], place: 'gate', steps, roles: [key], limit: D.data.limits.bubble, slots: [she, you], review: { item: b.id, issues: entry.issues, file: 'docs/story/beats.json' }, bubble: true }
  }
  if (kind === 'conv') {
    const entry = D.convs.get(id), t = entry?.template
    if (!t) return null
    const list = crew()
    let a = list.find((c) => c.id === extra[0]), b = list.find((c) => c.id === extra[1])
    if (!a || !b) {
      // The first pair of the crew this template fits, in its order.
      const place = t.place === 'any' ? 'gate' : t.place
      outer: for (const x of list) for (const y of list) if (x !== y) {
        const hit = choose([x, y], place, t.hearts).find((r) => r.template.id === t.id)
        if (hit) { a = hit.a; b = hit.b; break outer }
      }
    }
    if (!a || !b) { a = list[0]; b = list[1] }
    a = umaOf('conv:a', a); b = umaOf('conv:b', b)
    const who = (uma, key) => ({ kind: 'uma', key, role: key, uma, name: uma.name, sub: `{${key.slice(-1)}} · ${uma.temperament}`, disc: (s) => umaDisc(uma, s) })
    const wa = who(a, 'conv:a'), wb = who(b, 'conv:b')
    const where = t.place === 'any' ? 'the farm' : `the ${placeName(t.place)}`
    const fill = (text) => text.replaceAll('{a}', a.name).replaceAll('{b}', b.name).replaceAll('{place}', where).replaceAll('{item}', SAMPLE.item).replaceAll('{farm}', SAMPLE.farm)
    const steps = (t.lines ?? []).map((l) => (l.by === 'narrator' ? { t: 'narrate', text: fill(l.text) } : { t: 'line', who: l.by === 'a' ? wa : wb, text: fill(l.text) }))
    return { title: `Conversation · ${t.id}`, back: ['#/bonds', 'Bonds'], place: t.place === 'any' ? 'fields' : t.place, steps, roles: ['conv:a', 'conv:b'], limit: D.data.limits.bubble, slots: [wa, wb], review: { item: t.id, issues: entry.issues, file: 'docs/story/conversations.json' }, bubble: true, sub: `♥ ${t.hearts} · ${placeName(t.place)}` }
  }
  return null
}

/** Who plays a role here: the one picked in this player, else `fallback`, else the crew's default for it. */
function umaOf(key, fallback) {
  const list = crew()
  const picked = list.find((c) => c.id === castings.get(key))
  if (picked) return picked
  if (fallback) return fallback
  const [kind, arg] = key.split(':')
  return (kind === 'her' && list.find((c) => c.temperament === arg)) || list[0]
}

export function playerView(kind, id, extra, onReview) {
  // A conversation opened with a pair plays that pair; recasting in this player picks again from there.
  if (kind === 'conv' && extra.length === 2) { castings.delete('conv:a'); castings.delete('conv:b') }
  let play = build(kind, id, extra)
  if (!play) return h('p', { class: 'empty', text: 'Nothing to play there yet: it has no lines.' })
  let i = 0, auto = null
  const [sky, ground] = placeColors(play.place)
  const stage = h('div', { class: 'stage', tabindex: 0, 'aria-label': 'Scene stage', vars: { '--sky': sky, '--ground': ground } })
  const progress = h('i')
  const list = h('ol')
  const rolesBox = h('div', { class: 'roles' })

  function drawScript() {
    list.replaceChildren(...play.steps.map((st, n) => {
      const long = st.t === 'line' && st.text.length > play.limit
      const label = st.t === 'card' ? (st.card === 'open' ? 'The goals card' : 'The reward and the next chapter') : st.t === 'title' ? st.text : st.text
      return h('li', { class: long ? 'long' : '', onclick: () => go(n) }, h('span', { class: 't', text: st.t === 'line' ? '' : st.t }), st.who ? h('b', { text: `${st.who.name}: ` }) : null, label.length > 110 ? label.slice(0, 110) + '…' : label)
    }))
  }
  function drawRoles() {
    const everyone = crew()
    rolesBox.replaceChildren(...(play.roles.length ? play.roles.map((key) => {
      const current = play.steps.find((s) => s.who?.role === key)?.who.uma ?? everyone[0]
      return h('label', {}, h('span', { text: key.startsWith('conv:') ? `{${key.slice(-1)}}` : roleLabel(key) }),
        h('select', { onchange: (e) => { castings.set(key, e.target.value); play = build(kind, id, kind === 'conv' ? [] : extra); drawScript(); drawRoles(); render() } },
          everyone.map((c) => h('option', { value: c.id, selected: c.id === current.id ? true : null, text: `${c.name} · ${c.temperament}` }))))
    }) : [h('p', { class: 'muted', text: 'Only the town’s cast speaks here.' })]))
  }

  // Who stands where at step n: two places, the newest speaker taking the one used longest ago (as Quest's player).
  function slotsAt(n) {
    if (Array.isArray(play.slots)) return { left: play.slots[0], right: play.slots[1] }
    const slots = { left: null, right: null }, last = new Map()
    for (let k = 0; k <= n && k < play.steps.length; k++) {
      const who = play.steps[k].who
      if (!who) continue
      last.set(who.key, k)
      if (slots.left?.key === who.key) { slots.left = who; continue }
      if (slots.right?.key === who.key) { slots.right = who; continue }
      if (!slots.left) slots.left = who
      else if (!slots.right) slots.right = who
      else if ((last.get(slots.left.key) ?? -1) <= (last.get(slots.right.key) ?? -1)) slots.left = who
      else slots.right = who
    }
    return slots
  }
  const actor = (who, side, speaking) => (who ? h('div', { class: `actor ${side} ${speaking ? '' : 'dim'}` }, who.disc(150), h('div', { class: 'label' }, who.name, who.sub ? h('small', { text: who.sub }) : null)) : null)

  function card(st) {
    const c = st.chapter
    if (st.card === 'open') {
      return h('div', { class: 'card-over' }, h('div', { class: 'sheet' }, h('small', { text: `Chapter ${c.chapter}` }), h('h2', { text: c.title }),
        h('ol', { class: 'goals' }, c.goals.map((g) => h('li', { text: g }))), h('p', { class: 'reward', text: `Reward: ${c.reward}.` })))
    }
    const next = D.chapters.get(c.chapter + 1)?.chapter
    return h('div', { class: 'card-over' }, h('div', { class: 'sheet' }, h('small', { text: `Chapter ${c.chapter} done` }), h('p', { text: c.reward }),
      c.item ? h('p', { class: 'reward', text: `Story item: ${c.item}` }) : null,
      next ? [h('small', { text: `Chapter ${next.chapter}` }), h('h2', { text: next.title }), h('p', { class: 'soon', text: next.layer === 'built' ? 'Opens next' : 'Soon' })] : h('h2', { text: 'The story ends; the farm goes on' })))
  }

  function render() {
    const st = play.steps[i], { left, right } = slotsAt(i)
    const kids = [h('div', { class: 'stage-place', text: `${placeName(play.place)}${play.sub ? ` · ${play.sub}` : ''}` })]
    kids.push(actor(left, 'left', !st.who || st.who.key === left?.key), actor(right, 'right', !st.who || st.who.key === right?.key))
    const warn = st.text && st.t === 'line' && st.text.length > play.limit ? h('span', { class: 'warn', text: `${st.text.length} characters: over the ${play.bubble ? 'bubble’s' : 'box’s'} ${play.limit}` }) : null
    const count = h('span', { class: 'count', text: `${i + 1}/${play.steps.length}` })
    if (st.t === 'line') kids.push(h('div', { class: `box ${play.bubble ? 'bubble' : ''}` }, h('span', { class: 'nameplate', text: st.who.name }), st.text, warn, count))
    else if (st.t === 'narrate') kids.push(h('div', { class: 'box narrate' }, st.text, count))
    else if (st.t === 'title') kids.push(h('div', { class: 'card-over title' }, h('div', {}, h('h2', { text: st.text }), h('p', { text: st.sub }))))
    else if (st.t === 'card') kids.push(card(st))
    stage.replaceChildren(...kids.filter(Boolean))
    progress.style.width = `${((i + 1) / play.steps.length) * 100}%`
    for (const [n, li] of [...list.children].entries()) li.classList.toggle('on', n === i)
    list.children[i]?.scrollIntoView({ block: 'nearest' })
  }
  function go(n) { i = Math.max(0, Math.min(play.steps.length - 1, n)); render() }
  function next() { if (i < play.steps.length - 1) go(i + 1); else stopAuto() }
  function stopAuto() { if (auto) { clearTimeout(auto); auto = null; autoBtn.classList.remove('on') } }
  function tick() { const ms = 1600 + 30 * (play.steps[i].text?.length ?? 30); auto = setTimeout(() => { next(); if (auto) tick() }, ms) }
  const autoBtn = h('button', { class: 'btn', onclick: () => { if (auto) stopAuto(); else { autoBtn.classList.add('on'); tick() } }, text: 'Auto' })
  stage.addEventListener('click', next)
  const onKey = (e) => {
    if (!document.body.contains(stage)) { document.removeEventListener('keydown', onKey); return }
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1) }
  }
  document.addEventListener('keydown', onKey)
  drawScript(); drawRoles()
  queueMicrotask(render)
  return h('div', {},
    h('div', { class: 'row' }, h('a', { href: play.back[0], text: `← ${play.back[1]}` }), h('span', { class: 'muted', text: '·' }), h('b', { text: play.title })),
    h('div', { class: 'section-head' }),
    h('div', { class: 'player' },
      h('div', {}, stage,
        h('div', { class: 'controls' },
          h('button', { class: 'btn', onclick: () => go(i - 1), text: '← Back' }),
          h('button', { class: 'btn primary', onclick: next, text: 'Next →' }), autoBtn,
          h('button', { class: 'btn', onclick: () => { stopAuto(); go(0) }, text: 'Restart' }),
          h('div', { class: 'progress' }, progress),
          h('span', { class: 'muted small', text: 'Click, Space or → to go on' }))),
      h('div', { class: 'side' },
        h('div', { class: 'script' }, h('h4', { text: 'Script' }), list),
        h('div', { class: 'panel' }, h('h4', { text: 'Who plays the roles' }), rolesBox, h('p', { class: 'small muted', text: 'The sample crew from the Cast page. In the game, master data fills these at run time.' })),
      ),
    ),
    play.review ? [h('div', { class: 'section-head' }, h('h2', { text: 'Review' })), reviewPanel(play.review.item, play.review.issues, play.review.file, onReview, 'No problems: its ids, hearts, filters, lines and placeholders.')] : null,
  )
}
