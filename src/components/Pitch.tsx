import type { LineupPlayer, TeamLineup } from '../types'

interface PitchProps {
  home: TeamLineup | null
  away: TeamLineup | null
  homeName: string
  awayName: string
  /** FIFA codes, used to link each team label to /team/<code> */
  homeCode?: string
  awayCode?: string
  /** flag image URLs shown before each team label */
  homeFlag?: string
  awayFlag?: string
  marks?: Record<string, { card?: 'y' | 'r' }>
  /** player id -> minute they were substituted off (shown under the XI name) */
  subOff?: Record<string, string>
  /** player id -> goal minutes string, e.g. "5', 90'" (shown under the XI name) */
  goals?: Record<string, string>
}

interface Placed {
  p: LineupPlayer
  x: number
  y: number
}

const LINE = 'var(--pitch-line)'

const COLORS = {
  home: { dot: '#f7f8fc', text: '#131722' },
  away: { dot: '#172445', text: '#ffffff' },
} as const

const lineStyle = { fill: 'none', stroke: LINE, strokeWidth: 0.7 } as const

function shortName(name: string | null): string {
  if (!name) return ''
  const n = name.trim()
  if (n.length <= 12) return n
  const parts = n.split(/\s+/)
  const last = parts[parts.length - 1]
  if (last.length <= 12) return last
  return `${last.slice(0, 11)}…`
}

/** parse a tactics string like '4-2-3-1' into row sizes summing to n, with a safe fallback */
function parseRows(tactics: string | null, n: number): number[] {
  if (n <= 0) return []
  const parsed = (tactics || '')
    .split(/[^0-9]+/)
    .map((s) => parseInt(s, 10))
    .filter((v) => Number.isFinite(v) && v > 0)
  if (parsed.length && parsed.reduce((a, b) => a + b, 0) === n) return parsed
  const rows: number[] = []
  let left = n
  while (left > 0) {
    const k = Math.min(4, left)
    rows.push(k)
    left -= k
  }
  return rows
}

/** place a starting XI on one half of the pitch (viewBox coords) */
function layout(tl: TeamLineup, half: 'top' | 'bottom'): Placed[] {
  const xi = tl.xi
  if (!xi.length) return []
  const sorted = xi.slice().sort((a, b) => (a.fieldPos ?? 99) - (b.fieldPos ?? 99))
  const gk = sorted.find((p) => p.gk) ?? sorted[0]
  const field = sorted.filter((p) => p !== gk)
  const rows = parseRows(tl.tactics, field.length)
  const out: Placed[] = [{ p: gk, x: 50, y: half === 'bottom' ? 144 : 20 }]
  const yFrom = half === 'bottom' ? 130 : 34 // defenders, near own goal
  const yTo = half === 'bottom' ? 92 : 72 // attackers, near halfway line
  let idx = 0
  rows.forEach((count, ri) => {
    const y = rows.length === 1 ? (yFrom + yTo) / 2 : yFrom + (ri * (yTo - yFrom)) / (rows.length - 1)
    for (let j = 0; j < count && idx < field.length; j++, idx++) {
      let x = (100 * (j + 1)) / (count + 1)
      if (half === 'top') x = 100 - x // mirror the away side, broadcast-style
      out.push({ p: field[idx], x, y })
    }
  })
  return out
}

// Dots and labels are drawn in two separate passes (all dots, then all labels)
// so a player's annotation text below the dot is never covered by a neighbouring
// player's dot painted later in document order.
function PlayerMarks({ pl, side, card }: { pl: Placed; side: 'home' | 'away'; card?: 'y' | 'r' }) {
  const c = COLORS[side]
  return (
    <g transform={`translate(${pl.x} ${pl.y})`}>
      <circle r={4.3} style={{ fill: c.dot, stroke: 'rgb(0 0 0 / 0.35)', strokeWidth: 0.5 }} />
      {card && (
        <rect
          x={-5.8}
          y={-5.8}
          width={2.3}
          height={3.2}
          rx={0.5}
          style={{
            fill: card === 'r' ? '#d92d20' : '#f3c513',
            stroke: 'rgb(0 0 0 / 0.35)',
            strokeWidth: 0.3,
          }}
        />
      )}
      {pl.p.captain && (
        <circle
          cx={3.5}
          cy={-3.5}
          r={1.9}
          style={{ fill: '#d4a017', stroke: 'rgb(0 0 0 / 0.3)', strokeWidth: 0.35 }}
        />
      )}
    </g>
  )
}

