// Client-side tournament simulator. Mirrors the pipeline's probability model
// (scripts/elo.mjs) so knockout pairings produced by the simulation itself can
// be scored on the fly, then plays out groups -> thirds -> bracket -> champion.

import type { Match, Team, Venue } from '../types'

export interface SimModel {
  curve: { w: number; d: number }[]
  hostBonus: number
  teams: Record<string, { r: number; f: number | null }>
}

export interface SimScore {
  h: number
  a: number
  homeCode?: string
  awayCode?: string
  et?: { h: number; a: number } // score after extra time (knockout draws)
  pens?: { h: number; a: number }
  winner: string // team code that advances / wins (groups: '' when drawn)
  simulated: boolean
}

export interface SimRun {
  results: Record<string, SimScore> // by match id
  groupTables: Record<string, GroupRow[]>
  thirds: { code: string; group: string; qualifies: boolean }[]
  champion: string
  runnerUp: string
  third: string
  fourth: string
}

export interface GroupRow {
  code: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
}

const HOST_OF: Record<string, string> = { USA: 'US', CAN: 'CA', MEX: 'MX' }

function favOutcome(curve: SimModel['curve'], absDr: number): { w: number; d: number } {
  const pts = [{ x: 0, w: (1 - curve[0].d) / 2, d: curve[0].d }].concat(
    curve.map((b, i) => ({ x: (i + 0.5) * 50, ...b })),
  )
  const xi = Math.min(absDr, pts[pts.length - 1].x)
  let i = 0
  while (i < pts.length - 2 && pts[i + 1].x < xi) i++
  const a = pts[i]
  const b = pts[i + 1]
  const f = (xi - a.x) / (b.x - a.x)
  return { w: a.w * (1 - f) + b.w * f, d: a.d * (1 - f) + b.d * f }
}

function rawFromDr(curve: SimModel['curve'], dr: number) {
  const { w, d: d0 } = favOutcome(curve, Math.abs(dr))
  const favWin = Math.max(w, 0.05)
  const d = Math.min(Math.max(d0, 0.05), 0.35)
  const favLoss = Math.max(1 - favWin - d, 0.02)
  const [h, a] = dr >= 0 ? [favWin, favLoss] : [favLoss, favWin]
  const sum = h + d + a
  return { h: h / sum, d: d / sum, a: a / sum }
}

/** blended W/D/L for an arbitrary pairing (same ensemble as the pipeline) */
export function pairProbs(
  model: SimModel,
  home: string,
  away: string,
  venueCountry: string | undefined,
): { h: number; d: number; a: number; dr: number } {
  const bonus =
    HOST_OF[home] === venueCountry ? model.hostBonus : HOST_OF[away] === venueCountry ? -model.hostBonus : 0
  const th = model.teams[home]
  const ta = model.teams[away]
  const drE = (th?.r ?? 1600) - (ta?.r ?? 1600) + bonus
  const pE = rawFromDr(model.curve, drE)
  let p = pE
  let dr = drE
  if (th?.f != null && ta?.f != null) {
    const drF = ((th.f - ta.f) * 400) / 600 + bonus
    const pF = rawFromDr(model.curve, drF)
    p = { h: (pE.h + pF.h) / 2, d: (pE.d + pF.d) / 2, a: (pE.a + pF.a) / 2 }
    dr = (drE + drF) / 2
  }
  return { ...p, dr }
}

const poisson = (lambda: number, rnd: () => number): number => {
  const L = Math.exp(-lambda)
  let k = 0
  let prod = rnd()
  while (prod > L) {
    k++
    prod *= rnd()
  }
  return k
}

/** sample a 90' scoreline consistent with a pre-sampled outcome */
function sampleScore(outcome: 'h' | 'd' | 'a', dr: number, rnd: () => number): { h: number; a: number } {
  const share = 1 / (1 + 10 ** (-dr / 400))
  const total = 2.6
  const lh = Math.max(total * share, 0.35)
  const la = Math.max(total - lh, 0.35)
  for (let t = 0; t < 60; t++) {
    const h = poisson(lh, rnd)
    const a = poisson(la, rnd)
    if (outcome === 'h' && h > a) return { h, a }
    if (outcome === 'a' && a > h) return { h, a }
    if (outcome === 'd' && h === a) return { h, a }
  }
  // fallback: construct a minimal consistent score
  if (outcome === 'h') return { h: 1, a: 0 }
  if (outcome === 'a') return { h: 0, a: 1 }
  return { h: 1, a: 1 }
}

