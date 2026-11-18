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

`pnpm run publish quest --dry-run` plans a copy for the existing private Platform Story reader. Farm and Cast use the same command with their book name. Publishing to the hosted reader uses the owner's existing scoped Google Cloud configuration. Cyberpunk has a local book.

Commit source code and synthetic fixtures only. Keep long-form drafts, cast packs, images and verdicts in the ignored `content/`. CI validates the Git index.

## Cyberpunk four-pillar packets

Start with the [canonical Cyberpunk packet queue](https://github.com/luismlorenzana/uma-cyberpunk/blob/main/docs/handoff/README.md#four-pillar-art-and-story-queue) and [shared delivery contract](https://github.com/luismlorenzana/uma-cyberpunk/blob/main/docs/design/campaign-art-delivery.md). The story work begins with Pillar 1's four splash scenes.

The local full handoff is at `content/cyberpunk-four-pillars/README.md`. Its source revision and hashes identify the canonical snapshot. `content/cyberpunk-four-pillars-handoff.json` identifies the game checkout and one shared private progress register. These local files stay ignored with other authoring material; cast, scripts, pictures and verdicts remain private. Refresh the handoff from the canonical queue when its contracts change.