function PlayerLabels({
  pl,
  side,
  off,
  goals,
  code,
}: {
  pl: Placed
  side: 'home' | 'away'
  off?: string
  goals?: string
  code?: string
}) {
  const c = COLORS[side]
  const href = code && pl.p.number != null ? `#/team/${code}?p=${pl.p.number}` : null
  // annotation lines stacked under the name: goals (⚽) then sub-off (↓)
  const notes = [
    goals ? { text: `⚽ ${goals}`, fill: '#ffffff' } : null,
    off ? { text: `↓ ${off}`, fill: '#ff9d9d' } : null,
  ].filter((n): n is { text: string; fill: string } => n !== null)
  const nameText = (
    <text
      textAnchor="middle"
      y={7.9}
      style={{
        fontSize: 2.4,
        fontWeight: 650,
        fill: '#ffffff',
        paintOrder: 'stroke',
        stroke: 'rgb(0 0 0 / 0.5)',
        strokeWidth: 0.5,
        cursor: href ? 'pointer' : undefined,
      }}
    >
      {shortName(pl.p.name)}
    </text>
  )
  return (
    <g transform={`translate(${pl.x} ${pl.y})`}>
      {pl.p.number !== null && (
        <text textAnchor="middle" y={1.45} style={{ fontSize: 3.6, fontWeight: 750, fill: c.text }}>
          {pl.p.number}
        </text>
      )}
      {pl.p.captain && (
        <text
          textAnchor="middle"
          x={3.5}
          y={-2.55}
          style={{ fontSize: 2.4, fontWeight: 800, fill: '#ffffff' }}
        >
          C
        </text>
      )}
      {href ? (
        <a href={href} aria-label={pl.p.name ?? undefined}>
          {nameText}
        </a>
      ) : (
        nameText
      )}
      {notes.map((n, i) => (
        <text
          key={n.text}
          textAnchor="middle"
          y={10.8 + i * 2.9}
          style={{
            fontSize: 2.1,
            fontWeight: 700,
            fill: n.fill,
            paintOrder: 'stroke',
            stroke: 'rgb(0 0 0 / 0.55)',
            strokeWidth: 0.45,
          }}
        >
          {n.text}
        </text>
      ))}
    </g>
  )
}

