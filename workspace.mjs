import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const workspace = resolve(process.env.UMA_WORKSPACE ?? join(here, '..'))

export function gameRoot(game) {
  const override = process.env[`UMA_${game.toUpperCase()}_ROOT`]
  return resolve(override ?? join(workspace, `uma-${game}`))
}

export function authoringContent(...parts) {
  return resolve(process.env.UMA_STORY_CONTENT ?? join(here, 'content'), ...parts)
}
