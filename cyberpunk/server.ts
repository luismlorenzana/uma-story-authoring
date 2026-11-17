// The Cyberpunk Story Sandbox: a local-only page for reading, playing and reviewing uma-cyberpunk's story, the sibling
// of uma-quest's and uma-farm's Story Sandboxes. It binds to loopback and reads, on every request:
// - the story session's private files in content/stories/ (the story brief's SB8 layout), parsed and checked by the
//   game's own code in packages/domain/src/story/, so the sandbox and the game always agree on the format;
// - the game's invented stand-in story, while content/stories/ holds no story yet;
// - the private cast pack (content/stories/cast-pack/, built by import-cast.mjs), for names and faces by id.
// - the combat sprite sheets ChatGPT saves (D24) in content/design/character-looks/combat-masters/<outfitId>/, and each
//   Uma's approved chibi stills from uma-platform's private authoring folder, for the Sprites page's reviews.
// Its only write is the owner's verdicts, to the private content/stories/reviews.json. No name or line is in git.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, readdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FOE_ORDER, packImages, parseCastPack, parseFoeFile, parseReviews, parseTies, parseVerdict, withVerdict } from './lib/model.mjs'
import { latestSheets, parseSheetName, REQUESTED } from './lib/sprites.mjs'

import { gameRoot } from '../workspace.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = gameRoot('cyberpunk')
const storyModule = pathToFileURL(join(repo, 'packages/domain/src/story/index.ts')).href
const storyFilesModule = pathToFileURL(join(repo, 'scripts/story/files.ts')).href
const {
  checksReport, LAYERS, layersOf, LINE_MAX, MISSION_OBJECTIVES, parseCall, parseCasting, parseChapter, parseLogFile, parsePack, parseWorld,
  sceneSeconds, STAND_IN_FILES, STEP_KINDS, StoryParseError,
} = await import(storyModule)
const { readStoryFiles } = await import(storyFilesModule)
type Finding = ReturnType<typeof checksReport>['findings'][number]
type StoryPack = ReturnType<typeof parsePack>

/** The private side (ignored by git): the story, the cast pack and the verdicts. */
const content = resolve(process.env.UMA_CYBER_STORIES ?? join(repo, 'content/stories'))
/** The combat sprite sheets (D24) and uma-platform's authored chibi sets, both private. */
const masters = resolve(process.env.UMA_CYBER_SPRITES ?? join(repo, 'content/design/character-looks/combat-masters'))
const platformSprites = resolve(process.env.UMA_PLATFORM_SPRITES ?? join(repo, '../uma-platform/content/authoring/sprites'))
const port = Number(process.env.UMA_CYBER_STORY_PORT ?? 4322)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port')

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
}
/** The page's files; the model is the tested one, shared with the server. */
const pages: Record<string, string> = {
  '/': 'public/index.html', '/app.js': 'public/app.js', '/app.css': 'public/app.css', '/views.js': 'public/views.js', '/player.js': 'public/player.js',
  '/model.js': 'lib/model.mjs', '/sprites.js': 'public/sprites.js', '/sprites-model.js': 'lib/sprites.mjs',
}

const code = (e: unknown) => (e as NodeJS.ErrnoException).code
const maybeText = async (path: string): Promise<string | null> => { try { return await readFile(path, 'utf8') } catch (e) { if (code(e) === 'ENOENT') return null; throw e } }
const maybeJson = async (path: string): Promise<unknown> => { const text = await maybeText(path); return text === null ? null : JSON.parse(text) }

async function inside(root: string, path: string): Promise<string> {
  const [base, file] = await Promise.all([realpath(root), realpath(resolve(root, path))])
  if (!file.startsWith(base + sep)) throw Object.assign(new Error('Outside the content folder'), { status: 403 })
  return file
}

