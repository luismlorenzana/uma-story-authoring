import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const allowedRoot = new Set(['.gitignore', 'README.md', 'AGENTS.md', 'CLAUDE.md', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json',
  'paths.mjs', 'workspace.mjs', 'hub.mjs', 'check-private.mjs', '.github/workflows/ci.yml', '.claude/launch.json'])
const source = /^(?:src|albums|publishing|quest|farm|cyberpunk|tools)\/(?:[a-z0-9_-]+\/)*[a-z0-9_.-]+\.(?:m?js|ts|css|html)$/
const forbidden = /(?:^|\/)(?:content|references|drafts|reviews|node_modules|\.cache|dist|coverage)(?:\/|$)/i
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
const ownerPrivate = /(?:^|\/)(?:owner-private|owner-only|private-variants|private-art-outbox|art-private)(?:\/|$)|\.private\.|\.(?:key|pem)$/i
const unexpected = tracked.filter(file => ownerPrivate.test(file) || forbidden.test(file) || (!allowedRoot.has(file) && !source.test(file)))
if (unexpected.length) {
  console.error('The Git index includes files outside the authoring code allowlist:')
  for (const file of unexpected) console.error('  ' + file)
  process.exitCode = 1
}
