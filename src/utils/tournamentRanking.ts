// Final tournament standing (the FIFA "Tournament ranking"). Positions 1–4 come
// from the final and the third-place play-off; every other team is ranked by the
// round it went out in, and teams that went out in the same round are separated by
// the group-stage tie-breakers (points, goal difference, goals for, fair play).
//
// The tournament is scored live: rounds already complete give fixed positions
// (5th downward), while teams still contesting the last four sit in provisional
// bands at the top until their matches are played.
import type { Match, Team } from '../types'

export type RankBand =
  // settled top four
  | 'champion'
  | 'runnerUp'
  | 'third'
  | 'fourth'
  // provisional (still competing for the top four)
  | 'final'
  | 'sf'
  | 'thirdPlay'
  // eliminated
  | 'qf'
  | 'r16'
  | 'r32'
  | 'group'

export interface RankRow {
  code: string
  group: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  band: RankBand
  /** final position, or null while the band is still provisional */
  pos: number | null
  provisional: boolean
}

// best-first order of the bands. Provisional bands are interleaved so a team that
// has reached the final outranks one still in a semi-final, which outranks one
// already dropped into the third-place play-off.
const BAND_ORDER: RankBand[] = [
  'champion',
  'final',
  'runnerUp',
  'sf',
  'third',
  'thirdPlay',
  'fourth',
  'qf',
  'r16',
  'r32',
  'group',
]
const BAND_IDX = Object.fromEntries(BAND_ORDER.map((b, i) => [b, i])) as Record<RankBand, number>
const PROVISIONAL = new Set<RankBand>(['final', 'sf', 'thirdPlay'])

type Tally = Pick<RankRow, 'p' | 'w' | 'd' | 'l' | 'gf' | 'ga' | 'gd' | 'pts'>

/** winner of a finished knockout match: FIFA's result if given, else penalties, else score */
function koWinner(m: Match): string | null {
  if (m.winner) return m.winner
  if (!m.home || !m.away) return null
  const hp = m.home.pen ?? 0
  const ap = m.away.pen ?? 0
  if (hp !== ap) return hp > ap ? m.home.code : m.away.code
  const hs = m.home.score ?? 0
  const as = m.away.score ?? 0
  return hs > as ? m.home.code : as > hs ? m.away.code : null
}

const koLoser = (m: Match, win: string | null): string | null =>
  !win || !m.home || !m.away ? null : win === m.home.code ? m.away.code : m.home.code

/** win/draw/loss + goals over every finished match a team played. Statistical
 *  convention: extra-time results are wins/losses, penalty shoot-outs are draws —
 *  so comparing the recorded (shoot-out-excluded) score is exactly right. */
function tallies(matches: Match[], teams: Record<string, Team>): Record<string, Tally> {
  const rec: Record<string, Tally> = {}
  for (const code of Object.keys(teams)) rec[code] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
  for (const m of matches) {
    if (m.status !== 'finished' || !m.home || !m.away) continue
    const hs = m.home.score
    const as = m.away.score
    if (hs == null || as == null) continue
    const H = rec[m.home.code]
    const A = rec[m.away.code]
    if (!H || !A) continue
    H.p++
    A.p++
    H.gf += hs
    H.ga += as
    A.gf += as
    A.ga += hs
    if (hs === as) {
      H.d++
      A.d++
      H.pts++
      A.pts++
    } else if (hs > as) {
      H.w++
      A.l++
      H.pts += 3
    } else {
      A.w++
      H.l++
      A.pts += 3
    }
  }
  for (const r of Object.values(rec)) r.gd = r.gf - r.ga
  return rec
}

/**
 * Rank all teams for the final tournament standing, or null while it is not yet
 * meaningful (i.e. before the last four are known — until then positions 5..48 are
 * not fixed). `fairPlay` is the per-team all-matches conduct score (0 best).
 */
export function tournamentRanking(
  matches: Match[],
  teams: Record<string, Team>,
  fairPlay?: Record<string, number>,
): RankRow[] | null {
  const ko = matches.filter((m) => m.stage !== 'group')
  const qf = ko.filter((m) => m.stage === 'qf')
  // only meaningful once every quarter-final is done: exactly four teams then
  // occupy positions 1..4 and every other team has a definite elimination round.
  if (qf.length === 0 || !qf.every((m) => m.status === 'finished')) return null

  const band: Record<string, RankBand> = {}
  const setIf = (code: string | null | undefined, b: RankBand) => {
    if (code && !band[code]) band[code] = b
  }
  const occupants = (m: Match | undefined): string[] =>
    m ? [m.home?.code, m.away?.code].filter((c): c is string => !!c) : []

  const finalM = ko.find((m) => m.stage === 'final')
  const thirdM = ko.find((m) => m.stage === 'third')

  // settled medals
  if (finalM?.status === 'finished') {
    const w = koWinner(finalM)
    setIf(w, 'champion')
    setIf(koLoser(finalM, w), 'runnerUp')
  }
  if (thirdM?.status === 'finished') {
    const w = koWinner(thirdM)
    setIf(w, 'third')
    setIf(koLoser(thirdM, w), 'fourth')
  }
  // provisional: teams already placed into an unplayed final / third-place play-off
  if (finalM && finalM.status !== 'finished') for (const c of occupants(finalM)) setIf(c, 'final')
  if (thirdM && thirdM.status !== 'finished') for (const c of occupants(thirdM)) setIf(c, 'thirdPlay')
  // provisional: teams still contesting an unplayed semi-final
  for (const m of ko)
    if (m.stage === 'sf' && m.status !== 'finished') for (const c of occupants(m)) setIf(c, 'sf')
  // eliminated: losers of the completed knockout rounds
  for (const m of ko) {
    if (m.status !== 'finished') continue
    if (m.stage === 'qf' || m.stage === 'r16' || m.stage === 'r32') setIf(koLoser(m, koWinner(m)), m.stage)
  }
  // everyone not otherwise placed went out in the group stage
  for (const code of Object.keys(teams)) setIf(code, 'group')

  const rec = tallies(matches, teams)
  const fp = (c: string) => fairPlay?.[c] ?? 0
  const rows = Object.values(teams).map((tm) => ({
    code: tm.code,
    group: tm.group,
    ...rec[tm.code],
    band: band[tm.code],
  }))
  rows.sort(
    (a, b) =>
      BAND_IDX[a.band] - BAND_IDX[b.band] ||
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      fp(b.code) - fp(a.code) ||
      a.code.localeCompare(b.code),
  )
  return rows.map((r, i) => {
    const provisional = PROVISIONAL.has(r.band)
    return { ...r, provisional, pos: provisional ? null : i + 1 }
  })
}
