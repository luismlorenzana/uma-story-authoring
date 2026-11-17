// The scene player: plays one scene's steps on a stage, a text box and overlays, with the script beside it.
import { BIOMES, D, h, who, franchiseTitle } from './views.js'

const GLYPH = { '!': '!', '?': '?', '…': '…', '♪': '♪', sweat: '💧', anger: '💢', heart: '♥', zzz: 'zZ', nod: '·', surprise: '!', laugh: '♪', sad: '…', angry: '💢', wave: '👋' }
const EMOTE_WORDS = { nod: 'nods', surprise: 'starts', laugh: 'laughs', sad: 'lowers her eyes', angry: 'bristles', wave: 'waves' }

export function playerView(heroId, sceneId) {
  const bundle = D.bundles.get(heroId)?.bundle
  const scene = bundle?.scenes?.find((x) => x.id === sceneId)
  if (!scene) return h('p', { class: 'empty', text: 'That scene is not in the bundle.' })
  const steps = scene.steps, limit = D.data.lineLimit
  const city = D.cities.get(scene.place)
  const [sky, ground] = BIOMES[city?.biome] ?? ['#24324f', '#101626']
  let i = 0, auto = null, chosen = new Map()

  const stage = h('div', { class: 'stage', tabindex: 0, 'aria-label': 'Scene stage' })
  stage.style.background = `linear-gradient(180deg, ${sky} 0%, #0b1020 62%, ${ground} 100%)`
  const progress = h('i')
  const list = h('ol', {}, steps.map((st, n) => {
    const text = st.text ?? (st.t === 'boss' ? who(st.id).name : st.t === 'emote' ? `${who(st.actor).name}: ${st.emote ?? st.bubble}` : st.t === 'flashback' ? (st.on ? 'begins' : 'ends') : st.t === 'choice' ? (st.prompt ?? 'a choice') : '')
    const long = (st.t === 'line' || st.t === 'thought') && st.text.length > limit
    return h('li', { class: long ? 'long' : '', onclick: () => go(n) }, h('span', { class: 't', text: st.t }), st.speaker ? h('b', { text: `${who(st.speaker).name}: ` }) : null, text.length > 110 ? text.slice(0, 110) + '…' : text)
  }))

  // Replaying from the start keeps back-stepping honest: who is on stage, and whether we are in a flashback.
  function stateAt(n) {
    let flashback = false
    const slots = { left: null, right: null }, lastUse = new Map()
    const enter = (id, k) => {
      lastUse.set(id, k)
      if (slots.left === id || slots.right === id) return
      if (!slots.left) slots.left = id
      else if (!slots.right) slots.right = id
      else { const older = (lastUse.get(slots.left) ?? -1) <= (lastUse.get(slots.right) ?? -1) ? 'left' : 'right'; slots[older] = id }
    }
    for (const id of scene.cast ?? []) if (id === bundle.hero) { slots.left = id; lastUse.set(id, -1) }
    for (let k = 0; k <= n; k++) {
      const st = steps[k]
      if (st.t === 'flashback') { flashback = !!st.on; slots.left = null; slots.right = null } // a memory has its own cast
      if (st.t === 'line' || st.t === 'thought') enter(st.speaker, k)
      if (st.t === 'emote') enter(st.actor, k)
    }
    return { flashback, slots }
  }

  function actor(id, side, speaking, bubble) {
    if (!id) return null
    const c = who(id)
    const el = h('div', { class: `actor ${side} ${speaking ? '' : 'dim'}` })
    el.append(c.images?.art ? h('img', { src: c.images.art, alt: c.name }) : h('div', { class: 'face lg initials', text: c.name.slice(0, 2) }))
    if (bubble) el.append(h('div', { class: 'bubble', text: GLYPH[bubble] ?? bubble }))
    return el
  }

  function render() {
    const st = steps[i], { flashback, slots } = stateAt(i)
    stage.classList.toggle('flashback', flashback)
    const current = st.speaker ?? st.actor
    const bubble = st.t === 'emote' || st.t === 'line' ? (st.bubble ?? st.emote) : null
    const kids = [h('div', { class: 'stage-place', text: `${city ? city.name : scene.place ?? ''}${flashback ? ' · in memory' : ''}` })]
    kids.push(actor(slots.left, 'left', !current || current === slots.left, current === slots.left ? bubble : null))
    kids.push(actor(slots.right, 'right', !current || current === slots.right, current === slots.right ? bubble : null))
    const warn = (text) => (text && text.length > limit ? h('span', { class: 'warn', text: `${text.length} characters: over the game’s ${limit}` }) : null)
    if (st.t === 'line') kids.push(h('div', { class: 'box' }, h('span', { class: 'nameplate', text: who(st.speaker).name }), st.text, warn(st.text)))
    else if (st.t === 'thought') kids.push(h('div', { class: 'box thought' }, h('span', { class: 'nameplate', text: `${who(st.speaker).name}, inwardly` }), st.text, warn(st.text)))
    else if (st.t === 'narrate') kids.push(h('div', { class: 'box narrate', text: st.text }))
    else if (st.t === 'emote') kids.push(h('div', { class: 'box stage-dir', text: `${who(st.actor).name} ${EMOTE_WORDS[st.emote] ?? ''}${st.bubble ? ` (${st.bubble})` : ''}` }))
    else if (st.t === 'flashback') kids.push(h('div', { class: 'box stage-dir', text: st.text ?? (st.on ? '— A memory —' : '— The present —') }))
    else if (st.t === 'title') kids.push(h('div', { class: 'card-over' }, h('div', {}, h('h2', { text: st.text }), st.sub ? h('p', { text: st.sub }) : null)))
    else if (st.t === 'letter') kids.push(h('div', { class: 'letter' }, st.from ? h('div', { class: 'from', text: st.from }) : null, st.text.split('\n').map((p) => h('p', { text: p }))))
    else if (st.t === 'boss') {
      const c = who(st.id), role = bundle.bosses.find((x) => x.id === st.id)
      kids.push(h('div', { class: 'card-over bosscard' }, h('div', { class: 'bc' }, c.images?.art ? h('img', { src: c.images.art, alt: c.name }) : null,
        h('div', { class: 'bc-text' }, h('small', { text: `Chapter ${role?.chapter ?? ''} · ${franchiseTitle(c.franchise)}` }), h('h2', { text: c.name }), h('p', { text: st.epithet ?? role?.epithet ?? '' })))))
    } else if (st.t === 'choice') {
      const picked = chosen.get(i)
      if (picked === undefined) {
        kids.push(h('div', { class: 'box narrate', text: st.prompt ?? 'What does she say?' }))
        kids.push(h('div', { class: 'choices' }, st.options.map((o, n) => h('button', { onclick: (e) => { e.stopPropagation(); chosen.set(i, n); render() }, text: o.text }))))
      } else {
        const reply = st.options[picked].reply
        kids.push(reply ? h('div', { class: 'box' }, h('span', { class: 'nameplate', text: who(reply.speaker).name }), reply.text, warn(reply.text)) : h('div', { class: 'box narrate', text: st.options[picked].text }))
      }
    } else {
      const text = st.text ?? (st.t === 'walk' ? `${who(st.actor).name} walks to ${st.tile}` : st.t === 'face' ? `${who(st.actor).name} turns ${st.facing}` : st.t === 'camera' ? 'The camera moves' : st.t === 'wait' ? `A pause (${st.ms ?? ''} ms)` : st.t === 'flag' ? `Flag ${st.flag} ${st.set === false ? 'cleared' : 'set'}` : '')
      kids.push(h('div', { class: 'box stage-dir', text: `[${text}]` }))
    }
    stage.replaceChildren(...kids.filter(Boolean))
    progress.style.width = `${((i + 1) / steps.length) * 100}%`
    for (const [n, li] of [...list.children].entries()) li.classList.toggle('on', n === i)
    list.children[i]?.scrollIntoView({ block: 'nearest' })
  }
  function go(n) { i = Math.max(0, Math.min(steps.length - 1, n)); render() }
  function next() {
    if (steps[i].t === 'choice' && !chosen.has(i)) return
    if (i < steps.length - 1) go(i + 1); else stopAuto()
  }
  function stopAuto() { if (auto) { clearTimeout(auto); auto = null; autoBtn.classList.remove('on') } }
  function tick() { const st = steps[i]; const ms = 1800 + 28 * (st.text?.length ?? 20); auto = setTimeout(() => { next(); if (auto) tick() }, ms) }
  const autoBtn = h('button', { class: 'btn', onclick: () => { if (auto) stopAuto(); else { autoBtn.classList.add('on'); tick() } }, text: 'Auto' })
  stage.addEventListener('click', next)
  const onKey = (e) => {
    if (!document.body.contains(stage)) { document.removeEventListener('keydown', onKey); return }
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1) }
  }
  document.addEventListener('keydown', onKey)
  queueMicrotask(render)
  return h('div', {},
    h('div', { class: 'row' }, h('a', { href: `#/s/${heroId}/scenes`, text: `← ${bundle.title}` }), h('span', { class: 'muted', text: '·' }), h('b', { text: scene.title }), scene.about ? h('span', { class: 'muted small', text: scene.about }) : null),
    h('div', { class: 'section-head' }),
    h('div', { class: 'player' },
      h('div', {}, stage,
        h('div', { class: 'controls' },
          h('button', { class: 'btn', onclick: () => go(i - 1), text: '← Back' }),
          h('button', { class: 'btn primary', onclick: next, text: 'Next →' }), autoBtn,
          h('button', { class: 'btn', onclick: () => { chosen = new Map(); stopAuto(); go(0) }, text: 'Restart' }),
          h('div', { class: 'progress' }, progress),
          h('span', { class: 'muted small', text: 'Click, Space or → to go on' }))),
      h('div', { class: 'script' }, h('h4', { text: 'Script' }), list),
    ),
  )
}
