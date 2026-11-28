#!/usr/bin/env node
// The Quest book of the Story Sandbox: a local-only library for reading, playing, reviewing and checking story
// bundles (uma-quest's docs/design/story-sandbox.md). It reads content/quest/stories/ on every request (edit a file,
// reload the page), the bibles and roadmap beside it, and the story as the game reads it from the local uma-quest
// checkout (lib/game.mjs). It serves only the images the pack lists. Nothing here holds a name or a line of story.
import { readdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { castCounts, crossCheck, parseBundle, parsePack, parseRelationships, parseSetting, parseTags, parseWorld, STEPS, toWrite, wordCount, GAME_LINE_LIMIT, TOWN_LIMIT } from './lib/model.mjs'

import { questGame } from './lib/game.mjs'
import { authoringContent, gameRoot } from '../workspace.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const content = resolve(process.env.UMA_QUEST_CONTENT ?? authoringContent('quest'))
const stories = join(content, 'stories')
const repo = gameRoot('quest')
const TEXT_MAX = 512 * 1024

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
const pages = {
  '/': 'public/index.html', '/app.js': 'public/app.js', '/app.css': 'public/app.css', '/views.js': 'public/views.js', '/player.js': 'public/player.js',
  '/reader.js': 'public/reader.js', '/reader.css': 'public/reader.css', '/library.js': 'lib/library.mjs',
}

async function inside(root, path) {
  const [base, file] = await Promise.all([realpath(root), realpath(resolve(root, path))])
  if (!file.startsWith(base + sep)) throw Object.assign(new Error('Outside the content folder'), { status: 403 })
  return file
}
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const maybeJson = async (path, fallback) => { try { return await readJson(path) } catch (e) { if (e.code === 'ENOENT') return fallback; throw e } }
const maybeText = async (path) => { try { const t = await readFile(path, 'utf8'); return t.length > TEXT_MAX ? t.slice(0, TEXT_MAX) : t } catch (e) { if (e.code === 'ENOENT') return null; throw e } }

/** The bibles: every Markdown file in bibles/, by name (world-building and notes that never reach the game). */
async function bibles() {
  const folder = join(stories, 'bibles')
  const names = (await readdir(folder).catch(() => [])).filter((n) => /^[A-Za-z0-9._-]+\.md$/.test(n)).sort()
  return Promise.all(names.map(async (n) => ({ name: n.replace(/\.md$/, ''), text: await maybeText(join(folder, n)) ?? '' })))
}

async function currentPack() {
  const folder = join(stories, 'packs')
  const ids = (await readdir(folder).catch(() => [])).filter((n) => /^[a-z0-9-]+$/.test(n))
  const wanted = process.env.UMA_STORY_PACK
  const packs = []
  for (const id of ids) {
    try { packs.push(parsePack(await readJson(join(folder, id, 'pack.json')))) } catch { /* not a pack */ }
  }
  packs.sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)))
  return { pack: (wanted && packs.find((p) => p.id === wanted)) || packs[0] || null, all: packs.map((p) => ({ id: p.id, exportedAt: p.exportedAt, count: p.characters.length })) }
}

