// Progressive bracket resolution: fill knockout slots the moment they are
// mathematically determined by the standings, without waiting for the data
// feed to assign teams (group winners/runners-up per completed group; best
// thirds once all twelve groups are complete; W/L/RU once a match finished).
import type { Match, Standings } from '../types'
import { assignThirds } from '../sim/engine'

export type SlotOverlay = Record<string, { home?: string; away?: string }>

export function resolvedSlots(matches: Match[], standings: Standings): SlotOverlay {
  const out: SlotOverlay = {}
  const ko = matches.filter((m) => m.stage !== 'group').sort((a, b) => a.n - b.n)

  const posOf = (g: string, idx: number): string | undefined =>
    standings.complete[g] ? standings.groups[g]?.find((r) => r.rank === idx + 1)?.code : undefined

  const winners = new Map<number, string>()
  const losers = new Map<number, string>()
  for (const m of ko) {
    if (m.status !== 'finished' || !m.home || !m.away) continue
    const win =
      m.winner ??
      ((m.home.pen ?? 0) !== (m.away.pen ?? 0)
        ? (m.home.pen ?? 0) > (m.away.pen ?? 0)
          ? m.home.code
          : m.away.code
        : (m.home.score ?? 0) > (m.away.score ?? 0)
          ? m.home.code
          : m.away.code)
    winners.set(m.n, win)
    losers.set(m.n, win === m.home.code ? m.away.code : m.home.code)
  }

  // best-thirds slots are only determinate once every group is complete
  const allDone =
    Object.keys(standings.complete).length >= 12 && Object.values(standings.complete).every(Boolean)
  const thirdBySlot = new Map<string, string>()
  if (allDone) {
    const qualified = standings.thirds.filter((t) => t.thirdRank <= 8).map((t) => t.group)
    const slots = ko
      .flatMap((m) => [m.phA, m.phB])
      .filter((ph): ph is string => !!ph && /^3[A-L]{2,}$/.test(ph))
    const assigned = assignThirds(
      slots.map((ph) => ph.slice(1).split('')),
      qualified,
    )
    slots.forEach((ph, i) => {
      const g = assigned[i]
      if (g) thirdBySlot.set(ph, g)
    })
  }

  const resolve = (ph: string | null): string | undefined => {
    if (!ph) return undefined
    let m = /^([1-2])([A-L])$/.exec(ph)
    if (m) return posOf(m[2], Number(m[1]) - 1)
    m = /^W(\d+)$/.exec(ph)
    if (m) return winners.get(Number(m[1]))
    m = /^(?:L|RU)(\d+)$/.exec(ph)
    if (m) return losers.get(Number(m[1]))
    if (/^3[A-L]{2,}$/.test(ph)) {
      const g = thirdBySlot.get(ph)
      return g && standings.complete[g] ? standings.groups[g]?.find((r) => r.rank === 3)?.code : undefined
    }
    return undefined
  }

  for (const m of ko) {
    const home = m.home ? undefined : resolve(m.phA)
    const away = m.away ? undefined : resolve(m.phB)
    if (home || away) out[m.id] = { home, away }
  }
  return out
}
