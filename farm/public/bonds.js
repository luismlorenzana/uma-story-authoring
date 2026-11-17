// The Bonds page: the 25 story beats and the conversations, their coverage, and a tester that runs the conversations'
// choosing rule on two of the sample crew, so a template's reach can be seen before the game has it.
import { chooseConversation } from './model.js'
import { D, TEMPERAMENT_COLOR, crew, h, placeName, reviewDot, stat, temperaments, umaDisc } from './views.js'

const tester = { a: 0, b: 1, place: 'mine', hearts: 1 }

/** The choosing rule (lib/model.mjs, tested there) over every written template. */
export const choose = (pair, place, hearts) => chooseConversation(D.data.conversations.map((c) => c.template), pair, place, hearts)
const filterWords = (who) => (Object.keys(who ?? {}).length ? Object.entries(who).map(([k, v]) => `${k === 'line' ? 'calling' : k} ${v}`).join(', ') : 'anyone')

export function bondsView() {
  const { data } = D
  const list = crew()
  const beatsBy = new Map(data.beats.map((b) => [`${b.beat.temperament}.${b.beat.hearts}`, b]))
  const cov = data.cross.conversations
  const placesUsed = (data.game.places ?? []).filter((p) => p.row <= 5).map((p) => p.id)
  const others = [...new Set(data.conversations.map((c) => c.template.place).filter((p) => p !== 'any' && !placesUsed.includes(p)))]
  const result = h('div')
  const drawTester = () => {
    const a = list[tester.a], b = list[tester.b]
    if (tester.a === tester.b) { result.replaceChildren(h('p', { class: 'muted', text: 'Pick two different Umas.' })); return }
    const ranked = choose([a, b], tester.place, tester.hearts)
    result.replaceChildren(ranked.length
      ? h('div', { class: 'ranked' }, ranked.map((r, i) => h('div', { class: i === 0 ? 'win' : '' },
        h('span', { class: 'score', text: r.score }),
        h('span', {}, h('b', { text: r.template.id }), h('br'), h('span', { class: 'muted', text: `${placeName(r.template.place)} · {a}: ${filterWords(r.template.a)} → ${r.a.name} · {b}: ${filterWords(r.template.b)} → ${r.b.name}` })),
        h('a', { class: `btn sm ${i === 0 ? 'primary' : ''}`, href: `#/play/conv/${encodeURIComponent(r.template.id)}/${r.a.id}/${r.b.id}`, text: i === 0 ? 'Play the winner' : 'Play' }))))
      : h('div', { class: 'note-box' }, h('b', { text: 'No template fits this pair here yet. ' }), `Every pair must get a match, so each heart needs a catch-all: an any-place template with no filters. Heart ${tester.hearts} ${cov[tester.hearts - 1]?.catchAll ? 'has one, so this shouldn’t happen' : 'has none yet'}.`))
  }
  // Each select stores one tester field: a crew index for a and b, a place id, or a number of hearts.
  const pick = (k, values, labelOf) => {
    const valueOf = (v, i) => (k === 'a' || k === 'b' ? i : v)
    return h('select', { onchange: (e) => { tester[k] = k === 'place' ? e.target.value : Number(e.target.value); drawTester() } },
      values.map((v, i) => h('option', { value: valueOf(v, i), selected: valueOf(v, i) === tester[k] ? true : null, text: labelOf(v) })))
  }
  drawTester()
  return h('div', {},
    h('h1', { text: 'Bonds' }),
    h('p', { class: 'muted', text: 'The crew’s own stories: your affinity with each Uma opens her story beats, and pairs who work together open conversations. Both come from templates, so no Uma is named: her name is filled at run time.' }),
    h('div', { class: 'summary' },
      stat(`${data.cross.beats.scripted}/${data.cross.beats.target}`, 'story beats scripted'),
      stat(`${data.cross.beats.outlined}`, 'story beats outlined'),
      stat(data.conversations.length, 'conversations written'),
      stat(`${cov.reduce((n, x) => n + x.counted, 0)}/${cov.reduce((n, x) => n + x.target, 0)}`, 'toward the target'),
      stat(`${cov.filter((x) => x.catchAll).length}/5`, 'hearts with a catch-all'),
      stat(data.beats.concat(data.conversations).filter((x) => x.issues.length).length, 'with checks to fix'),
    ),
    h('div', { class: 'section-head' }, h('h2', { text: 'Story beats' }), h('span', { class: 'muted small', text: 'Five a temperament; gold ones have lines. Click one to play it.' })),
    h('div', { class: 'grid-beats' },
      h('span', { class: 'h', text: 'Temperament' }), data.beatHearts.map((n) => h('span', { class: 'h', text: `♥ ${n}` })),
      temperaments().map((t) => {
        const sample = list.find((c) => c.temperament === t)
        return [h('div', { class: 't' }, sample ? umaDisc(sample, 30) : null, h('span', {}, t[0].toUpperCase() + t.slice(1), sample ? h('div', { class: 'muted small', text: `played by ${sample.name}` }) : null)),
          data.beatHearts.map((n) => {
            const entry = beatsBy.get(`${t}.${n}`)
            if (!entry) return h('div', { class: 'beat' }, h('span', { text: 'Not written' }))
            const b = entry.beat
            return h('a', { class: `beat ${b.layer}`, href: `#/play/beat/${encodeURIComponent(b.id)}`, vars: { '--c': TEMPERAMENT_COLOR[t] } },
              h('div', { class: 'row' }, h('b', { text: b.title }), reviewDot(b.id), entry.issues.length ? h('span', { class: 'warn-text', text: `${entry.issues.length} checks` }) : null),
              h('span', { text: b.premise }), h('div', {}, h('span', { class: `badge ${b.layer}`, text: b.layer })))
          })]
      })),
    h('div', { class: 'section-head' }, h('h2', { text: 'Who would talk, and what about' }), h('span', { class: 'muted small', text: 'The choosing rule on two of the sample crew' })),
    h('div', { class: 'panel' },
      h('div', { class: 'tester' },
        h('label', {}, 'Uma {a} or {b}', pick('a', list, (c) => `${c.name} · ${c.temperament}`)),
        h('label', {}, 'And', pick('b', list, (c) => `${c.name} · ${c.temperament}`)),
        h('label', {}, 'Where they work', pick('place', [...placesUsed, 'expeditions', ...others.filter((p) => p !== 'expeditions')], placeName)),
        h('label', {}, 'Their bond', pick('hearts', data.bondHearts, (n) => `${n} heart${n === 1 ? '' : 's'}`)),
        h('a', { class: 'btn', href: '#/town', text: 'Edit the crew' })),
      result),
    h('div', { class: 'section-head' }, h('h2', { text: 'Coverage' }), h('span', { class: 'muted small', text: `Per heart: ${data.target.any} any-place and ${data.target.place} a work place` })),
    h('div', { class: 'panel' }, h('table', { class: 'table cover' },
      h('tr', {}, h('th', { text: 'Place' }), data.bondHearts.map((n) => h('th', { text: `♥ ${n}` }))),
      h('tr', {}, h('td', {}, h('b', { text: 'Any place' })), cov.map((x) => h('td', { class: `n ${x.any >= data.target.any ? 'met' : x.any ? 'some' : ''}`, text: `${x.any}/${data.target.any}${x.catchAll ? ' ✓' : ''}` }))),
      placesUsed.map((p) => h('tr', {}, h('td', { text: placeName(p) }), cov.map((x) => { const n = x.places[p] ?? 0; return h('td', { class: `n ${n >= data.target.place ? 'met' : n ? 'some' : ''}`, text: `${n}/${data.target.place}` }) }))),
      others.map((p) => h('tr', {}, h('td', {}, placeName(p), h('span', { class: 'muted small', text: ' (beyond the target)' })), data.bondHearts.map((n) => h('td', { class: 'n', text: data.conversations.filter((c) => c.template.place === p && c.template.hearts === n).length || '' })))),
      h('tr', {}, h('td', {}, h('b', { text: 'Toward the target' })), cov.map((x) => h('td', { class: 'n', text: `${x.counted}/${x.target}` }))),
    ), h('p', { class: 'small muted', text: '✓ a catch-all for that heart: an any-place template with no filters, so every pair has a match.' })),
    h('div', { class: 'section-head' }, h('h2', { text: 'Every conversation' })),
    h('div', { class: 'panel' }, h('table', { class: 'table' },
      h('tr', {}, ['Template', 'Place', '♥', '{a}', '{b}', 'Opens with', ''].map((x) => h('th', { text: x }))),
      data.conversations.map(({ template: t, issues }) => h('tr', { class: 'click', onclick: () => { location.hash = `#/play/conv/${encodeURIComponent(t.id)}` } },
        h('td', {}, h('code', { text: t.id }), reviewDot(t.id)), h('td', { text: placeName(t.place) }), h('td', { text: t.hearts }),
        h('td', { text: filterWords(t.a) }), h('td', { text: filterWords(t.b) }), h('td', { text: t.lines?.[0]?.text ?? '' }),
        h('td', {}, issues.length ? h('span', { class: 'warn-text', text: `${issues.length} checks` }) : null))))),
  )
}