/** team label row: color dot + flag + name (· tactics), linking to /team/<code> */
function TeamLabel({
  side,
  cy,
  textY,
  name,
  tactics,
  code,
  flag,
}: {
  side: 'home' | 'away'
  cy: number
  textY: number
  name: string
  tactics?: string | null
  code?: string
  flag?: string
}) {
  const flagX = 7.2
  const flagW = 5
  const flagH = 3.75
  const textX = flag ? flagX + flagW + 0.8 : 8.6
  const body = (
    <>
      <circle
        cx={4.8}
        cy={cy}
        r={1.9}
        style={{ fill: COLORS[side].dot, stroke: 'rgb(0 0 0 / 0.25)', strokeWidth: 0.4 }}
      />
      {flag && (
        <image
          href={flag}
          x={flagX}
          y={cy - flagH / 2}
          width={flagW}
          height={flagH}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text x={textX} y={textY} style={{ fontSize: 3.8, fontWeight: 700, fill: 'var(--text)' }}>
        {name}
        {tactics ? `  ·  ${tactics}` : ''}
      </text>
    </>
  )
  return code ? (
    <a href={`#/team/${code}`} aria-label={name} style={{ cursor: 'pointer' }}>
      {body}
    </a>
  ) : (
    <g>{body}</g>
  )
}

/** vertical football pitch with both starting XIs placed by tactics; pure SVG, responsive */
export default function Pitch({
  home,
  away,
  homeName,
  awayName,
  homeCode,
  awayCode,
  homeFlag,
  awayFlag,
  marks,
  subOff,
  goals,
}: PitchProps) {
  const homePlaced = home ? layout(home, 'bottom') : []
  const awayPlaced = away ? layout(away, 'top') : []
  if (!homePlaced.length && !awayPlaced.length) return null

  return (
    <svg
      viewBox="0 0 100 164"
      role="img"
      aria-label={`${homeName} – ${awayName}`}
      style={{ width: '100%', maxWidth: 460, height: 'auto', display: 'block', margin: '0 auto' }}
    >
      {/* team label: away (top half) */}
      <TeamLabel
        side="away"
        cy={4.6}
        textY={6}
        name={awayName}
        tactics={away?.tactics}
        code={awayCode}
        flag={awayFlag}
      />

      {/* turf */}
      <rect x={0} y={8} width={100} height={148} rx={2} style={{ fill: 'var(--pitch)' }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={0}
          y={11 + i * 28.4}
          width={100}
          height={14.2}
          style={{ fill: 'rgb(255 255 255 / 0.045)' }}
        />
      ))}

      {/* markings */}
      <rect x={3} y={11} width={94} height={142} style={lineStyle} />
      <line x1={3} y1={82} x2={97} y2={82} style={lineStyle} />
      <circle cx={50} cy={82} r={11.5} style={lineStyle} />
      <circle cx={50} cy={82} r={0.9} style={{ fill: LINE }} />
      {/* penalty + goal areas (top) */}
      <rect x={22} y={11} width={56} height={21} style={lineStyle} />
      <rect x={37} y={11} width={26} height={7} style={lineStyle} />
      <circle cx={50} cy={26} r={0.9} style={{ fill: LINE }} />
      <path d="M 40.2 32 A 11.5 11.5 0 0 0 59.8 32" style={lineStyle} />
      {/* penalty + goal areas (bottom) */}
      <rect x={22} y={132} width={56} height={21} style={lineStyle} />
      <rect x={37} y={146} width={26} height={7} style={lineStyle} />
      <circle cx={50} cy={138} r={0.9} style={{ fill: LINE }} />
      <path d="M 40.2 132 A 11.5 11.5 0 0 1 59.8 132" style={lineStyle} />
      {/* goals */}
      <rect x={45.6} y={8.8} width={8.8} height={2.2} style={lineStyle} />
      <rect x={45.6} y={153} width={8.8} height={2.2} style={lineStyle} />
      {/* corner arcs */}
      <path d="M 3 13.5 A 2.5 2.5 0 0 0 5.5 11" style={lineStyle} />
      <path d="M 94.5 11 A 2.5 2.5 0 0 0 97 13.5" style={lineStyle} />
      <path d="M 5.5 153 A 2.5 2.5 0 0 0 3 150.5" style={lineStyle} />
      <path d="M 97 150.5 A 2.5 2.5 0 0 0 94.5 153" style={lineStyle} />

      {/* players: all dots first, then all labels on top so no text is covered by a dot */}
      {awayPlaced.map((pl) => (
        <PlayerMarks key={pl.p.id} pl={pl} side="away" card={marks?.[pl.p.id]?.card} />
      ))}
      {homePlaced.map((pl) => (
        <PlayerMarks key={pl.p.id} pl={pl} side="home" card={marks?.[pl.p.id]?.card} />
      ))}
      {awayPlaced.map((pl) => (
        <PlayerLabels
          key={pl.p.id}
          pl={pl}
          side="away"
          off={subOff?.[pl.p.id]}
          goals={goals?.[pl.p.id]}
          code={awayCode}
        />
      ))}
      {homePlaced.map((pl) => (
        <PlayerLabels
          key={pl.p.id}
          pl={pl}
          side="home"
          off={subOff?.[pl.p.id]}
          goals={goals?.[pl.p.id]}
          code={homeCode}
        />
      ))}

      {/* team label: home (bottom half) */}
      <TeamLabel
        side="home"
        cy={159.4}
        textY={160.8}
        name={homeName}
        tactics={home?.tactics}
        code={homeCode}
        flag={homeFlag}
      />
    </svg>
  )
}
