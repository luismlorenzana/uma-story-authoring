# Uma Story Authoring

Local review tools for the Quest, Farm, and Cyberpunk stories. Each sandbox keeps its own format, views, and local review file.

Clone this repo alongside the game checkouts. Run `pnpm install`, then start the sandbox you want.

| Command | Local sandbox |
| --- | --- |
| `pnpm quest` | [Quest](http://127.0.0.1:4320) |
| `pnpm farm` | [Farm](http://127.0.0.1:4321) |
| `pnpm cyberpunk` | [Cyberpunk](http://127.0.0.1:4322) |

Use Node 22 or newer. Set `UMA_WORKSPACE` if the games are elsewhere, or set `UMA_QUEST_ROOT`, `UMA_FARM_ROOT`, or `UMA_CYBERPUNK_ROOT` to point to an individual checkout. The sandboxes keep their existing private directory and port overrides.

The apps read the existing private content, cast packs, and source art in place and store reviews in each game's private review file. Farm and Cyberpunk use the corresponding game checkout's story code for validation. Story authoring, game exports, and publishing stay with the existing game and platform workflows. This repo tracks source code and synthetic tests.

The initial sandbox implementations were extracted from the three game repos.