async function state() {
  const { pack, all } = await currentPack()
  if (!pack) return { pack: null, packs: all, error: 'No pack yet: build it from the Uma Ranker with `pnpm stories:import-ranker`.' }
  const errors = []
  let setting = null
  try { setting = parseSetting(await readJson(join(stories, 'setting.json'))) } catch (e) { errors.push({ file: 'setting.json', error: e.code === 'ENOENT' ? 'missing' : e.message }) }
  let world = null, worldIssues = []
  try { ({ world, issues: worldIssues } = parseWorld(await readJson(join(stories, 'world.json')), setting)) } catch (e) { if (e.code !== 'ENOENT') errors.push({ file: 'world.json', error: e.message }) }
  // The tags (Q58): read first, since her class gives her Way for the home check; checked against the bundles below.
  let tagsRaw = null
  try { tagsRaw = await maybeJson(join(stories, 'tags.json'), null) } catch (e) { errors.push({ file: 'tags.json', error: e.message }) }
  let tags = null
  try { if (tagsRaw) tags = parseTags(tagsRaw, { pack, setting }).tags } catch (e) { errors.push({ file: 'tags.json', error: e.message }) }
  const bundles = []
  const folder = join(stories, 'bundles')
  for (const name of (await readdir(folder).catch(() => [])).filter((n) => n.endsWith('.json')).sort()) {
    try {
      const { bundle, issues } = parseBundle(await readJson(join(folder, name)), { pack, setting, world, tags })
      bundles.push({ file: `bundles/${name}`, bundle, issues, words: wordCount(bundle), toWrite: toWrite(bundle) })
    } catch (e) { errors.push({ file: `bundles/${name}`, error: e.message }) }
  }
  const reviews = await maybeJson(join(stories, 'reviews.json'), { schemaVersion: 1, items: {} })
  // The eras, circles and relationships (Q59), checked against the cast and the written crossings.
  let relationships = null, relationshipIssues = []
  try {
    const raw = await maybeJson(join(stories, 'relationships.json'), null)
    if (raw) ({ relationships, issues: relationshipIssues } = parseRelationships(raw, { pack, bundles: bundles.map((b) => b.bundle) }))
  } catch (e) { errors.push({ file: 'relationships.json', error: e.message }) }
  const characters = pack.characters.map((c) => ({ ...c, images: Object.fromEntries(Object.entries(c.images).map(([k, p]) => [k, `./img/${pack.id}/${p.slice(7)}`])) }))
  // The library's extra reading (the Quest book's structure, after the Cyberpunk and Farm books): the bibles, the story
  // roadmap, and the story as the game reads it.
  const [bibleFiles, roadmap, game] = await Promise.all([bibles(), maybeText(join(stories, 'roadmap.md')), questGame(repo, { bundles: bundles.map((b) => b.bundle), pack })])
  return {
    bibles: bibleFiles, roadmap, game,
    pack: { ...pack, characters }, packs: all, setting, world, worldIssues, bundles, errors, reviews,
    relationships, relationshipIssues,
    // The counts (Q60) and the private read of what looks unbalanced, with a recommendation each.
    counts: castCounts({ pack, tags, relationships }), countsNotes: await maybeJson(join(stories, 'counts-notes.json'), null),
    tags, tagIssues: tags ? parseTags(tags, { pack, setting, bundles: bundles.map((b) => b.bundle) }).issues : [],
    cross: crossCheck(pack, bundles.map((b) => b.bundle), setting),
    steps: STEPS, lineLimit: GAME_LINE_LIMIT, townLimit: TOWN_LIMIT,
  }
}

async function body(request) {
  const chunks = []; let size = 0
  for await (const chunk of request) { size += chunk.length; if (size > 64 * 1024) throw Object.assign(new Error('Too large'), { status: 413 }); chunks.push(chunk) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

let reviewWrite = Promise.resolve()
async function saveReview(input) {
  const ok = input && typeof input.hero === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(input.hero) &&
    (input.status === null || ['liked', 'rework', 'question'].includes(input.status)) && typeof input.note === 'string' && input.note.length <= 4000
  if (!ok) throw Object.assign(new Error('Invalid review'), { status: 400 })
  const work = reviewWrite.then(async () => {
    const path = join(stories, 'reviews.json')
    const current = await maybeJson(path, { schemaVersion: 1, items: {} })
    current.items[input.hero] = { status: input.status, note: input.note, updatedAt: new Date().toISOString() }
    await writeFile(path + '.part', JSON.stringify(current, null, 2) + '\n')
    await rename(path + '.part', path)
    return current
  })
  reviewWrite = work.catch(() => undefined)
  return work
}

function send(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(data))
}

export function handle(request, response, pathname) {
  (async () => {
    const host = request.headers.host
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    if (request.method === 'PUT' && pathname === '/api/reviews') {
      const sameOrigin = (!request.headers.origin || request.headers.origin === `http://${host}`) && request.headers['sec-fetch-site'] !== 'cross-site'
      if (!sameOrigin || request.headers['content-type']?.split(';')[0] !== 'application/json') return send(response, 403, { error: 'Save from the local page' })
      return send(response, 200, await saveReview(await body(request)))
    }
    if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed' })
    if (pathname === '/api/state') return send(response, 200, await state())
    const img = pathname.match(/^\/img\/([a-z0-9-]+)\/([A-Za-z0-9._-]+\.(?:png|webp|jpg))$/)
    if (img) {
      const pack = parsePack(await readJson(join(stories, 'packs', img[1], 'pack.json')))
      const listed = new Set(pack.characters.flatMap((c) => Object.values(c.images)))
      if (!listed.has(`images/${img[2]}`)) return send(response, 404, { error: 'Not a pack image' })
      const file = await inside(join(stories, 'packs', img[1], 'images'), img[2])
      response.writeHead(200, { 'content-type': types[extname(file)], 'cache-control': 'max-age=86400' })
      return response.end(await readFile(file))
    }
    const page = pages[pathname]
    if (!page) return send(response, 404, { error: 'Not found' })
    response.writeHead(200, { 'content-type': types[extname(page)], 'cache-control': 'no-cache' })
    response.end(await readFile(join(here, page)))
  })().catch((error) => {
    if (response.headersSent) return response.end()
    send(response, error.status ?? (error.code === 'ENOENT' ? 404 : 500), { error: error.message })
  })
}
