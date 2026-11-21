import { face, umaName } from './people.js'
import { D, h } from './views.js'

const url = (a, b) => `#/duo/${encodeURIComponent(a)}/${encodeURIComponent(b)}`
const titleOf = (a, b) => `${umaName(a)} & ${umaName(b)}`

function words(step) {
  if (step.say) return h('li', {}, h('strong', { text: umaName(step.say) }), ` · ${step.line}`,
    step.emote && h('small', { class: 'muted', text: ` (${step.emote})` }))
  if (step.narrate) return h('li', { class: 'muted', text: step.narrate })
  if (step.illustration) return h('li', { class: 'muted', text: `Illustration · ${step.illustration}` })
  return null
}

export function duosView(a, b) {
  const story = D.story
  if (!a || !b) {
    const duos = story?.household?.data?.duos ?? []
    return h('div', {}, h('h1', { text: 'Farm Duos' }),
      duos.length ? h('ul', {}, duos.map(([first, second]) => h('li', {}, h('a', {
        href: url(first, second), text: titleOf(first, second),
      })))) : h('p', { class: 'muted', text: 'No duo assignments in the current story.' }))
  }

  const pair = story?.pairs?.find(({ data }) => (data.a === a && data.b === b) || (data.a === b && data.b === a))
  const visit = story?.duoVisits?.find(({ who }) => who[0] === a && who[1] === b)
  return h('div', {},
    h('a', { href: '#/duo', text: '← Farm Duos' }),
    h('h1', {}, face(a), ' ', face(b), ' ', titleOf(a, b)),
    h('section', {},
      h('h2', { text: 'Bond scenes' }),
      pair ? h('p', { class: 'muted', text: pair.file }) : h('p', { class: 'muted', text: 'No bond file for this pair.' }),
      (pair?.data.levels ?? []).map(level => h('details', {},
        h('summary', { text: `Bond ${level.hearts} · ${level.place}` }), h('ol', {}, level.steps.map(words))))),
    h('section', {},
      h('h2', { text: 'Casual night visit' }),
      !visit ? h('p', { class: 'muted', text: story?.duoVisits === null
        ? 'Update the Farm checkout to preview its nightly scenes.' : 'Apply the pair to the story to preview it here.' }) :
        h('div', {},
          h('p', {}, h('a', { href: url(b, a), text: `Preview ${umaName(b)} speaking first` })),
          ['sitting', 'bedside', 'farewell', 'morning'].map(beat =>
            h('section', { 'data-duo-beat': beat }, h('h3', { text: beat[0].toUpperCase() + beat.slice(1) }),
              h('ol', {}, visit.beats.filter(part => part.beat === beat).flatMap(part => part.steps.map(words))))))))
}
