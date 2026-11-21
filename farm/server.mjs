#!/usr/bin/env node
// The Farm Story Sandbox: a local-only page for reading, playing and checking uma-farm's story
// (tools/story-sandbox/README.md). It binds to loopback and reads, on every request:
// - the private authored story in content/story/ (the world bible and world.json, the cast, the ties, the bibles,
//   routes and pairs),
//   read by the game's own reader (`story/pack.ts`'s `readStoryPack`): errors skip only their part and notes block
//   nothing, as in the game and the release; with the Umas' faces from the cast pack;
// - the chapter drafts in docs/story/ (original, in git) and the game's story in @farm/domain.
// Its only write is the owner's reviews, to the private content/story/reviews.json.
import { readdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadGame } from './lib/game.mjs'
import {
  BEAT_HEARTS, BOND_HEARTS, BUBBLE_LINE_LIMIT, CONVERSATION_TARGET, DISTANCES, LAYERS, SAMPLE_CREW, SCENE_LINE_LIMIT, SPEAKERS,
  crossCheck, parseBeats, parseChapter, parseConversations,
} from './lib/model.mjs'
import { packPeople, packUmas, parseCastPack } from './lib/pack.mjs'
import { storyCounts } from './lib/counts.mjs'

import { authoringContent, gameRoot } from '../workspace.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = gameRoot('farm')
const drafts = resolve(process.env.UMA_FARM_STORY ?? join(repo, 'docs/story'))
/** The private side (ignored by git): the authored story, the cast pack and the reviews. */
const content = resolve(process.env.UMA_FARM_CONTENT ?? authoringContent('farm', 'story'))
const domain = join(repo, 'packages/domain/src')

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
}
/** The page's files; the model is the tested one, shared with the server. */
const pages = {
  '/': 'public/index.html', '/app.js': 'public/app.js', '/app.css': 'public/app.css', '/views.js': 'public/views.js', '/player.js': 'public/player.js',
  '/duos.js': 'public/duos.js', '/bonds.js': 'public/bonds.js', '/people.js': 'public/people.js', '/model.js': 'lib/model.mjs',
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const maybeJson = async (path, fallback) => { try { return await readJson(path) } catch (e) { if (e.code === 'ENOENT') return fallback; throw e } }
const maybeText = async (path) => { try { return await readFile(path, 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e } }

async function inside(root, path) {
  const [base, file] = await Promise.all([realpath(root), realpath(resolve(root, path))])
  if (!file.startsWith(base + sep)) throw Object.assign(new Error('Outside the content folder'), { status: 403 })
  return file
}

/** The newest cast pack copied here, or null. */
async function currentPack() {
  const packs = []
  for (const id of (await readdir(join(content, 'pack')).catch(() => [])).filter((n) => /^[a-z0-9-]+$/.test(n))) {
    try { packs.push(parseCastPack(await readJson(join(content, 'pack', id, 'pack.json')))) } catch { /* not a pack */ }
  }
  return packs.sort((a, b) => String(b.exportedAt).localeCompare(String(a.exportedAt)))[0] ?? null
}


/** The authored story as the game reads it: the pack's files through the game's own reader (`readStoryPack`), each with
 * its errors (what the game can't read, skipped) and its notes (everything else; they block nothing). The world bible and
 * the tag sheet are the story's own: the tag sheet's checks are notes. A file that isn't JSON is skipped with an error. */
async function storyState(game) {
  const pack = await currentPack()
  const umas = pack ? packUmas(pack) : []
  const v = game.ok ? game.validator : null
  const unreadable = []
  const json = async (name) => {
    try { return await maybeJson(join(content, name), undefined) } catch (e) { unreadable.push(`${name}: not JSON (${e.message}); skipped`); return undefined }
  }
  const folder = async (dir) => {
    const out = {}
    for (const name of (await readdir(join(content, dir)).catch(() => [])).filter((n) => n.endsWith('.json')).sort()) {
      const value = await json(`${dir}/${name}`)
      if (value !== undefined) out[name.slice(0, -'.json'.length)] = value
    }
    return out
  }
  const files = { cast: await json('cast.json'), ties: await json('ties.json'), umas: await folder('umas'), routes: await folder('routes'), pairs: await folder('pairs') }
  const household = await json('household.json')
  if (household !== undefined) files.household = household
  const opening = await json('opening.json')
  if (opening !== undefined) files.opening = opening
  const town = await json('town.json')
  if (town !== undefined) files.town = town
  const world = await json('world.json')
  if (world !== undefined) files.world = world
  const tagSheet = await json('tags.json')
  const story = {
    pack: pack ? { id: pack.id, exportedAt: pack.exportedAt } : null,
    umas,
    // Every character of the cast pack, any board's: the town's people's names and faces.
    people: pack ? packPeople(pack) : [],
    world: await maybeText(join(content, 'world.md')),
    hasCast: files.cast !== undefined,
  }
  if (!v) return { ...story, error: 'The game’s reader didn’t load', check: { errors: unreadable, notes: [] } }

  const read = v.readStoryPack(files, undefined, umas.length > 0 ? new Set(umas.map((u) => u.id)) : undefined)
  // Every finding by its file: `umas/<id>.json: …` → `umas/<id>.json`.
  const byFile = new Map()
  const add = (kind) => (line) => {
    const at = line.indexOf(': ')
    const file = line.slice(0, at)
    const entry = byFile.get(file) ?? { errors: [], notes: [] }
    entry[kind].push(line.slice(at + 2))
    byFile.set(file, entry)
  }
  // The marker's notes (a piece marked "draft": "default" whose words changed), beside the reader's.
  const marked = read.files.cast.umas.flatMap((u) => v.draftNotes(read.files, u.characterId))
  ;[...unreadable, ...read.errors].forEach(add('errors'))
  ;[...read.notes, ...marked].forEach(add('notes'))
  const found = (name) => byFile.get(name) ?? { errors: [], notes: [] }
  const entry = (name, data) => ({ file: `content/story/${name}`, data, ...found(name) })
  const ctx = { umas: new Set(read.files.cast.umas.map((u) => u.characterId)) }

  // The tag sheet, and each bible against her tags when she has both: notes only.
  const tagOf = (id) => tagSheet?.tags?.find?.((t) => t?.characterId === id) ?? null
  const tags = tagSheet === undefined ? null : { file: 'content/story/tags.json', data: tagSheet, errors: found('tags.json').errors, notes: v.tagNotes(tagSheet, ctx) }
  const bibles = Object.entries(read.files.umas).map(([id, bible]) => {
    const e = entry(`umas/${id}.json`, bible)
    return tagOf(id) ? { ...e, notes: [...e.notes, ...v.bibleTagNotes(bible, tagOf(id))] } : e
  })
  const routes = Object.entries(read.files.routes).map(([id, route]) => ({ ...entry(`routes/${id}.json`, route), unscripted: v.unscriptedBeats(route, read.files.umas[id] ?? null) }))
  const pairs = Object.entries(read.files.pairs).map(([name, pair]) => entry(`pairs/${name}.json`, pair))
  // Each character's findings, from every file of hers and the cast's lines that name her.
  const own = {}
  // Each character as the game plays her: every part the pack writes, and every part a placeholder plays instead.
  const written = {}
  // Each character's story, piece by piece: hers, the default (marked) or missing, by part, and what's left.
  const status = {}
  for (const { characterId: id } of read.files.cast.umas) {
    const cast = found('cast.json')
    const hers = (list) => list.filter((line) => line.includes(`(${id})`) || line.startsWith(`${id} `) || line.startsWith(`${id}:`))
    own[id] = {
      errors: [...hers(cast.errors), ...found(`umas/${id}.json`).errors, ...found(`routes/${id}.json`).errors],
      notes: [...hers(cast.notes), ...found(`umas/${id}.json`).notes, ...found(`routes/${id}.json`).notes],
    }
    written[id] = v.writtenOf(read.pack, id)
    const st = v.umaStatus(read.files, id)
    status[id] = { parts: st.parts, complete: st.complete, allHers: st.pieces.every((p) => p.state === 'hers'), left: v.leftWords(st), pieces: st.pieces }
  }
  const all = { errors: [...unreadable, ...read.errors], notes: [...read.notes, ...marked, ...(tags?.notes ?? []).map((n) => `tags.json: ${n}`)] }
  return {
    ...story,
    cast: entry('cast.json', read.files.cast),
    ties: entry('ties.json', read.files.ties),
    tags,
    bibles,
    routes,
    pairs,
    duoVisits: v.visitBeats ? (read.pack.household?.duos ?? []).flatMap(([a, b]) => [[a, b], [b, a]].map(who => {
      const visit = { day: 1, kind: 'pajamas', who, looks: [1, 1] }
      return { who, beats: [...v.visitBeats(read.pack, visit), ...v.visitBeats(read.pack, visit, true)] }
    })) : null,
    // The household's scenes, house lines and finale.
    household: read.files.household ? entry('household.json', read.files.household) : null,
    // The opening's lines, as the game plays them on day 1.
    opening: read.files.opening ? entry('opening.json', read.files.opening) : null,
    // The town: the pack's town.json, and the town as the game plays it (its roles, its people and its six spots; with
    // no master data here, a role town.json leaves is master data's in the game).
    town: read.files.town ? entry('town.json', read.files.town) : null,
    townPlayed: (({ people, spots }) => ({ people, spots }))(v.townOf(read.pack)),
    // The world: the pack's world.json, and the world as the game plays it (its names, history, the year's festivals,
    // every place's name and line, the seasons' lines and the Town notes, each the pack's or the game's own).
    worldFile: read.files.world ? entry('world.json', read.files.world) : null,
    worldPlayed: worldPlayed(v, read.pack, game),
    own,
    written,
    status,
    // Every finding, and the files read whole that the game skipped (a file that isn't JSON or isn't the shape).
    check: all,
    // The menu's defaults, and the welcome list as the game reads it.
    welcome: read.files.cast.welcome?.length ? read.files.cast.welcome : read.files.cast.umas.slice(0, game.authored?.defaults?.welcome ?? 5).map((u) => u.characterId),
    // The counts, each with the Umas behind it.
    counts: storyCounts({
      cast: read.files.cast, tags: tagSheet, ties: read.files.ties, bibles: Object.values(read.files.umas), routes: Object.entries(read.files.routes).map(([id, r]) => ({ ...r, characterId: id })),
      pairs: Object.values(read.files.pairs), rungs: game.authored?.rungs ?? [],
    }),
  }
}


/** The world as the game will use it: each part written by world.json or the game's own words, every place and season
 * listed, and the year's festivals in order with the rule each keeps. */
function worldPlayed(v, pack, game) {
  const places = (game.places ?? []).map((p) => {
    const words = v.placeWordsOf(pack, p.id)
    const own = pack.world?.places?.[p.id] ?? {}
    return { id: p.id, ...words, written: { name: own.name !== undefined || (p.id === 'town' && pack.world?.names?.town !== undefined), line: own.line !== undefined } }
  })
  const seasons = ['spring', 'summer', 'autumn', 'winter'].map((season) => ({ season, line: v.seasonLineOf(pack, season) }))
  return {
    parts: v.worldWrittenOf(pack), names: v.worldNamesOf(pack), history: v.historyOf(pack), festivals: v.festivalsOf(pack), days: v.storyDaysOf(pack), places, seasons,
    notes: v.townNotesOf(pack),
  }
}

async function state() {
  const { validator, ...game } = await loadGame(domain)
  const errors = []
  const chapters = []
  for (const name of (await readdir(join(drafts, 'chapters')).catch(() => [])).filter((n) => n.endsWith('.json')).sort()) {
    try { chapters.push({ file: `docs/story/chapters/${name}`, ...parseChapter(await readJson(join(drafts, 'chapters', name)), game) }) } catch (e) { errors.push({ file: `docs/story/chapters/${name}`, error: e.message }) }
  }
  chapters.sort((a, b) => a.chapter.chapter - b.chapter.chapter)
  let beats = []
  try { beats = parseBeats(await maybeJson(join(drafts, 'beats.json'), { schemaVersion: 1, kind: 'farm-story-beats', beats: [] }), game) } catch (e) { errors.push({ file: 'docs/story/beats.json', error: e.message }) }
  let conversations = []
  try { conversations = parseConversations(await maybeJson(join(drafts, 'conversations.json'), { schemaVersion: 1, kind: 'farm-conversations', templates: [] }), game) } catch (e) { errors.push({ file: 'docs/story/conversations.json', error: e.message }) }
  const story = await storyState({ ...game, validator })
  const reviews = await maybeJson(join(content, 'reviews.json'), { schemaVersion: 1, items: {} })
  return {
    game, story, chapters, beats, conversations, errors, reviews,
    cross: crossCheck(chapters.map((c) => c.chapter), beats.map((b) => b.beat), conversations.map((c) => c.template), game),
    speakers: SPEAKERS, layers: LAYERS, crew: SAMPLE_CREW, distances: DISTANCES, beatHearts: BEAT_HEARTS, bondHearts: BOND_HEARTS,
    target: CONVERSATION_TARGET, limits: { scene: SCENE_LINE_LIMIT, bubble: BUBBLE_LINE_LIMIT },
  }
}

async function body(request) {
  const chunks = []; let size = 0
  for await (const chunk of request) { size += chunk.length; if (size > 64 * 1024) throw Object.assign(new Error('Too large'), { status: 413 }); chunks.push(chunk) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

let reviewWrite = Promise.resolve()
/** The owner's verdict on a file or an event (liked, rework, question, and a note), to the private reviews.json. */
async function saveReview(input) {
  const ok = input && typeof input.item === 'string' && /^[A-Za-z0-9._:/-]{1,120}$/.test(input.item) &&
    (input.status === null || ['liked', 'rework', 'question'].includes(input.status)) && typeof input.note === 'string' && input.note.length <= 4000
  if (!ok) throw Object.assign(new Error('Invalid review'), { status: 400 })
  const work = reviewWrite.then(async () => {
    const path = join(content, 'reviews.json')
    const current = await maybeJson(path, { schemaVersion: 1, items: {} })
    if (input.status === null && !input.note.trim()) delete current.items[input.item]
    else current.items[input.item] = { status: input.status, note: input.note, updatedAt: new Date().toISOString() }
    current.items = Object.fromEntries(Object.entries(current.items).sort(([a], [b]) => a.localeCompare(b)))
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
    // An Uma's picture, only when the pack lists it.
    const img = pathname.match(/^\/img\/([a-z0-9-]+)\/([A-Za-z0-9._-]+\.(?:png|webp|jpg))$/)
    if (img) {
      const pack = parseCastPack(await readJson(join(content, 'pack', img[1], 'pack.json')))
      if (!pack.characters.some((c) => Object.values(c.images ?? {}).includes(`images/${img[2]}`))) return send(response, 404, { error: 'Not a pack image' })
      const file = await inside(join(content, 'pack', img[1], 'images'), img[2])
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
