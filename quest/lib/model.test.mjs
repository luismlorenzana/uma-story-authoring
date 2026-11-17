// The Story Sandbox's model, on invented records only: no real names, no story text.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import { buildPack, buildRankerPack, castCounts, crossCheck, parseBundle, parseRelationships, parseSetting, parseTags, parseWorld, placeholderBundle, STATUSES, tiesOf, toWrite, wayOf, wordCount } from './model.mjs'

const board = (id, franchise, n) => ({
  kind: 'tier-board-ss-export', board: id, title: id, franchise,
  characters: Array.from({ length: n }, (_, i) => ({ id: `${franchise}-${i + 1}`, name: `${franchise} unit ${i + 1}`, franchiseId: franchise, rank: i + 1, imageUrls: {} })),
})
const exportOf = (bosses = 2) => {
  const files = [['umas.json', board('umas', 'umas', 2)], ...['sea', 'court', 'march', 'path', 'blight'].map((f) => [`${f}.json`, board(`${f}-bosses`, f, bosses)])]
  const manifest = { schemaVersion: 1, kind: 'tier-ss-export', exportedAt: '2026-01-02T03:04:05Z', tier: 'SS', files: files.map(([file, b]) => ({ file, board: b.board, franchise: b.franchise })) }
  return { manifest, boards: new Map(files) }
}
const setting = parseSetting({ schemaVersion: 1, kind: 'story-setting', finale: 'sea', themes: [{ id: 'revenge', name: 'Revenge' }], factions: [], regions: [], cities: [{ id: 'town-1', name: 'Town One' }] })
const bundleFor = (hero, n, change = {}) => ({
  schemaVersion: 1, kind: 'story-bundle', hero, status: 'skeleton', title: 'A title', theme: 'revenge', logline: 'A logline.',
  bosses: ['court', 'march', 'path', 'blight', 'sea'].map((f, i) => ({ id: `${f}-${n}`, chapter: i + 1, tie: { kind: 'rival', summary: 'A tie.' } })),
  ...change,
})

test('a Studio export becomes a pack, heroes and bosses apart', () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x.zip' })
  assert.equal(pack.id, 'ss-2026-01-02')
  assert.equal(pack.characters.length, 12)
  assert.deepEqual(pack.franchises.map((f) => f.role), ['hero', 'boss', 'boss', 'boss', 'boss', 'boss'])
  assert.throws(() => buildPack({ ...manifest, kind: 'other' }, boards, {}), /tier-ss-export/)
})

test('a full bundle has no issues; a broken one names each problem', () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  assert.deepEqual(parseBundle(bundleFor('umas-1', 1), { pack, setting }).issues, [])
  const swapped = bundleFor('umas-1', 1)
  swapped.bosses[4].chapter = 1; swapped.bosses[0].chapter = 5
  const { issues } = parseBundle(swapped, { pack, setting })
  assert.ok(issues.some((i) => /final boss should come from sea/.test(i)))
  const doubled = bundleFor('umas-1', 1)
  doubled.bosses[1] = { id: 'court-2', chapter: 2, tie: { kind: 'x', summary: 'y' } }
  const second = parseBundle(doubled, { pack, setting }).issues
  assert.ok(second.some((i) => /two bosses from court/.test(i)))
  assert.ok(second.some((i) => /no boss from march/.test(i)))
})

test('scenes are checked: speakers in the cast, known steps, choices of two to four', () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  const scene = { id: 'one', title: 'A scene', cast: ['umas-1'], steps: [
    { t: 'line', speaker: 'umas-1', text: 'Fine.' },
    { t: 'line', speaker: 'court-1', text: 'Not in the cast.' },
    { t: 'dance', text: 'Unknown.' },
    { t: 'choice', options: [{ text: 'Only one' }] },
  ] }
  const { issues } = parseBundle(bundleFor('umas-1', 1, { scenes: [scene] }), { pack, setting })
  assert.equal(issues.length, 3)
  assert.match(issues.join('\n'), /court-1 is not in the cast/)
  assert.match(issues.join('\n'), /unknown step dance/)
  assert.match(issues.join('\n'), /2–4 options/)
})

