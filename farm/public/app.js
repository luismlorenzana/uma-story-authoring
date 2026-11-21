// The Farm Story Sandbox's entry: loads the story from the local server and routes between views.
import { bondsView } from './bonds.js'
import { duosView } from './duos.js'
import { characterView, charactersView, countsView, indexStory, relationshipsView, worldView } from './people.js'
import { playerView } from './player.js'
import { castView, chaptersView, chapterView, D, farmView, formatView, h, index } from './views.js'

const app = document.getElementById('app')
let loadedAt = 0

async function load() {
  const response = await fetch('./api/state', { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data.chapters) throw new Error(data.error ?? `HTTP ${response.status}`)
  index(data)
  indexStory(data.story)
  loadedAt = Date.now()
  const st = data.story
  const game = data.game.ok ? 'The game’s story loaded' : 'The game’s story isn’t loaded'
  document.getElementById('pack').textContent = `${game} · ${st?.cast ? `${st.cast.data.umas.length} Umas, ${st.ties?.data.ties.length ?? 0} ties, ${st.bibles.length} bibles` : 'no story yet'}`
}

async function saveReview(input) {
  const response = await fetch('./api/reviews', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  D.data.reviews = data
}

function route() {
  const [head, a, b, ...rest] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  const nav = { '': 'characters', characters: 'characters', c: 'characters', rel: 'rel', counts: 'counts', world: 'world', chapters: 'chapters', ch: 'chapters', town: 'town', cast: 'town', bonds: 'bonds', duo: 'duo', farm: 'farm', format: 'format', play: a === 'ch' ? 'chapters' : 'bonds' }[head] ?? 'characters'
  for (const link of document.querySelectorAll('[data-nav]')) link.classList.toggle('on', link.dataset.nav === nav)
  let view
  try {
    if (head === 'ch' && a) view = chapterView(a, b || 'overview', saveReview)
    else if (head === 'c' && a) view = characterView(a, saveReview)
    else if (head === 'rel') view = relationshipsView(saveReview)
    else if (head === 'world') view = worldView(saveReview)
    else if (head === 'counts') view = countsView()
    else if (head === 'chapters') view = chaptersView()
    else if (head === 'town' || head === 'cast') view = castView()
    else if (head === 'bonds') view = bondsView()
    else if (head === 'duo') view = duosView(a, b)
    else if (head === 'farm') view = farmView(a || null)
    else if (head === 'format') view = formatView()
    else if (head === 'play' && a && b) view = playerView(a, b, rest, saveReview)
    else view = charactersView()
  } catch (error) {
    console.error(error)
    view = h('div', { class: 'error-box', text: `This view failed: ${error.message}` })
  }
  app.replaceChildren(view)
  if (head !== 'play') window.scrollTo({ top: 0 })
}

window.addEventListener('hashchange', route)
// Edit a draft, come back to the page: it reloads what's on disk (unless something is playing).
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || Date.now() - loadedAt < 1500 || location.hash.startsWith('#/play/')) return
  try { await load(); route() } catch { /* keep what we have */ }
})
load().then(route).catch((error) => { app.replaceChildren(h('div', { class: 'error-box' }, h('b', { text: 'The sandbox could not load the story. ' }), error.message)) })
