> Canonical [current source](https://github.com/luismlorenzana/uma-cyberpunk/blob/main/docs/design/campaign-art-delivery.md) · snapshot at [76462d6](https://github.com/luismlorenzana/uma-cyberpunk/commit/76462d648beed1b6da4a1586c6be6ec81dbe0422). Return contract changes to the game queue and refresh this handoff; record authoring progress in the shared private campaign register.

# Four-pillar campaign art and story delivery

The owner set this delivery direction on 2026-11-18 (D64). Build on the combined Tier 1–5 campaign,
its save and its existing recruitment, service and relationship gates. The first delivery is a real
recruit's meeting, confession, seated cabin conversation and stay overnight. The remaining pillars
extend that same campaign. The [queue](https://github.com/luismlorenzana/uma-cyberpunk/blob/main/docs/handoff/README.md#four-pillar-art-and-story-queue) contains
separate development, art-authoring and story-authoring packets.

This is an implementation plan. Fields and actions described here become supported contracts only
when their development packet implements, documents and checks them. Existing rules are recorded in
the [game manual](https://github.com/luismlorenzana/uma-cyberpunk/blob/main/docs/game/README.md) and [campaign format](https://github.com/luismlorenzana/uma-cyberpunk/blob/main/docs/technical/campaign-content.md).

## Scope and current foundations

| Pillar | Delivery | Existing foundation | Work still required |
|---|---|---|---|
| 1 · Relationships | Meeting, confession, seated chat and overnight compositions | Fifty sign-ons, fifty Captain arcs, repeatable visits, Trust/Heart, pair visits, face-crop renderer and illustration cues | Layered splash presentation, cabin staging, explicit stay/leave flow and all corresponding authoring |
| 2 · Ship, planet and resources | Consistent rooms and visible civilian production, shipments and ship improvements | Port ledger, projects, refits, upkeep, workshop and ship views | Campaign room/state bindings and coordinated location, equipment and prop art |
| 3 · Ship combat | Pilot-suit action splash, talking profile, ship effects and outcome playback | Officer assignments, training, frozen orders, results, objective images and a response thumbnail | Saved-result cinematic playback, character/boss splash bindings and authored response sequences |
| 4 · Tactics | Equipment art, composed armored sprites, larger boss visuals and illustrated special attacks | Loadouts, thirty-nine catalog entries, sprite/standee renderer, normal cut-ins, chance skills and duo techniques | Equipment attachment contract, armor/weapon layers, guest sprite loading, signature actions and matching attack art |

The private roster and latest approvals are live inputs. Recheck the authoring manifests before each
batch; an inventory snapshot is evidence of its date rather than a permanent pending-work count.
Keep the original campaign and its save scope available. Later-tier sign-on prerequisites and roster
stories continue to work when earlier scenes receive new art.

## Shared delivery record

Keep the working record in ignored `content/campaign-art-plan/`. Names, scripts, reference images,
spoilers, owner verdicts and screenshots remain private. The committed packets use numeric outfit IDs
or generic roles. Each record binds the following information across all three workstreams.

The initial snapshot is `content/campaign-art-plan/initial-plan.json`. It contains all sixteen packet
references, fifty solo arcs with their four scene families, ten existing paired visits, seventeen
proposed room families, 56 ship encounters, 39 equipment entries and 63 ground encounters. Existing
scene references were checked against the combined source. Room reachability and new art/action
bindings remain explicitly pending. Copy the snapshot to a working register before recording progress;
preserve the initial evidence and later work instead of regenerating over it. Every count is a
coverage record, not an approved image budget.

| Field | Required information |
|---|---|
| Identity | Pillar, cohort, packet IDs, outfit or private guest ID and role |
| Campaign binding | Existing quest, scene and encounter IDs; branch and eligibility prerequisites; explicit new IDs where needed |
| Player behavior | Entry point, choice, costs, availability, saved effects, finish/retry rules and the next campaign state |
| Story | Source file, scene/cue, script revision, speaker and expression tags; staging and branch notes |
| Art | Logical asset ID, approved base/look, composition, source version, file path, native dimensions, alpha, SHA-256 and exact approval scope |
| Composition | Backdrop, pose, props, effects, portrait policy, anchor/order, safe-area preview and optional crop placements |
| Runtime contract | Implemented schema/fixture revision and an explicit list of requested unsupported fields |
| Review | Draft/approved/integrated state for code, story and art separately; playable review save, pack ID, findings and remaining work |
| Release | Content manifest, compatibility statement, selected predecessor and tested recovery/rollback path |

Art approval does not establish gameplay integration. A published album does not establish a selected
campaign release. Record those states separately. A missing asset uses a named draft fallback and is
listed in the cohort's outstanding work.

The scene inventory at `content/campaign-notes/pillar-one-splash-scenes.json` maps all fifty solo
arcs: 150 existing scene bindings and fifty proposed overnight beats. Validate it against the current
source before copying its entries into the working record. `plannedArtSlot` is a proposed logical ID,
not a claim that the image or runtime scene exists. Paired visits need their own records.

## Working together

1. Development and Story open the shared record against the actual campaign save and script. Art reads
   the same staging, current approved looks and script branches. Any prerequisite or mechanic change
   is written down before final composition work starts.
2. Development supplies an executable baseline contract, short draft script and declared placeholder
   assets through the normal campaign pack. Art and Story can begin their references and drafts while
   that contract is being implemented.
3. Integrate one representative real scene or encounter, then return its phone-size evidence to all
   three workstreams. A composition change updates placements; a story rule change updates code,
   fixtures and the shared record. Preserve completed quest and relationship IDs wherever possible.
4. Expand the reviewed pattern by recruitment tier. Return paired or unusual scenes to review rather
   than silently forcing a single-character layout onto them. Update the common contract once and
   identify every affected binding.
5. Pack the cohort under a fresh private release ID. Exercise current and preceding campaign saves,
   pending scenes/orders, missing-art fallback, interruption and resumption. Then record approved
   integration in CY36 and installed-device findings in CY37.

Every implementation packet includes usable draft story and placeholder art if final authoring is
pending. Art uses the existing owner-review workflow and hash-bound approvals. Development records
its completed behavior; the cohort remains open until its Story and Art acceptance also passes.
Never mark authoring approved because a placeholder played successfully.

Use `uma-story-authoring/content/cyberpunk/stories/` for authored scripts and verdicts. Use
`uma-art-authoring/content/authoring/character-universes/cyberpunk/` for reusable cast art and its
albums. Campaign-local room plates, props and integration copies may live under this game's ignored
`content/`. The handoff identifies which copy is authoritative and hashes every exported file.

Campaign-local art ships through the private campaign pack. Reusable universe art follows its existing
authoring publication path, then is bound into the campaign release. Request a scoped shared-package
change only if that package must understand a new format. The game can implement a local adapter;
other games' data and release channels are outside this queue.

## Pillar 1 scene and composition contract

| Family | Required staging | Existing binding | Behavior to preserve or add |
|---|---|---|---|
| Meeting | Shared Homestretch welcome/briefing area, consistent desk and Captain-facing camera; approved pilot suit | Each recruit's existing sign-on quest and scene | Joining occurs once; personal story stays separately launchable; tier prerequisites remain intact |
| Confession | Evening private cabin, Quarters look, reciprocal expression and clear Captain choice | Each Captain arc's relationship-choice milestone | Captain can initiate the confession; mutual Heart or respectful Trust; retain independent concurrent relationships |
| Seated chat | Same cabin family; character seated at a table or beside the bed | Each Captain arc's repeatable visit and compatible seated milestone scenes | Authored rotating conversation; a saved evening reservation; keep availability and appointment/resettlement rules |
| Overnight | Same cabin and bed; character lying down; Captain remains the viewpoint | New beat attached to the existing evening flow | Explicit mutual choice to stay, an alternative to leave, one day/upkeep transition and resumable morning |

The shared meeting setting is a presentation location aboard the ship. Preserve the surrounding
planetary service context and gate; moving the illustration must not move the officer to a different
port in the simulation. Story revises physical references to make the staging coherent.

Chat followed by staying is one evening. Both leave and stay resolve that reserved evening once.
Overnight eligibility is authored and mutual; no romance choice becomes a combat or campaign gate.
Completed pre-update visits must not replay costs or force a new relationship decision. An unavailable
officer is not physically shown aboard because a generic cabin asset exists.

Shared Uma/former-commander visits use paired seated and bed variants within the same families.
Keep release, residence and individual consent independent. Inventory existing paired scenes first;
add an explicit new beat where no matching script exists. This does not create fifty new solo boss
dating arcs or reopen retired rear-view authoring.

Use a shared room plate plus transparent character pose where practical. A flattened approved CG is
also valid when its framing needs it. The runtime must declare whether talking portraits are shown
or hidden over an illustration, rather than inferring that from the presence of the image. Reuse
approved Uma-Farm-style face crops on their matching portrait bases; a new splash pose does not
require a full set of independently painted expressions. Crop placement is reviewed per base.

The baseline check is First Watch, a real sign-on, optional Training, the character's real service
prerequisites, confession, seated visit and both stay/leave outcomes. Use a second actual recruit to
prove concurrent relationships and reuse. Then expand the registry through all five tiers. These are
campaign review checkpoints, with disposable save copies for repeatable checks.

## Pillars 2 and 3 contracts

Pillar 2 shares its cabin geometry with Pillar 1. Each room or base state has a real reachable entry
and a saved-state predicate. A project under construction differs from a completed project; a local
export remains subject to reserves and upkeep. Separate visual decoration from a mechanic that has
not been implemented. Supply an optional quiet room view for a meaningful state change without
turning routine transactions into mandatory scenes.

Pillar 3 presents an already-resolved order. Its playback uses frozen officer assignments, target,
result and authored cues. Reload, fast mode or skipping must never issue another order. A character's
pilot-suit operating pose and matching talking profile share the scene with reusable bridge plates
and effects. Boss communications use the same likeness across enemy and ally roles. Portrait face
crops remain bound to the approved portrait, not projected onto an unrelated splash pose.

Use the First Watch escort and the first occupied approach as initial coverage. Later cohorts include
local defense, fleet contributions and both later-tier protected civilian craft. Keep controls and
objective meters readable; results remain comprehensible with cinematics skipped.

## Pillar 4 contracts and decisions to resolve

The current part catalog is the authority for equipment IDs and legal combinations. Publish designs
and small icons for every entry; coatings may use material swatches. Shared designs carry palette
masks and character adaptation notes. Attachment positions, facing and depth order belong to the
sprite frame contract. Different weapon families need compatible arm poses, including two-handed
grips. Empty-hand bodies alone do not establish usable attack animation.

CY57 resolves the scoped attachment/composition format and performance approach on an actual
campaign loadout. Compare layered playback with composing/caching the equipped set, without baking
every possible loadout. Keep readable missing-layer fallbacks. Any new shared sprite format needs a
versioned platform request and a compatible local adapter. Preserve recorded battle inputs/replays.

Boss art may be visually larger while using the existing single-tile combat rules. Literal creatures,
new transformations and multi-tile occupancy require an authored campaign requirement and a separate
rules decision. Record the requested silhouette, anchor and extent before commissioning sheets.

Normal cut-ins, mounted actions, chance skills and duos exist. Character-specific selectable
signatures and boss signatures require CY61. That packet specifies cost, cadence, targeting,
forecast, counterplay, AI and replay behavior before final attack splashes are authored. Story and
Art name an approved action key and trigger; images never determine damage or targeting.

## Checkpoints and completion

| Checkpoint | Required campaign evidence | Packets |
|---|---|---|
| P1 first arc | Four scenes, Trust/Heart, stay/leave, interruption and next morning, coherent approved staging | CY48–CY50 |
| P1 full roster | Every sign-on and Captain arc mapped, paired variants reconciled, later-tier gates retained | CY48–CY50 |
| P2 civilian supply | Reachable ship rooms, one shipment funding gear/refit, project states and nightly reconciliation | CY51–CY53 |
| P3 command | Escort and approach, real order playback, loss/free retry/resume, correct officer/boss/profile | CY54–CY56 |
| P4 equipment and figures | Fitted weapons visible in the real boarding mission, broken-part states, enemy identities and device performance | CY57–CY60, CY63 |
| P4 signatures | Selectable hero action and warned boss action, forecast/AI/retry, illustrated playback and roster rollout | CY61–CY63 |
| Combined release | Same campaign through all five tiers, art/source/release audit, owner-only hosting and installed-device review | CY36–CY37 |

Art production and story drafting for later pillars can proceed once their required format and scene
brief are concrete. Their implementation starts after the first P1 checkpoint; the P1 full-roster
rollout can continue alongside it. CY57's equipment format can be designed before CY54 finishes,
but its in-game acceptance uses the same evolving campaign. Packet numbers identify work; the queue
dependencies define execution order.

Do not finish CY36/CY37 merely because these packets exist. Physical iPhone observations remain
distinct from landscape browser emulation. A finished packet is removed with its Done row, and its
delivered contract replaces proposal language in the technical documentation.
