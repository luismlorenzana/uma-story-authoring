# Uma Story Authoring

Run `pnpm install` and `pnpm start`. Open the [Story Sandbox](http://127.0.0.1:4322) and choose Cyberpunk, Quest, or Farm. A single loopback server runs all three books.

| Book | Private story files and verdicts |
| --- | --- |
| Cyberpunk | `content/cyberpunk/stories/` |
| Quest | `content/quest/stories/` |
| Farm | `content/farm/story/` |

Run with Node 22 or newer. Set `UMA_STORY_CONTENT` to change the private content root and `UMA_STORY_PORT` to change the port.
Set `UMA_WORKSPACE` if the game checkouts are elsewhere, or set `UMA_QUEST_ROOT`, `UMA_FARM_ROOT`, or `UMA_CYBERPUNK_ROOT` individually.
Farm and Cyberpunk validate through the corresponding game code. Game release packing continues to use each game's own schema and publication command.

`pnpm publish quest --dry-run` plans a copy for the existing private Platform Story reader. Farm and Cast use the same command with their book name. Publishing to the hosted reader uses the owner's existing scoped Google Cloud configuration. Cyberpunk has a local book.

Commit source code and synthetic fixtures only. Keep long-form drafts, cast packs, images and verdicts in the ignored `content/`. CI validates the Git index.