/** Every file that parses on its own, so one broken chapter doesn't blank the rest while it's being written. */
function bestEffort(files: Record<string, unknown>): StoryPack {
  const pack: StoryPack = { casting: { schemaVersion: 1, leads: [], crewOrder: [], heroines: [], minor: [] }, worlds: {}, chapters: {}, files: {}, calls: {}, bonds: {}, events: {} }
  for (const [path, value] of Object.entries(files)) {
    try {
      if (path === 'casting.json') pack.casting = parseCasting(value, path)
      else if (path.startsWith('worlds/')) { const w = parseWorld(value, path); pack.worlds[w.id] = w }
      else if (path.startsWith('chapters/')) { const c = parseChapter(value, path); pack.chapters[c.id] = c }
      else if (path.startsWith('log/')) { const f = parseLogFile(value, path); pack.files[f.id] = f }
      else if (path.startsWith('calls/')) { const c = parseCall(value, path); pack.calls[c.id] = c }
    } catch (e) { if (!(e instanceof StoryParseError)) throw e }
  }
  return pack
}

/** The cast pack, with each picture as the server serves it; null before `pnpm stories:import-cast` has run. */
async function castPack() {
  const raw = await maybeJson(join(content, 'cast-pack/pack.json'))
  if (raw === null) return { pack: null, problem: null }
  try {
    const pack = parseCastPack(raw)
    const served = (c: { images?: Record<string, string> }) => ({ ...c, images: Object.fromEntries(Object.entries(c.images ?? {}).map(([k, p]) => [k, `/img/${p.slice(7)}`])) })
    return { pack: { ...pack, umas: pack.umas.map(served), heroines: pack.heroines.map(served) }, problem: null }
  } catch (e) { return { pack: null, problem: e instanceof Error ? e.message : String(e) } }
}

/** The story's bibles (`content/stories/bibles/*.md`, private): the casting first, then the worlds in the Circuit's
 * order, then the foes (the Standard, then each faction as the Circuit meets them), then the rest by name. */
const BIBLE_ORDER = ['roadmap', 'casting', 'ring', 'tidewell', 'verdance', 'anvil', 'gale', 'hush', 'hollow-ring', 'brink', 'foes', ...FOE_ORDER.map((f) => `foes-${f}`), 'ties']
async function bibles(): Promise<{ name: string; path: string; text: string }[]> {
  const names = (await readdir(join(content, 'bibles')).catch(() => [] as string[])).filter((n) => /^[a-z0-9][a-z0-9-]{0,60}\.md$/.test(n)).map((n) => n.slice(0, -3))
  const rank = (n: string) => (BIBLE_ORDER.includes(n) ? BIBLE_ORDER.indexOf(n) : BIBLE_ORDER.length)
  names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  return Promise.all(names.map(async (name) => ({ name, path: `bibles/${name}.md`, text: await readFile(join(content, 'bibles', `${name}.md`), 'utf8') })))
}

/** The foe data (`content/stories/foes/*.json`, private): the Standard, and one faction file each, in the Circuit's
 * order. A file that doesn't read is listed as a problem, and the rest still shows. */
async function foes() {
  const dir = join(content, 'foes')
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => /^[a-z0-9][a-z0-9-]{0,60}\.json$/.test(n))
  let standard: unknown = null
  const factions: { id: string; path: string }[] = [], problems: string[] = []
  for (const name of names) {
    try {
      const doc = parseFoeFile(JSON.parse(await readFile(join(dir, name), 'utf8')))
      if (doc.kind === 'foe-standard') standard = doc
      else factions.push({ ...doc, path: `foes/${name}` })
    } catch (e) { problems.push(`foes/${name}: ${e instanceof Error ? e.message : String(e)}`) }
  }
  const rank = (id: string) => (FOE_ORDER.includes(id) ? FOE_ORDER.indexOf(id) : FOE_ORDER.length)
  factions.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  return { standard, factions, problems }
}

