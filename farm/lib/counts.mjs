// The story's counts: what the cast, the tag sheet, the ties, the bibles and the routes add up to, each count with
// the Umas behind it, so the owner can see what's unbalanced before the bibles are written around it. Pure: it reads only
// what the sandbox already loads, and holds no name (the page puts names to ids).

const group = (entries) => {
  const out = {}
  for (const [key, id] of entries) if (key !== undefined && key !== null) (out[key] ??= []).push(id)
  return Object.fromEntries(Object.entries(out).sort(([a, x], [b, y]) => y.length - x.length || String(a).localeCompare(String(b))))
}

/** Every count the Counts page shows. `rungs` is the route's rung ids (27); `closest` the two closest ties an Uma. */
export function storyCounts({ cast, tags, ties, bibles = [], routes = [], pairs = [], rungs = [], closest = 2 }) {
  const umas = cast?.umas ?? []
  const ids = umas.map((u) => u.characterId)
  const tagOf = new Map((tags?.tags ?? []).map((t) => [t.characterId, t]))
  const bibleOf = new Map(bibles.map((b) => [b.characterId, b]))
  const routeOf = new Map(routes.map((r) => [r.characterId, r]))
  const tieList = ties?.ties ?? []
  const tiesPer = ids.map((id) => {
    const mine = tieList.filter((t) => t.a === id || t.b === id)
    return { id, ties: mine.length, strong: mine.filter((t) => t.strength === 3).length, real: mine.filter((t) => t.source === 'real').length }
  }).sort((a, b) => a.ties - b.ties || a.strong - b.strong || a.id.localeCompare(b.id))
  // A pair conversation file counts for both its Umas; each Uma needs one for each of her two closest ties.
  const pairsPer = ids.map((id) => ({ id, written: pairs.filter((p) => p.a === id || p.b === id).length, of: closest }))
  const eventsPer = ids.map((id) => {
    const scripted = new Set((routeOf.get(id)?.events ?? []).map((e) => e.id))
    return { id, bible: bibleOf.has(id), scripted: rungs.filter((r) => scripted.has(r)).length, of: rungs.length }
  })
  return {
    umas: ids.length,
    byCalling: group(umas.map((u) => [u.calling, u.characterId])),
    arrivals: group(umas.map((u) => [u.arrives?.kind, u.characterId])),
    tagged: tagOf.size,
    byLine: group(ids.map((id) => [tagOf.get(id)?.favouriteLine, id])),
    bySeason: group(ids.map((id) => [tagOf.get(id)?.season, id])),
    byFestival: group(ids.map((id) => [tagOf.get(id)?.festival, id])),
    byLoved: group(ids.map((id) => [tagOf.get(id)?.loved, id])),
    ties: { total: tieList.length, real: tieList.filter((t) => t.source === 'real').length, story: tieList.filter((t) => t.source === 'story').length, unsourced: tieList.filter((t) => !t.source).length },
    tiesPer,
    bibles: bibleOf.size,
    liked: group([...bibleOf.values()].flatMap((b) => (b.gifts?.liked ?? []).map((g) => [g, b.characterId]))),
    disliked: group([...bibleOf.values()].flatMap((b) => (b.gifts?.disliked ?? []).map((g) => [g, b.characterId]))),
    pairsPer,
    eventsPer,
  }
}
