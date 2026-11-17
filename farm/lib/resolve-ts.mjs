// A resolve hook for reading @farm/domain's TypeScript as the game has it (lib/game.mjs): the domain writes its relative
// imports without an extension, as its bundler allows, so a specifier from a .ts file tries `.ts` and `/index.ts`. The
// version query on the parent (`?v=`) is carried to each child, so an edit to any story file loads a fresh graph.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  const parent = context.parentURL
  if (parent?.startsWith('file:') && /\.ts(\?|$)/.test(parent) && /^\.\.?\//.test(specifier)) {
    const search = new URL(parent).search
    const tries = /\.[cm]?[jt]s$/.test(specifier) ? [''] : ['.ts', '/index.ts']
    for (const ext of tries) {
      const url = new URL(specifier + ext, parent)
      if (existsSync(fileURLToPath(url))) return { url: url.href + search, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
