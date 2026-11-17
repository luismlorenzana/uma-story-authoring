// The Cyberpunk Story Sandbox's entry: loads the story from the local server and routes between views.
import { playerView } from '/player.js'
import { sheetView, spritesView } from '/sprites.js'
import { biblesView, callsView, castView, chaptersView, chapterView, checksView, D, foesView, formatView, h, index, logView, notesView, profilesView, tiesView, storyView, worldsView, worldView } from '/views.js'

const app = document.getElementById('app')
let loadedAt = 0

async function load() {
  const response = await fetch('/api/state', { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok || !data.pack) throw new Error(data.error ?? `HTTP ${response.status}`)
  index(data)
  loadedAt = Date.now()
  const errors = data.findings.filter((f) => f.level === 'error').length
  document.getElementById('pack').textContent = `${data.standIn ? 'The stand-in story' : `${data.paths.length} files`} · ${errors ? `${errors} error${errors === 1 ? '' : 's'}` : 'no errors'} · ${data.cast ? `cast pack ${data.cast.id}` : 'no cast pack'}`
}

async function saveReview(input) {
  const response = await fetch('/api/reviews', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`)
  D.data.reviews = data
}

function route() {
  const [head, a, b] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
  const nav = { '': 'story', worlds: 'worlds', w: 'worlds', chapters: 'chapters', ch: 'chapters', play: 'chapters', cast: 'cast', log: 'log', calls: 'calls', checks: 'checks', format: 'format', notes: 'notes', sprites: 'sprites', bibles: 'bibles', foes: 'foes', profiles: 'profiles', profile: 'profiles', ties: 'ties' }[head] ?? 'story'
  for (const link of document.querySelectorAll('[data-nav]')) link.classList.toggle('on', link.dataset.nav === nav)
  let view
  try {
    if (head === 'w' && a) view = worldView(a, saveReview)
    else if (head === 'worlds') view = worldsView()
    else if (head === 'ch' && a) view = chapterView(a, saveReview)
    else if (head === 'chapters') view = chaptersView()
    else if (head === 'play' && a && b) view = playerView(a, b, saveReview)
    else if (head === 'cast') view = castView(saveReview)
    else if (head === 'log') view = logView(saveReview)
    else if (head === 'calls') view = callsView(saveReview)
    else if (head === 'checks') view = checksView()
    else if (head === 'format') view = formatView()
    else if (head === 'notes') view = notesView(saveReview)
    else if (head === 'bibles') view = biblesView(a, saveReview)
    else if (head === 'foes') view = foesView(a, b, saveReview)
    else if (head === 'profiles') view = profilesView(null)
    else if (head === 'profile' && a) view = profilesView(a)
    else if (head === 'ties') view = tiesView(saveReview)
    else if (head === 'sprites' && a && b) view = sheetView(a, b)
    else if (head === 'sprites') view = spritesView()
    else view = storyView()
  } catch (error) {
    console.error(error)
    view = h('div', { class: 'error-box', text: `This view failed: ${error.message}` })
  }
  app.replaceChildren(view)
  if (head !== 'play') window.scrollTo({ top: 0 })
}

window.addEventListener('hashchange', route)
// Edit a file, come back to the page: it reloads what's on disk (unless a scene is playing).
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || Date.now() - loadedAt < 1500 || location.hash.startsWith('#/play/') || location.hash.startsWith('#/sprites/')) return
  try { await load(); route() } catch { /* keep what we have */ }
})
load().then(route).catch((error) => { app.replaceChildren(h('div', { class: 'error-box' }, h('b', { text: 'The sandbox could not load the story. ' }), error.message)) })
