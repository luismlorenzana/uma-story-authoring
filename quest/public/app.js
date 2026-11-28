// The Quest book's entry: loads the private state from the local server and routes between the library's views.
import { castView, characterView, countsView, formatView, h, index, relationshipsView, storiesView, storyView, tagsView, worldView, D } from './views.js'
import { playerView } from './player.js'
import { biblesView, characterNav, deskView, gameView, libraryView, overviewView, prepareReader, readView, searchView, worldNav } from './reader.js'

const app = document.getElementById('app')
const filters = { theme: null, status: null, batch: null, way: null, tag: null, set(change) { Object.assign(filters, change); route() } }
const shelf = { tier: null, all: false, set(change) { Object.assign(shelf, change); route() } }
let loadedAt = 0

async function load() {
  const response = await fetch('./api/state', { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data.pack) throw new Error(data.error ?? `HTTP ${response.status}`)
  index(data)
  prepareReader()
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

// Which top section a route belongs to (the nav's highlight). Old links keep working: #/s, #/c, #/t, #/w, #/play.
const SECTION = {
  '': 'overview', stories: 'stories', s: 'stories', t: 'stories', w: 'stories', play: 'library', library: 'library', read: 'library',
  cast: 'characters', c: 'characters', tags: 'characters', counts: 'characters', rel: 'rel', crossings: 'rel',
  world: 'world', bibles: 'world', game: 'game', review: 'review', search: 'search', format: 'format',
}

function route() {
  const [path] = location.hash.replace(/^#\/?/, '').split('#')
  const [head = '', a, b] = path.split('/').map(decodeURIComponent)
  // A tag (#/t/<set>/<id>) or a Way (#/w/<way>) opens the Stories page filtered to it; the URL goes back to the
  // Stories page so the filter chips can clear it.
  if ((head === 't' && a && b) || (head === 'w' && a)) {
    Object.assign(filters, head === 't' ? { tag: { set: a, id: b }, way: null } : { way: a, tag: null }, { theme: null, status: null, batch: null })
    history.replaceState(null, '', '#/stories')
    return route()
  }
  const section = SECTION[head] ?? 'overview'
  for (const link of document.querySelectorAll('[data-nav]')) {
    const on = link.dataset.nav === section
    link.classList.toggle('on', on)
    if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current')
  }
  let view
  try {
    if (head === 's' && a) view = storyView(a, b || 'overview', saveReview)
    else if (head === 'stories') view = storiesView(filters)
    else if (head === 'c' && a) view = characterView(a)
    else if (head === 'cast') view = h('div', {}, characterNav('cast'), castView())
    else if (head === 'tags') view = h('div', {}, characterNav('tags'), tagsView())
    else if (head === 'counts') view = h('div', {}, characterNav('counts'), countsView())
    else if (head === 'rel') view = relationshipsView(a || null)
    else if (head === 'crossings') view = relationshipsView(null)
    else if (head === 'world') view = h('div', {}, worldNav('world'), worldView(a || null))
    else if (head === 'bibles') view = biblesView(a || null)
    else if (head === 'library') view = libraryView(shelf)
    else if (head === 'read' && a) view = readView(a, b || '1', saveReview)
    else if (head === 'game') view = gameView()
    else if (head === 'review') view = deskView(a || 'all', saveReview)
    else if (head === 'search') view = searchView(a ?? '', b || 'all')
    else if (head === 'format') view = formatView()
    else if (head === 'play' && a && b) view = playerView(a, b)
    else view = overviewView()
  } catch (error) {
    console.error(error)
    view = h('div', { class: 'error-box' }, h('b', { text: 'This view could not open. ' }), error.message, ' ', h('a', { href: '#/library', text: 'Open the script library' }))
  }
  app.replaceChildren(view)
  // A scene anchor (#/read/<hero>/<n>#<scene>) scrolls to its scene; anything else opens at the top.
  const anchor = location.hash.replace(/^#\/?/, '').split('#')[1]
  if (anchor) requestAnimationFrame(() => document.getElementById(decodeURIComponent(anchor))?.scrollIntoView())
  else if (head !== 'play') window.scrollTo({ top: 0 })
}

document.getElementById('global-search').addEventListener('submit', (e) => {
  e.preventDefault()
  const q = document.getElementById('story-search').value.trim()
  if (q) location.hash = `#/search/${encodeURIComponent(q)}`
})
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); document.getElementById('story-search').focus() }
})
window.addEventListener('hashchange', route)
// Edit a bundle, come back to the page: it reloads what's on disk (unless a scene is playing or a note is open).
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || Date.now() - loadedAt < 1500 || location.hash.startsWith('#/play/') || app.querySelector('textarea:focus, .desk-edit')) return
  try { await load(); route() } catch { /* keep what we have */ }
})
load().then(route).catch((error) => { app.replaceChildren(h('div', { class: 'error-box' }, h('b', { text: 'The sandbox could not load its content. ' }), error.message)) })
