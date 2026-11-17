import { createServer } from 'node:http'

const port = Number(process.env.UMA_STORY_PORT ?? 4322)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Story Sandbox port')

const books = new Map([
  ['cyberpunk', { name: 'Cyberpunk', load: () => import('./cyberpunk/server.ts') }],
  ['quest', { name: 'Quest', load: () => import('./quest/server.mjs') }],
  ['farm', { name: 'Farm', load: () => import('./farm/server.mjs') }],
])
const home = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Uma Story Sandbox</title><main><h1>Uma Story Sandbox</h1><ul>' +
  Array.from(books, ([key, { name }]) => `<li><a href="/${key}/">${name}</a></li>`).join('') + '</ul></main></html>'
const send = (res, code, type, text) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(text)
}

createServer(async (req, res) => {
  const host = req.headers.host
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
    return send(res, 403, 'text/plain; charset=utf-8', 'Use the loopback URL')
  }
  const { pathname } = new URL(req.url ?? '/', `http://${host}`)
  if (pathname === '/' && req.method === 'GET') return send(res, 200, 'text/html; charset=utf-8', home)
  const [, name, ...parts] = pathname.split('/')
  const book = books.get(name)
  if (!book) return send(res, 404, 'text/plain; charset=utf-8', 'Choose a game from the Story Sandbox home')
  if (parts.length === 0 && req.method === 'GET') {
    res.writeHead(308, { location: `/${name}/` })
    return res.end()
  }
  try {
    const { handle } = await book.load()
    handle(req, res, '/' + parts.join('/'))
  } catch (error) {
    console.error(error.message)
    return send(res, 503, 'text/plain; charset=utf-8', 'Could not start this book. Check its local game checkout.')
  }
}).listen(port, '127.0.0.1', () => console.log(`Uma Story Sandbox: http://127.0.0.1:${port}`))
