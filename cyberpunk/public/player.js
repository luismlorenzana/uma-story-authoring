// The scene player: one scene (or a chapter's debrief) a step at a time, as the game will play it. Choices and a Call's
// branches are one-tap picks; an interjection slot plays the line of the first lead in the crew's order who is in the
// squad you set here; story changes (a Lead, a File's line, an Anomaly, a join, coming aboard, a battle) show as cards.
import { slotLine } from '/model.js'
import { D, face, h, missionCard, reviewPanel, scriptList } from '/views.js'

export function playerView(chapterId, sceneId, saveReview) {
  const chapter = D.data.pack.chapters[chapterId]
  const scene = chapter?.scenes.find((x) => x.id === sceneId) ?? null
  if (!chapter || (!scene && sceneId !== 'debrief')) return h('div', { class: 'error-box', text: `No scene ${sceneId} in ${chapterId}.` })
  const steps = scene ? scene.steps : chapter.debrief.steps
  const casting = D.data.pack.casting, name = (id) => D.cast.name(id)
  const squad = new Set(chapter.leads.map(String))
  let picks = [], shown = 1, auto = null

  /** The scene from its start with the picks so far: every entry reached, stopping where a pick is still owed. */
  function run() {
    const entries = []; let at = 0
    const play = (list, base) => {
      for (const [i, step] of list.entries()) {
        const path = `${base}[${i}]`
        const branches = step.kind === 'choice' ? step.options : step.kind === 'call' ? D.data.pack.calls[step.call]?.branches ?? [] : null
        if (!branches?.length) { entries.push({ step, path }); continue }
        const pick = picks[at]
        if (pick === undefined) { entries.push({ step, path, branches, waiting: true }); return false }
        at++
        entries.push({ step, path, branches, picked: pick })
        if (!play(branches[pick].then, `${path}.${step.kind}[${pick}].then`)) return false
      }
      return true
    }
    play(steps, 'steps')
    return entries
  }

  const view = h('div', {})
  const stopAuto = () => { if (auto) { clearTimeout(auto); auto = null } }

  function next() {
    const entries = run(), current = entries[shown - 1]
    if (!current || current.waiting || shown >= entries.length) return false
    shown++
    return true
  }
  function pick(i) { picks.push(i); shown++; draw() }
  function back() {
    if (shown <= 1) return
    shown--
    // The pick of the entry now on stage, and any after it, is taken back, so it can be made again.
    picks = picks.slice(0, run().slice(0, shown - 1).filter((e) => e.picked !== undefined).length)
  }

  function stage(entry) {
    const { step } = entry
    const speaker = (id) => h('div', { class: 'speaker' }, face(id, 56), name(id))
    const box = (cls, ...children) => h('div', { class: `box ${cls}` }, ...children)
    const options = (list, label) => h('div', { class: 'options' }, list.map((o, i) => h('button', {
      class: `btn option ${entry.picked === i ? 'on' : ''}`, type: 'button', disabled: !entry.waiting, onclick: () => pick(i),
    }, label(o), o.lead ? h('small', { text: ` · gains the Lead ${o.lead}` }) : null)))
    switch (step.kind) {
      case 'line': return [speaker(step.speaker), box('', step.text)]
      case 'thought': return [speaker(step.speaker), box('thought', step.text)]
      case 'narrate': return [box('narrate', step.text)]
      case 'slot': {
        const line = slotLine(step, [...squad], casting.crewOrder)
        return [line.speaker ? speaker(line.speaker) : null, box(line.speaker ? '' : 'narrate', line.text),
          h('small', { class: 'muted', text: line.speaker ? 'An interjection: she’s the first in the crew’s order who’s in the squad and has a line here.' : 'An interjection: nobody in the squad has a line here, so this is the fallback.' })]
      }
      case 'emote': return [speaker(step.actor), box('event', step.emote)]
      case 'wait': return [box('event', `A beat · ${step.ms} ms`)]
      case 'choice': return [box('event', entry.waiting ? 'Your choice' : 'You chose'), options(step.options, (o) => o.text)]
      case 'flag': return [box('event', `${step.set ? 'Sets' : 'Clears'} the flag ${step.flag}`)]
      case 'lead': return [box('event', `A new Lead: ${step.lead}`)]
      case 'file': { const line = D.data.pack.files[step.file]?.lines[step.line]; return [box('event', `The Log · ${step.file}, line ${step.line + 1} fills in`), line ? box('', line.text) : null] }
      case 'anomaly': return [box('event', `${step.open ? 'An Anomaly opens' : 'An Anomaly is explained'}: ${step.anomaly}`)]
      case 'join': return [speaker(step.outfit), box('event', 'Joins the crew')]
      case 'aboard': return [speaker(step.outfit), box('event', 'Comes aboard: her Chapter 1 ends here')]
      case 'call': {
        const call = D.data.pack.calls[step.call]
        if (!call) return [box('event', `The Call ${step.call} isn’t written yet`)]
        return [box('event', `The Call · ${call.question}`), call.voters.map((v) => h('div', { class: 'who' }, face(v.outfit), h('span', {}, h('b', { text: `${name(v.outfit)}: ` }), v.argument))),
          entry.branches ? options(call.branches, (b) => b.text) : null]
      }
      case 'battle': { const m = chapter.missions.find((x) => x.id === step.mission); return [box('event', 'A battle'), m ? missionCard(m) : box('', `The mission ${step.mission} isn’t written yet`)] }
      default: return [box('event', step.kind)]
    }
  }

  function draw() {
    const entries = run()
    shown = Math.min(Math.max(shown, 1), Math.max(entries.length, 1))
    const current = entries[shown - 1]
    const atEnd = !current || (!current.waiting && shown >= entries.length)
    const item = `chapters/${chapter.id}.json#${sceneId}`
    view.replaceChildren(
      h('p', {}, h('a', { href: `#/ch/${chapter.id}`, text: `‹ ${chapter.id}` })),
      h('h1', { text: scene ? scene.id : `${chapter.id} · the debrief aboard` }),
      scene ? h('p', { class: 'muted' }, 'At ', h('code', { text: scene.place }), ' · ', Object.entries(scene.trigger).map(([k, v]) => `${k} ${v}`).join('')) : null,
      h('div', { class: 'player' },
        h('div', {},
          h('div', { class: 'stage', 'aria-live': 'polite' }, current ? stage(current) : h('div', { class: 'box narrate', text: 'This scene has no steps yet.' })),
          h('div', { class: 'row', style: 'margin:10px 0' },
            h('button', { class: 'btn', type: 'button', disabled: shown <= 1, onclick: () => { stopAuto(); back(); draw() }, text: '‹ Back' }),
            h('button', { class: 'btn primary', type: 'button', disabled: atEnd || current?.waiting, onclick: () => { stopAuto(); next(); draw() }, text: 'Next ›' }),
            h('button', { class: `btn ${auto ? 'on' : ''}`, type: 'button', disabled: atEnd, onclick: () => { if (auto) stopAuto(); else tick(); draw() }, text: auto ? 'Stop' : 'Auto' }),
            h('button', { class: 'btn', type: 'button', onclick: () => { stopAuto(); picks = []; shown = 1; draw() }, text: 'Restart' }),
            h('span', { class: 'muted', text: `${Math.min(shown, entries.length)} of ${entries.length}${entries.at(-1)?.waiting ? '+' : ''}${atEnd && current ? ' · the end' : ''}` })),
          h('div', { class: 'card' }, h('h4', { text: 'Who’s in the squad' }),
            h('p', { class: 'muted', text: 'It decides who speaks in an interjection. The chapter’s own leads are always in.' }),
            h('div', { class: 'row' }, casting.crewOrder.map((id) => h('button', {
              class: `btn ${squad.has(String(id)) ? 'on' : ''}`, type: 'button', disabled: chapter.leads.map(String).includes(String(id)),
              onclick: () => { squad.has(String(id)) ? squad.delete(String(id)) : squad.add(String(id)); draw() },
            }, name(id))))),
          reviewPanel(item, saveReview)),
        h('div', { class: 'card' }, h('h4', { text: 'The script' }), scriptList(steps, current?.path ?? null))))
    view.querySelector('.script .now')?.scrollIntoView({ block: 'nearest' })
  }

  function tick() {
    const current = run()[shown - 1]
    const text = current ? (current.step.text ?? current.step.fallback ?? '') : ''
    auto = setTimeout(() => {
      auto = null
      if (!view.isConnected) return
      if (next()) { tick() }
      draw()
    }, 1400 + text.length * 35)
  }

  const keys = (event) => {
    if (!view.isConnected) { document.removeEventListener('keydown', keys); stopAuto(); return }
    if (event.target instanceof HTMLTextAreaElement) return
    if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); stopAuto(); next(); draw() }
    if (event.key === 'ArrowLeft') { event.preventDefault(); stopAuto(); back(); draw() }
  }
  document.addEventListener('keydown', keys)
  draw()
  return view
}