/** simulate one match; knockout draws continue into ET and penalties */
export function simulateMatch(
  model: SimModel,
  home: string,
  away: string,
  venueCountry: string | undefined,
  knockout: boolean,
  rnd: () => number,
): SimScore {
  const { h, d, dr } = pairProbs(model, home, away, venueCountry)
  const u = rnd()
  const outcome: 'h' | 'd' | 'a' = u < h ? 'h' : u < h + d ? 'd' : 'a'
  const score = sampleScore(outcome, dr, rnd)
  const out: SimScore = { ...score, winner: '', simulated: true }
  if (outcome === 'h') out.winner = home
  if (outcome === 'a') out.winner = away
  if (knockout && outcome === 'd') {
    // extra time: ~1/3 of regulation scoring intensity
    const share = 1 / (1 + 10 ** (-dr / 400))
    const eh = poisson(Math.max(0.85 * share, 0.12), rnd)
    const ea = poisson(Math.max(0.85 * (1 - share), 0.12), rnd)
    out.et = { h: score.h + eh, a: score.a + ea }
    if (eh > ea) out.winner = home
    else if (ea > eh) out.winner = away
    else {
      // penalty shoot-out: 5 rounds then sudden death, ~73% conversion
      let ph = 0
      let pa = 0
      let round = 0
      while (true) {
        round++
        const hin = rnd() < 0.73
        const ain = rnd() < 0.73
        ph += hin ? 1 : 0
        pa += ain ? 1 : 0
        if (round >= 5 && ph !== pa) break
        if (round >= 5 && round >= 11) {
          // statistically inevitable, but guarantee termination
          if (rnd() < 0.5) ph++
          else pa++
          break
        }
        if (round < 5) {
          const left = 5 - round
          if (ph > pa + left || pa > ph + left) break
        }
      }
      out.pens = { h: ph, a: pa }
      out.winner = ph > pa ? home : away
    }
  }
  return out
}

// ---- group standings (FIFA tiebreakers, compact: pts/gd/gf then h2h then lot) ----

