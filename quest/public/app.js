// The Story Sandbox's entry: loads the private state from the local server and routes between views.
import { castView, characterView, countsView, formatView, h, index, relationshipsView, storiesView, storyView, tagsView, worldView, D } from './views.js'
import { playerView } from './player.js'

const app = document.getElementById('app')
const filters = { theme: null, status: null, batch: null, way: null, tag: null, set(change) { Object.assign(filters, change); route() } }
let loadedAt = 0

async function load() {
  const response = await fetch('./api/state', { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data.pack) throw new Error(data.error ?? `HTTP ${response.status}`)
  index(data)
  loadedAt = Date.now()
  const heroes = data.pack.characters.filter((c) => c.role === 'hero').length
  document.getElementById('pack').textContent = data.pack.ranker
    ? `Ranker r${data.pack.ranker.boardRevision} · ${heroes} Umas · ${data.pack.characters.length - heroes} bosses`
    : `Pack ${data.pack.id} · ${data.pack.characters.length} characters`
}

async function saveReview(input) {
  const response = await fetch('./api/reviews', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  D.data.reviews = data
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  const [head, a, b] = parts
  // A tag (#/t/<set>/<id>) or a Way (#/w/<way>) opens the Stories page filtered to it; the URL goes back to the
  // Stories page so the filter chips can clear it.
  if ((head === 't' && a && b) || (head === 'w' && a)) {
    Object.assign(filters, head === 't' ? { tag: { set: a, id: b }, way: null } : { way: a, tag: null }, { theme: null, status: null, batch: null })
    history.replaceState(null, '', '#/')
    return route()
  }
  const nav = { '': 'stories', s: 'stories', c: 'cast', cast: 'cast', crossings: 'rel', counts: 'counts', world: 'world', format: 'format', play: 'stories', tags: 'tags', rel: 'rel' }[head] ?? 'stories'
  for (const link of document.querySelectorAll('[data-nav]')) link.classList.toggle('on', link.dataset.nav === nav)
  let view
  try {
    if (head === 's' && a) view = storyView(a, b || 'overview', saveReview)
    else if (head === 'c' && a) view = characterView(a)
    else if (head === 'cast') view = castView()
    else if (head === 'tags') view = tagsView()
    else if (head === 'rel') view = relationshipsView(a || null)
    else if (head === 'crossings') view = relationshipsView(null)
    else if (head === 'counts') view = countsView()
    else if (head === 'world') view = worldView(a || null)
    else if (head === 'format') view = formatView()
    else if (head === 'play' && a && b) view = playerView(a, b)
    else view = storiesView(filters)
  } catch (error) {
    console.error(error)
    view = h('div', { class: 'error-box', text: `This view failed: ${error.message}` })
  }
  app.replaceChildren(view)
  if (head !== 'play') window.scrollTo({ top: 0 })
}

window.addEventListener('hashchange', route)
// Edit a bundle, come back to the page: it reloads what's on disk (unless a scene is playing).
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || Date.now() - loadedAt < 1500 || location.hash.startsWith('#/play/')) return
  try { await load(); route() } catch { /* keep what we have */ }
})
load().then(route).catch((error) => { app.replaceChildren(h('div', { class: 'error-box' }, h('b', { text: 'The sandbox could not load its content. ' }), error.message)) })