/** The Uma-to-boss ties (`content/stories/ties.json`, private), or null; a file that doesn't read is a problem. */
async function ties(): Promise<{ doc: unknown; problem: string | null }> {
  try {
    const raw = await maybeJson(join(content, 'ties.json'))
    return { doc: raw === null ? null : parseTies(raw), problem: null }
  } catch (e) { return { doc: null, problem: `ties.json: ${e instanceof Error ? e.message : String(e)}` } }
}

/** Everything the page draws, read fresh. */
async function state() {
  const read = readStoryFiles(content)
  const standIn = read === null
  const files = read?.files ?? STAND_IN_FILES
  const strict = parsePack(files)
  const parseFindings: Finding[] = [
    ...(read?.problems ?? []).map((p) => ({ level: 'error' as const, file: p.file, where: '', message: p.message })),
    ...strict.errors.map((e) => ({ level: 'error' as const, file: e.file, where: e.path, message: e.message.slice(e.file.length + e.path.length + 4) })),
  ]
  // The findings are exactly `pnpm story:check`'s; the view also shows whatever parses while errors remain.
  const report = checksReport(strict.pack, parseFindings, new Date().toISOString())
  const pack = strict.pack ?? bestEffort(files)
  const seconds: Record<string, number> = {}
  for (const chapter of Object.values(pack.chapters)) {
    for (const scene of chapter.scenes) seconds[scene.id] = sceneSeconds(scene)
    seconds[`${chapter.id}/debrief`] = sceneSeconds({ steps: chapter.debrief.steps })
  }
  const cast = await castPack()
  let reviews = { schemaVersion: 1, items: {} }, reviewsProblem: string | null = null
  try { reviews = parseReviews(await maybeJson(join(content, 'reviews.json'))) } catch (e) { reviewsProblem = e instanceof Error ? e.message : String(e) }
  return {
    dir: content, standIn, clean: strict.pack !== null, paths: Object.keys(files).sort(),
    pack, findings: report.findings, layers: strict.pack ? report.layers : layersOf(pack), counts: report.counts, seconds,
    format: { stepKinds: STEP_KINDS, objectives: MISSION_OBJECTIVES, layers: LAYERS, lineMax: LINE_MAX },
    cast: cast.pack, castProblem: cast.problem,
    notes: await maybeText(join(content, 'world-notes.md')), worldDoc: await maybeText(join(repo, 'docs/design/world.md')),
    bibles: await bibles(),
    foes: await foes(),
    ties: await ties(),
    reviews, reviewsProblem,
  }
}

const list = async (dir: string): Promise<string[]> => { try { return await readdir(dir) } catch (e) { if (code(e) === 'ENOENT') return []; throw e } }

/** Her approved chibi's revision folder in uma-platform's authoring tree, or null. */
async function chibiDir(outfit: number): Promise<string | null> {
  const current = await maybeJson(join(platformSprites, String(outfit), 'current.json')) as { revision?: unknown } | null
  return Number.isSafeInteger(current?.revision) ? join(platformSprites, String(outfit), `r${current!.revision as number}`) : null
}

/** The Sprites page's state: every sheet in the masters folder (latest take of each), and whose chibi stills exist. */
async function sprites() {
  const folders = (await list(masters)).filter((f) => /^\d{5,7}$/.test(f))
  const files: string[] = []
  for (const folder of folders) for (const f of await list(join(masters, folder))) if (parseSheetName(f)?.outfit === Number(folder)) files.push(f)
  const sheets = latestSheets(files)
  const outfits = [...new Set([...REQUESTED, ...sheets.map((s) => s.outfit)])].sort((a, b) => a - b)
  const chibi: Record<string, boolean> = {}
  for (const o of outfits) chibi[o] = (await chibiDir(o)) !== null
  return { dir: masters, outfits, sheets, chibi }
}

async function body(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of request) { size += chunk.length; if (size > 64 * 1024) throw Object.assign(new Error('Too large'), { status: 413 }); chunks.push(chunk as Buffer) }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