function tableFor(
  codes: string[],
  results: { h: string; a: string; gh: number; ga: number }[],
  useH2h = true,
): GroupRow[] {
  const rows = new Map<string, GroupRow>(
    codes.map((c) => [c, { code: c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]),
  )
  for (const r of results) {
    const H = rows.get(r.h)
    const A = rows.get(r.a)
    if (!H || !A) continue
    H.p++
    A.p++
    H.gf += r.gh
    H.ga += r.ga
    A.gf += r.ga
    A.ga += r.gh
    if (r.gh > r.ga) {
      H.w++
      A.l++
      H.pts += 3
    } else if (r.gh < r.ga) {
      A.w++
      H.l++
      A.pts += 3
    } else {
      H.d++
      A.d++
      H.pts++
      A.pts++
    }
  }
  for (const row of rows.values()) row.gd = row.gf - row.ga
  const all = [...rows.values()]
  const cmp = (x: GroupRow, y: GroupRow) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf
  all.sort(cmp)
  // h2h among exact ties (one level deep — drawing of lots beyond that)
  if (!useH2h) return all
  for (let i = 0; i < all.length; ) {
    let j = i + 1
    while (j < all.length && cmp(all[i], all[j]) === 0) j++
    if (j - i > 1) {
      const tied = new Set(all.slice(i, j).map((r) => r.code))
      const mini = tableFor(
        [...tied],
        results.filter((r) => tied.has(r.h) && tied.has(r.a)),
        false, // single level: identical mini-tables must not recurse forever
      )
      const order = new Map(mini.map((r, k) => [r.code, k]))
      const seg = all.slice(i, j).sort((x, y) => (order.get(x.code) ?? 0) - (order.get(y.code) ?? 0))
      all.splice(i, j - i, ...seg)
    }
    i = j
  }
  return all
}

// ---- full tournament ----

export function runTournament(
  model: SimModel,
  matches: Match[],
  venues: Record<string, Venue>,
  teams: Record<string, Team>,
  mode: 'continue' | 'fresh',
  rnd: () => number = Math.random,
): SimRun {
  const results: Record<string, SimScore> = {}
  const vCountry = (m: Match) => (m.venueId ? venues[m.venueId]?.country : undefined)

  // 1. group stage
  const groupMatches = matches.filter((m) => m.stage === 'group')
  for (const m of groupMatches) {
    if (!m.home || !m.away) continue
    if (mode === 'continue' && m.status === 'finished' && m.home.score != null && m.away.score != null) {
      results[m.id] = {
        h: m.home.score,
        a: m.away.score,
        homeCode: m.home.code,
        awayCode: m.away.code,
        winner: m.home.score > m.away.score ? m.home.code : m.away.score > m.home.score ? m.away.code : '',
        simulated: false,
      }
    } else {
      results[m.id] = {
        ...simulateMatch(model, m.home.code, m.away.code, vCountry(m), false, rnd),
        homeCode: m.home.code,
        awayCode: m.away.code,
      }
    }
  }

  const groups: Record<string, string[]> = {}
  for (const t of Object.values(teams)) {
    groups[t.group] ??= []
    groups[t.group].push(t.code)
  }
  const groupTables: Record<string, GroupRow[]> = {}
  for (const [g, codes] of Object.entries(groups)) {
    const rs = groupMatches
      .filter((m) => m.group === g && m.home && m.away && results[m.id])
      .map((m) => {
        const r = results[m.id]
        if (!m.home || !m.away) throw new Error('unreachable')
        return { h: m.home.code, a: m.away.code, gh: r.h, ga: r.a }
      })
    groupTables[g] = tableFor(codes, rs)
  }

  // 2. best thirds: top 8 of 12 by pts/gd/gf
  const thirdRows = Object.entries(groupTables).map(([g, t]) => ({ group: g, row: t[2] }))
  thirdRows.sort((x, y) => y.row.pts - x.row.pts || y.row.gd - x.row.gd || y.row.gf - x.row.gf)
  const qualifiedThirds = new Set(thirdRows.slice(0, 8).map((t) => t.group))

  // 3. knockout: resolve placeholders match-number order; thirds need a
  //    constraint-satisfying assignment (each slot lists its allowed groups)
  const ko = matches.filter((m) => m.stage !== 'group').sort((a, b) => a.n - b.n)
  const posOf = (g: string, idx: number) => groupTables[g]?.[idx]?.code
  const thirdSlots = ko
    .flatMap((m) => [m.phA, m.phB])
    .filter((ph): ph is string => !!ph && /^3[A-L]{2,}$/.test(ph))
  const assignment = assignThirds(
    thirdSlots.map((ph) => ph.slice(1).split('')),
    [...qualifiedThirds],
  )
  const thirdBySlot = new Map<string, string>()
  thirdSlots.forEach((ph, i) => {
    const g = assignment[i]
    if (g) thirdBySlot.set(ph, g)
  })

  const winners = new Map<number, string>()
  const losers = new Map<number, string>()
  const resolve = (ph: string | null): string | undefined => {
    if (!ph) return undefined
    let m = /^([1-4])([A-L])$/.exec(ph)
    if (m) return posOf(m[2], Number(m[1]) - 1)
    m = /^W(\d+)$/.exec(ph)
    if (m) return winners.get(Number(m[1]))
    m = /^(?:L|RU)(\d+)$/.exec(ph)
    if (m) return losers.get(Number(m[1]))
    if (/^3[A-L]{2,}$/.test(ph)) {
      const g = thirdBySlot.get(ph)
      return g ? posOf(g, 2) : undefined
    }
    return undefined
  }

  let champion = ''
  let runnerUp = ''
  let third = ''
  let fourth = ''
  for (const m of ko) {
    const home = m.home?.code ?? resolve(m.phA)
    const away = m.away?.code ?? resolve(m.phB)
    if (!home || !away) continue
    let r: SimScore
    if (mode === 'continue' && m.status === 'finished' && m.home?.score != null && m.away?.score != null) {
      const win =
        m.winner ??
        ((m.home.pen ?? 0) > (m.away.pen ?? 0)
          ? m.home.code
          : (m.away.pen ?? 0) > (m.home.pen ?? 0)
            ? m.away.code
            : m.home.score > m.away.score
              ? m.home.code
              : m.away.code)
      r = { h: m.home.score, a: m.away.score, homeCode: home, awayCode: away, winner: win, simulated: false }
    } else {
      r = { ...simulateMatch(model, home, away, vCountry(m), true, rnd), homeCode: home, awayCode: away }
    }
    results[m.id] = r
    winners.set(m.n, r.winner)
    losers.set(m.n, r.winner === home ? away : home)
    if (m.stage === 'final') {
      champion = r.winner
      runnerUp = r.winner === home ? away : home
    }
    if (m.stage === 'third') {
      third = r.winner
      fourth = r.winner === home ? away : home
    }
  }

  return {
    results,
    groupTables,
    thirds: thirdRows.map((t) => ({
      code: t.row.code,
      group: t.group,
      qualifies: qualifiedThirds.has(t.group),
    })),
    champion,
    runnerUp,
    third,
    fourth,
  }
}

/** backtracking assignment of qualified third-place groups to bracket slots */
export function assignThirds(slotAllowed: string[][], qualified: string[]): (string | null)[] {
  const n = slotAllowed.length
  const used = new Set<string>()
  const out: (string | null)[] = Array(n).fill(null)
  // most-constrained-first ordering
  const order = slotAllowed
    .map((allowed, i) => ({ i, allowed }))
    .sort(
      (x, y) =>
        x.allowed.filter((g) => qualified.includes(g)).length -
        y.allowed.filter((g) => qualified.includes(g)).length,
    )
  const bt = (k: number): boolean => {
    if (k === n) return true
    const { i, allowed } = order[k]
    for (const g of allowed) {
      if (!qualified.includes(g) || used.has(g)) continue
      used.add(g)
      out[i] = g
      if (bt(k + 1)) return true
      used.delete(g)
      out[i] = null
    }
    return false
  }
  bt(0)
  return out
}