// A small world: two regions of two bands each, plus the hub.
const world = parseSetting({ schemaVersion: 1, kind: 'story-setting', finale: 'sea', themes: [{ id: 'revenge', name: 'Revenge' }], factions: [], regions: [{ id: 'warrior' }, { id: 'mage' }],
  cities: [{ id: 'hub', name: 'Hub', band: null }, ...['warrior', 'mage'].flatMap((r) => [1, 2, 3, 4, 5].map((band) => ({ id: `${r}-${band}`, name: `${r} ${band}`, region: r, band })))] })
const road = (n, region = 'warrior', change = {}) => Array.from({ length: 5 }, (_, i) => ({ n: i + 1, title: 'A chapter', city: `${i === 0 ? region : 'mage'}-${i + 1}`, boss: `${['court', 'march', 'path', 'blight', 'sea'][i]}-${n}`,
  careerBeat: 'A beat from her record.', summary: 'What happens.', beats: ['One.', 'Two.', 'Three.'], ...(change[i + 1] ?? {}) }))

test('an outline is checked: towns by band, the chapter’s boss, three to six beats, checked crossings', () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  pack.characters.find((c) => c.id === 'umas-1').playstyle = 'front'
  const good = bundleFor('umas-1', 1, { status: 'outline', chapters: road(1), crossings: [{ hero: 'umas-2', kind: 'rival', checked: true, summary: 'A race.' }] })
  assert.deepEqual(parseBundle(good, { pack, setting: world }).issues, [])
  const bad = bundleFor('umas-1', 1, { status: 'outline', chapters: road(1, 'mage', { 2: { city: 'mage-3' }, 3: { boss: 'path-2' }, 4: { beats: ['Only one.'] } }).filter((ch) => ch.n !== 5),
    crossings: [{ hero: 'umas-2', kind: 'rival', summary: 'A race.' }] })
  const issues = parseBundle(bad, { pack, setting: world }).issues.join('\n')
  assert.doesNotMatch(issues, /first town/, 'a racing draft keeps its road: the home check is the tournament shape’s (SC7)')
  assert.match(issues, /chapter 2 is in mage 3, a band-3 town; it should be in band 2/)
  assert.match(issues, /chapter 3's boss should be path-1/)
  assert.match(issues, /chapter 4 needs three to six beats/)
  assert.match(issues, /chapter 5 is missing/)
  assert.match(issues, /crossing with umas-2 is not checked/)
  assert.deepEqual(parseBundle({ ...bad, status: 'skeleton' }, { pack, setting: world }).issues.filter((i) => /chapter \d (is|should|needs)|crossing/.test(i)), [], 'a skeleton is not held to the outline')
})

