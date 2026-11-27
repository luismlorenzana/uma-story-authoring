import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({ test: { exclude: [
  ...configDefaults.exclude,
  '**/content/**', '**/.cache/**',
  '**/owner-private/**', '**/owner-only/**', '**/private-variants/**',
  '**/private-art-outbox/**', '**/art-private/**', '**/*.private.*',
] } })