let reviewWrite: Promise<unknown> = Promise.resolve()
/** The owner's verdict on an item, to the private reviews.json. One save at a time; a file it can't read is never replaced. */
function saveReview(input: unknown) {
  const verdict = parseVerdict(input)
  const work = reviewWrite.then(async () => {
    if (readStoryFiles(content) === null) throw Object.assign(new Error('This is the game’s stand-in story. Verdicts start with the story’s first file.'), { status: 409 })
    const path = join(content, 'reviews.json')
    const next = withVerdict(parseReviews(await maybeJson(path)), verdict, new Date().toISOString())
    await mkdir(content, { recursive: true })
    await writeFile(`${path}.part`, `${JSON.stringify(next, null, 2)}\n`)
    await rename(`${path}.part`, path)
    return next
  })
  reviewWrite = work.catch(() => undefined)
  return work
}

function send(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(JSON.stringify(data))
}

const server = createServer((request, response) => {
  (async () => {
    const host = request.headers.host
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(response, 403, { error: 'Use the loopback URL' })
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    const url = new URL(request.url ?? '/', `http://${host}`)
    if (request.method === 'PUT' && url.pathname === '/api/reviews') {
      const sameOrigin = (!request.headers.origin || request.headers.origin === `http://${host}`) && request.headers['sec-fetch-site'] !== 'cross-site'
      if (!sameOrigin || request.headers['content-type']?.split(';')[0] !== 'application/json') return send(response, 403, { error: 'Save from the local page' })
      return send(response, 200, await saveReview(await body(request)))
    }
    if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed' })
    if (url.pathname === '/api/state') return send(response, 200, await state())
    if (url.pathname === '/api/sprites') return send(response, 200, await sprites())
    // A combat sheet, only by the request's file name, inside its Uma's folder.
    const sheet = url.pathname.match(/^\/sheet\/(\d{5,7})\/([A-Za-z0-9._-]+\.png)$/)
    if (sheet) {
      if (parseSheetName(sheet[2])?.outfit !== Number(sheet[1])) return send(response, 404, { error: 'Not a sheet' })
      const file = await inside(join(masters, sheet[1]!), sheet[2]!)
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-cache' })
      return response.end(await readFile(file))
    }
    // Her approved chibi's key or turnaround still, from uma-platform's authoring folder.
    const chibi = url.pathname.match(/^\/chibi\/(\d{5,7})\/(key|front|back|left|right)\.png$/)
    if (chibi) {
      const dir = await chibiDir(Number(chibi[1]))
      if (!dir) return send(response, 404, { error: 'No chibi set' })
      const file = await inside(dir, chibi[2] === 'key' ? 'key.png' : `frames/turnaround-${chibi[2]}.png`)
      response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=3600' })
      return response.end(await readFile(file))
    }
    // A picture, only when the cast pack lists it.
    const img = url.pathname.match(/^\/img\/([A-Za-z0-9._-]+\.(?:png|webp|jpg))$/)
    if (img) {
      const pack = parseCastPack(await maybeJson(join(content, 'cast-pack/pack.json')))
      if (!packImages(pack).has(`images/${img[1]}`)) return send(response, 404, { error: 'Not a pack image' })
      const file = await inside(join(content, 'cast-pack/images'), img[1]!)
      response.writeHead(200, { 'content-type': types[extname(file)]!, 'cache-control': 'max-age=86400' })
      return response.end(await readFile(file))
    }
    const page = pages[url.pathname]
    if (!page) return send(response, 404, { error: 'Not found' })
    response.writeHead(200, { 'content-type': types[extname(page)]!, 'cache-control': 'no-cache' })
    response.end(await readFile(join(here, page)))
  })().catch((error: Error & { status?: number; code?: string }) => {
    if (response.headersSent) return response.end()
    send(response, error.status ?? (error.code === 'ENOENT' ? 404 : 500), { error: error.message })
  })
})
server.listen(port, '127.0.0.1', () => console.log(`Cyberpunk Story Sandbox: http://127.0.0.1:${port}  (story: ${content})`))