test('across bundles: the towns spread, at most four stories in one, and every town visited once the roads are done', () => {
  const { manifest, boards } = exportOf(6)
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  const five = [1, 2, 3, 4, 5].map((n) => ({ ...bundleFor(`umas-${n}`, n), chapters: road(n) }))
  const crowded = crossCheck(pack, five, world)
  assert.ok(crowded.issues.some((i) => /mage 2 hosts 5 stories' chapters .*; at most 4/.test(i)))
  assert.ok(crowded.issues.some((i) => /no story visits warrior 2, warrior 3/.test(i)), 'every road is drawn, so the quiet towns are named')
  assert.deepEqual(crowded.towns['warrior-1'], ['umas-1', 'umas-2', 'umas-3', 'umas-4', 'umas-5'])
  const unfinished = crossCheck(pack, [...five.slice(0, 4), bundleFor('umas-5', 5)], world)
  assert.equal(unfinished.issues.filter((i) => /hosts|no story visits/.test(i)).length, 0, 'four is fine, and quiet towns wait until every road is drawn')
  assert.ok(unfinished.quiet.includes('warrior-2'))
})

const worldPack = (change = {}) => ({
  schemaVersion: 1, kind: 'story-world',
  formats: [{ id: 'pas', name: 'Pass of arms', about: 'Holders hold a passage.' }],
  towns: world.cities.map((c) => ({ id: c.id, epithet: 'A town', look: 'What it looks like.', ...(c.band ? { dungeons: { a: { name: 'Easy', blurb: 'Easier.' }, b: { name: 'Hard', blurb: 'Harder.' } } } : {}) })),
  circuit: [
    { id: 'junior-cup', name: 'Junior Cup', grade: 'G1', month: 12, host: 'warrior-1', format: 'pas', blurb: 'For the young.' },
    { id: 'great-cup', name: 'Great Cup', grade: 'G1', month: 11, host: 'mage-2', format: 'pas', blurb: 'The big one.' },
    { id: 'far-cup', name: 'Far Cup', grade: 'G1', month: 10, host: 'beyond', port: 'mage-5', format: 'pas', blurb: 'Over the sea.' },
    { id: 'late-cup', name: 'Late Cup', grade: 'G1', month: 6, host: 'mage-3', format: 'pas', blurb: 'Too far out.' },
  ],
  ...change,
})

test('the world pack: every town in the gazetteer with two dungeons, every tourney at a real place in a known format', () => {
  assert.deepEqual(parseWorld(worldPack(), world).issues, [])
  const broken = worldPack()
  broken.towns = broken.towns.filter((t) => t.id !== 'mage-4')
  delete broken.towns.find((t) => t.id === 'warrior-2').dungeons.b
  broken.circuit.push({ id: 'lost-cup', name: 'Lost Cup', grade: 'G2', month: 13, host: 'nowhere-1', format: 'joust', blurb: 'x' }, { id: 'sea-cup', name: 'Sea Cup', grade: 'G1', month: 3, host: 'beyond', port: 'warrior-2', format: 'pas', blurb: 'x' })
  const issues = parseWorld(broken, world).issues.join('\n')
  assert.match(issues, /town mage-4 has no gazetteer entry/)
  assert.match(issues, /town warrior-2 needs its dungeon warrior-2b/)
  assert.match(issues, /tourney lost-cup needs a month/)
  assert.match(issues, /format joust is not in the world's formats/)
  assert.match(issues, /host nowhere-1 is not a town/)
  assert.match(issues, /sea-cup is beyond the rim, so it sails from a band-5 port/)
  assert.throws(() => parseWorld({ kind: 'story-world', schemaVersion: 1 }, world), /missing towns/)
})

test('the tournament shape: chapters 1–2 are built on tourneys of their bands, and chapters 3–5 need no career beat', () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  pack.characters.find((c) => c.id === 'umas-1').playstyle = 'front'
  const { world: pack2 } = parseWorld(worldPack(), world)
  const shaped = (change) => bundleFor('umas-1', 1, { status: 'outline', shape: 'tourney', chapters: road(1, 'warrior', change) })
  const good = shaped({ 1: { tourneys: ['junior-cup'] }, 2: { tourneys: ['great-cup', 'far-cup'] }, 3: { careerBeat: undefined }, 4: { careerBeat: undefined }, 5: { careerBeat: undefined } })
  assert.deepEqual(parseBundle(good, { pack, setting: world, world: pack2 }).issues, [])
  const bad = shaped({ 1: { tourneys: ['great-cup'] }, 2: { tourneys: ['late-cup', 'no-such-cup'] } })
  const issues = parseBundle(bad, { pack, setting: world, world: pack2 }).issues.join('\n')
  assert.match(issues, /chapter 1's tourney great-cup is held in band 2/)
  assert.match(issues, /chapter 2's tourney late-cup is held in band 3/)
  assert.match(issues, /tourney no-such-cup is not in the world's circuit/)
  const bare = shaped({ 1: { careerBeat: undefined } })
  assert.match(parseBundle(bare, { pack, setting: world, world: pack2 }).issues.join('\n'), /chapter 1 needs its career beat[\s\S]*chapter 1 needs its tourneys/)
  const racing = bundleFor('umas-1', 1, { status: 'outline', chapters: road(1) })
  assert.deepEqual(parseBundle(racing, { pack, setting: world, world: pack2 }).issues, [], 'a racing draft is held to the old outline only')
  const across = crossCheck(pack, [good, bundleFor('umas-2', 2)], world)
  assert.deepEqual(across.tourneys['great-cup'], ['umas-1'])
  assert.equal(across.shaped, 1)
  const fourOld = [2, 3, 4, 5].map((n) => ({ ...bundleFor(`umas-${n}`, n), chapters: road(n) }))
  assert.equal(crossCheck(pack, [...fourOld, good], world).issues.filter((i) => /hosts/.test(i)).length, 0, 'each shape is spread on its own')
})

test('across bundles: a boss in two stories, and the ones left out', () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  const result = crossCheck(pack, [bundleFor('umas-1', 1), bundleFor('umas-2', 1)])
  assert.equal(result.issues.length, 5)
  assert.equal(result.unassigned.length, 5)
  assert.deepEqual(result.unwritten, [])
})

// An invented Ranker: character 701 with one outfit in T1 and one unranked, her sister on outfit 70102 in T2,
// character 702 with only an F outfit (not used), and 703 with nothing ranked.
const rankerInputs = (change = {}) => ({
  plan: {
    schemaVersion: 2, kind: 'tier-plan', generatedAt: '2026-03-04T05:06:07.000Z', release: 'synthetic', profilesRevision: 3,
    boards: [{ id: 'umas', title: 'Playable Umas', revision: 41, updatedAt: '2026-03-04T00:00:00.000Z', order: [
      { order: 1, outfitId: 70101, title: 'Look One', playstyle: 'front' },
      { order: 2, outfitId: 70102, title: 'Look Two', playstyle: 'late' },
      { order: 3, outfitId: 70201, title: 'Look Three', playstyle: 'pace' },
    ] }],
    identities: [
      { id: '701', characterId: 701, name: 'Runner 701', sister: null, batch: 1, notUsed: false, outfits: [{ outfitId: 70101, tier: 'T1' }, { outfitId: 70103, tier: null }] },
      { id: 's70102', characterId: 701, name: 'Sister of 701', sister: { relation: 'younger sister', age: 'an invented age' }, batch: 2, notUsed: false, outfits: [{ outfitId: 70102, tier: 'T2' }] },
      { id: '702', characterId: 702, name: 'Runner 702', sister: null, batch: null, notUsed: true, outfits: [{ outfitId: 70201, tier: 'F' }] },
      { id: '703', characterId: 703, name: 'Runner 703', sister: null, batch: null, notUsed: false, outfits: [{ outfitId: 70301, tier: null }] },
    ],
  },
  profiles: { schemaVersion: 1, kind: 'uma-profiles', revision: 3, characters: {}, sisters: [{ outfitId: 70102, characterId: 701, name: 'Sister of 701', relation: 'younger sister', age: 'an invented age', profile: 'Invented.' }] },
  outfits: [{ id: 70103, title: { ja: 'j', en: 'Look Four', global: '[Look Four Global]' } }],
  characters: [{ id: 701, name: { ja: 'ja-701', en: 'Runner 701', global: null } }],
  bosses: buildPack(exportOf().manifest, exportOf().boards, { importedAt: 'then', source: 'x' }),
  importedAt: 'now', ...change,
})

test('the Ranker becomes a pack: one Uma per outfit in the tiers, sisters as themselves, the bosses carried over', () => {
  const pack = buildRankerPack(rankerInputs())
  assert.equal(pack.id, 'ranker-2026-03-04')
  assert.deepEqual(pack.ranker, { boardRevision: 41, boardUpdatedAt: '2026-03-04T00:00:00.000Z', profilesRevision: 3, release: 'synthetic', planGeneratedAt: '2026-03-04T05:06:07.000Z', bossesFrom: 'ss-2026-01-02' })
  const heroes = pack.characters.filter((c) => c.role === 'hero')
  assert.deepEqual(heroes.map((h) => [h.id, h.tier, h.batch, h.outfit.id, h.playstyle]), [['701', 'T1', 1, 70101, 'front'], ['s70102', 'T2', 2, 70102, 'late']])
  assert.equal(heroes[0].nameJa, 'ja-701')
  assert.deepEqual(heroes[0].outfits, [{ id: 70101, title: 'Look One', tier: 'T1' }, { id: 70103, title: 'Look Four Global', tier: null }], 'her other outfits, Global titles without brackets')
  assert.deepEqual(heroes[1].sister, { relation: 'younger sister', age: 'an invented age', profile: 'Invented.', of: '701', ofName: 'Runner 701' })
  assert.equal(heroes[1].nameJa, undefined, 'a sister has no Japanese name of her own')
  assert.deepEqual(pack.batches.slice(0, 3), [{ batch: 1, tier: 'T1', heroes: ['701'] }, { batch: 2, tier: 'T2', heroes: ['s70102'] }, { batch: 3, tier: 'T3', heroes: [] }])
  assert.equal(pack.characters.filter((c) => c.role === 'boss').length, 10)
  assert.deepEqual(pack.franchises.map((f) => [f.id, f.role, f.count]), [['umas', 'hero', 2], ['sea', 'boss', 2], ['court', 'boss', 2], ['march', 'boss', 2], ['path', 'boss', 2], ['blight', 'boss', 2]])
  const two = rankerInputs()
  two.plan.identities[0].outfits[1].tier = 'T5'
  assert.throws(() => buildRankerPack(two), /2 outfits in the tiers/)
  assert.throws(() => buildRankerPack(rankerInputs({ profiles: { ...rankerInputs().profiles, sisters: [] } })), /Sister s70102 has no profile/)
  assert.throws(() => buildRankerPack(rankerInputs({ plan: { kind: 'other' } })), /Not a Ranker plan/)
})

test('a placeholder holds every section, empty; it passes with no boss or theme, and a missing section is named', () => {
  const pack = buildRankerPack(rankerInputs())
  assert.deepEqual(STATUSES.slice(0, 2), ['placeholder', 'skeleton'])
  const empty = placeholderBundle('701')
  assert.deepEqual(parseBundle(empty, { pack, setting: world }).issues, [])
  assert.equal(empty.shape, 'tourney')
  assert.deepEqual(empty.chapters.map((ch) => ch.n), [1, 2, 3, 4, 5])
  assert.deepEqual(toWrite(empty), ['title', 'logline', 'theme', 'bible', '5 chapters', 'bosses (to be decided)'])
  assert.equal(wordCount(empty), 0)
  const broken = placeholderBundle('nobody')
  delete broken.logline; delete broken.heroBible.voice; broken.chapters.pop()
  const issues = parseBundle(broken, { pack, setting: world }).issues.join('\n')
  assert.match(issues, /hero nobody is not a hero/)
  assert.match(issues, /missing its logline/)
  assert.match(issues, /bible is missing its voice/)
  assert.match(issues, /five chapters, 1 to 5/)
  assert.throws(() => parseBundle({ ...empty, status: 'skeleton' }, { pack, setting: world }), /needs hero, title and logline/, 'a skeleton still needs its title and logline')
  const across = crossCheck(pack, [empty, placeholderBundle('s70102')], world)
  assert.deepEqual([across.placeholders, across.written, across.shaped, across.unwritten.length], [2, 0, 0, 0])
  assert.equal(across.issues.filter((i) => /no story/.test(i)).length, 0, 'placeholders never count as a finished road')
})

// Invented vocabularies: two Ways, three classes, two personalities, the setting's one theme.
const tagFile = (umas, change = {}) => ({
  schemaVersion: 1, kind: 'story-tags',
  vocabularies: {
    ways: [{ id: 'warrior', starts: ['Brawler'] }, { id: 'spellblade', starts: ['Arms Spellblade'] }, { id: 'mage', starts: ['Sorcerer'] }, { id: 'summoner', starts: ['Tome Summoner'] }, { id: 'healer', starts: ['Cleric', 'Paladin'] }],
    classes: [{ id: 'fighter', name: 'Fighter', way: 'warrior', start: 'Brawler' }, { id: 'scholar', name: 'Scholar', way: 'mage', start: 'Sorcerer' }, { id: 'odd', name: 'Odd', way: 'mage', start: 'Brawler' }],
    faces: ['cheery', 'serious'], personalities: [{ id: 'bright', face: 'cheery' }, { id: 'grave', face: 'serious' }], storyTypes: ['revenge'],
    ...change,
  },
  umas,
})
const tagged = (cls) => ({ class: { id: cls, why: 'From her career.' }, personality: { id: 'bright', why: 'Her voice.' }, story: { id: 'revenge', why: 'Her theme.' } })

test('tags: every Uma once per set, every tag in its vocabulary, every mapping one the game has', () => {
  const pack = buildRankerPack(rankerInputs())
  const good = tagFile({ 701: tagged('fighter'), s70102: tagged('scholar') })
  const { issues } = parseTags(good, { pack, setting: world })
  assert.deepEqual(issues, ['class odd: Brawler is not a starting class of the mage Way'])
  assert.equal(wayOf(good, '701'), 'warrior')
  assert.equal(wayOf(good, 's70102'), 'mage')
  const bad = tagFile({ 701: { ...tagged('ranger'), personality: { id: 'bright' } }, 999: tagged('fighter') }, { personalities: [{ id: 'bright', face: 'smug' }] })
  const named = parseTags(bad, { pack, setting: world }).issues.join('\n')
  assert.match(named, /701: class ranger is not in its vocabulary/)
  assert.match(named, /701: her personality tag needs a one-line reason/)
  assert.match(named, /s70102 has no tags/)
  assert.match(named, /999 is tagged but not in the cast/)
  assert.match(named, /personality bright maps to smug/)
  const themed = parseTags(good, { pack, setting: world, bundles: [{ hero: '701', status: 'bible', theme: 'legacy' }, { hero: 's70102', status: 'placeholder', theme: null }] }).issues
  assert.ok(themed.includes("701: her story type is revenge, but her written story's theme is legacy"), 'a written story keeps its theme as her story type')
  assert.throws(() => parseTags({ kind: 'story-tags', schemaVersion: 1 }, { pack }), /Not a tags file/)
})

test("her Way comes from her class: chapter 1 of a tournament-shape story is in her class's Way", () => {
  const { manifest, boards } = exportOf()
  const pack = buildPack(manifest, boards, { importedAt: 'now', source: 'x' })
  pack.characters.find((c) => c.id === 'umas-1').playstyle = 'front'
  const { world: w } = parseWorld(worldPack(), world)
  const shaped = bundleFor('umas-1', 1, { status: 'outline', shape: 'tourney', chapters: road(1, 'warrior', { 1: { tourneys: ['junior-cup'] }, 2: { tourneys: ['great-cup'] } }) })
  const fighter = tagFile({ 'umas-1': tagged('fighter') }), scholar = tagFile({ 'umas-1': tagged('scholar') })
  assert.deepEqual(parseBundle(shaped, { pack, setting: world, world: w, tags: fighter }).issues, [])
  assert.match(parseBundle(shaped, { pack, setting: world, world: w, tags: scholar }).issues.join('\n'), /chapter 1 should be in her Way's first town \(the mage region, for her class scholar\)/)
  assert.deepEqual(parseBundle(shaped, { pack, setting: world, world: w }).issues, [], 'no tags, no home check: the running-style rule is retired')
})

// Invented: an era, a circle of the cast's three Umas, and their ties.
const relFile = (change = {}) => ({
  schemaVersion: 1, kind: 'story-relationships', kinds: ['rival', 'sister'],
  eras: [{ id: 'e1' }, { id: 'e2' }],
  umas: { 701: { era: 'e1' }, s70102: { era: 'e1' }, 702: { era: 'e1' } },
  circles: [{ id: 'c1', era: 'e1', kind: 'crop', members: ['701', 's70102', '702'] }],
  relationships: [
    { id: '701-s70102-sister', a: '701', b: 's70102', kind: 'sister', weight: 'major', source: 'story', line: 'Sisters.' },
    { id: '701-702-rival', a: '701', b: '702', kind: 'rival', weight: 'minor', source: 'real', line: 'A race they shared.' },
  ],
  ...change,
})
const relPack = () => { const p = buildRankerPack(rankerInputs()); p.characters.push({ id: '702', role: 'hero', name: 'Runner 702', images: {} }); return p }

test('relationships: one era and one home circle each, circles of three to eight, every pair joined once', () => {
  const pack = relPack()
  assert.deepEqual(parseRelationships(relFile(), { pack }).issues, [])
  assert.deepEqual(tiesOf(relFile(), '701').map((t) => [t.other, t.weight]), [['s70102', 'major'], ['702', 'minor']])
  const bad = relFile({
    umas: { 701: { era: 'e1' }, s70102: { era: 'e2' }, 999: { era: 'e1' } },
    circles: [{ id: 'c1', era: 'e1', kind: 'gang', members: ['701', 's70102'] }, { id: 'c2', era: 'e1', kind: 'crop', members: ['701', '702', '999'] }],
    relationships: [
      ...relFile().relationships,
      { id: '702-701-sister', a: '702', b: '701', kind: 'sister', weight: 'huge', source: 'rumour', line: '' },
      { id: 'Bad Id', a: '701', b: '701', kind: 'rival', weight: 'minor', source: 'real', line: 'x' },
    ],
  })
  const issues = parseRelationships(bad, { pack }).issues.join('\n')
  assert.match(issues, /circle c1: kind gang should be one of/)
  assert.match(issues, /circle c1 has 2 Umas; a circle holds three to eight/)
  assert.match(issues, /circle c2: 999 is not in the cast/)
  assert.match(issues, /701 is in 2 circles/)
  assert.match(issues, /702 has no era/)
  assert.match(issues, /s70102 is of era e2 but her circle c1 is of e1/)
  assert.match(issues, /999 has an era but is not in the cast/)
  assert.match(issues, /702 and 701 are joined twice/)
  assert.match(issues, /weight should be major or minor/)
  assert.match(issues, /source should be real or story/)
  assert.match(issues, /702-701-sister needs its one line/)
  assert.match(issues, /a relationship needs a kebab-case id \(Bad Id\)/)
  const crossings = [{ hero: '701', crossings: [{ hero: '702', rel: '701-702-rival' }, { hero: 's70102', rel: '701-702-rival' }, { hero: '702' }] }]
  const pointed = parseRelationships(relFile(), { pack, bundles: crossings }).issues.join('\n')
  assert.match(pointed, /701: her crossing with s70102 points at 701-702-rival, which joins 701 and 702/)
  assert.match(pointed, /701: her crossing with 702 points at no relationship/)
  assert.doesNotMatch(pointed, /crossing with 702 points at 701-702-rival/)
  assert.throws(() => parseRelationships({ kind: 'story-relationships', schemaVersion: 1 }, { pack }), /missing its kinds/)
})

test('sisters mirror their siblings: level by level between lines, each mirror naming its tie (SC23)', () => {
  const pack = relPack()
  pack.characters.push({ id: '703', role: 'hero', name: 'Runner 703', images: {} }, { id: 's70302', role: 'hero', name: 'Sister of 703', images: {} })
  const umas = { 701: { era: 'e1' }, s70102: { era: 'e1', sisterOf: '701' }, 702: { era: 'e1' }, 703: { era: 'e1' }, s70302: { era: 'e1', sisterOf: '703' } }
  const circles = [{ id: 'c1', era: 'e1', kind: 'crop', members: ['701', '702', '703'] }, { id: 'c2', era: 'e1', kind: 'sisters', members: ['s70102', 's70302'] }]
  const tie = (a, b, change = {}) => ({ id: `${a}-${b}-rival`, a, b, kind: 'rival', weight: 'minor', source: 'story', line: 'A tie.', ...change })
  const file = (relationships) => relFile({ umas, circles, relationships })
  const good = [tie('701', '703'), tie('s70102', 's70302', { mirrors: '701-703-rival' }), tie('s70102', '702')]
  const issues = (rels) => parseRelationships(file(rels), { pack }).issues.filter((i) => /SC23|mirrors/.test(i))
  assert.deepEqual(issues(good), [], 'a mirror, and a sister tied to a character with no sisters')
  assert.match(issues([...good, tie('s70102', '703')]).join('\n'), /s70102-703-rival: a sister ties to 703's line through her sisters/)
  assert.match(issues([tie('701', '703'), tie('s70102', 's70302')]).join('\n'), /two sisters of different lines tie only as a mirror/)
  assert.match(issues([tie('701', '702'), tie('s70102', 's70302', { mirrors: '701-702-rival' })]).join('\n'), /mirrors 701-702-rival, which does not join their siblings/)
})

test('the counts: Umas per tag, Way, face, era and circle with the Umas behind each; every Uma ranked by her ties', () => {
  const pack = relPack()
  const tags = tagFile({ 701: tagged('fighter'), s70102: tagged('scholar'), 702: { ...tagged('scholar'), personality: { id: 'grave', why: 'x' } } })
  tags.vocabularies.personalities[1].candidate = true
  const c = castCounts({ pack, tags, relationships: relFile() })
  assert.equal(c.umas, 3)
  assert.equal(c.relationships, 2)
  assert.deepEqual(c.ways.map((w) => [w.id, w.n]), [['warrior', 1], ['spellblade', 0], ['mage', 2], ['summoner', 0], ['healer', 0]])
  assert.deepEqual(c.ways[2].umas, ['s70102', '702'])
  assert.deepEqual(c.classes.map((x) => [x.id, x.n]), [['fighter', 1], ['scholar', 2], ['odd', 0]])
  assert.deepEqual(c.faces.map((f) => [f.id, f.n]), [['cheery', 2], ['serious', 1]])
  assert.deepEqual(c.candidates.map((p) => [p.id, p.umas]), [['grave', ['702']]])
  assert.deepEqual(c.unused, { classes: ['odd'], personalities: [] })
  assert.deepEqual(c.eras.map((e) => [e.id, e.n]), [['e1', 3], ['e2', 0]])
  assert.deepEqual(c.circles.map((x) => [x.id, x.n]), [['c1', 3]])
  assert.deepEqual(c.ranking.map((t) => [t.id, t.total, t.major, t.real, t.rank]), [['701', 2, 1, 1, 1], ['s70102', 1, 1, 0, 2], ['702', 1, 0, 1, 3]])
  assert.deepEqual(c.few, ['701', 's70102', '702'], 'fewer than four ties each')
  assert.deepEqual(c.noMajor, ['702'])
  assert.deepEqual(castCounts({ pack }).ways, [], 'no tags, no tag counts')
})

test('word counts skip ids and keys', () => {
  assert.equal(wordCount({ id: 'skip me', title: 'two words', steps: [{ t: 'line', speaker: 'x', text: 'three more words' }] }), 5)
})
