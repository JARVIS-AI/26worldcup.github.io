import { useState } from 'react'
import type { Team } from '../types'
import { flagSrc } from '../utils/helpers'

interface FlagProps {
  team?: Team | null
  iso2?: string | null
  /** explicit image URL tried first (e.g. a historical flag); falls back to iso2 */
  url?: string | null
  /** tooltip text (e.g. the country name when it isn't shown alongside) */
  title?: string
  size?: number
  className?: string
  alt?: string
  /** show at the flag's true aspect ratio (fixed height, natural width) instead of
   *  the default 4:3 letterboxed slot — for showcasing a flag (e.g. the podium) */
  natural?: boolean
}

/**
 * Country flag, letterboxed into a 4:3 slot at its official aspect ratio
 * (object-fit: contain — square or 2:1 flags are never cropped).
 * Fallback chain: explicit url → local /flags/ file → flagcdn → FIFA picture API.
 */
export default function Flag({
  team,
  iso2,
  url,
  title,
  size = 22,
  className = '',
  alt = '',
  natural = false,
}: FlagProps) {
  // src is derived from props each render; only failed URLs live in state, so a
  // reused component instance can never show the previous country's flag
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set())
  const code = team?.iso2 ?? iso2 ?? null
  const h = Math.round(size * 0.75)
  // natural: pin the height, let the width follow the flag's real ratio (no letterbox)
  const box = natural ? { height: h } : { width: size, height: h }

  const candidates: string[] = []
  if (url) candidates.push(url)
  if (code) {
    candidates.push(flagSrc(code), flagSrc(code, true))
  }
  if (team?.flag) candidates.push(team.flag)
  const src = candidates.find((u) => !failed.has(u)) ?? null

  if (!src) return <span className="flag" style={box} title={title} />
  return (
    <img
      className={`flag ${className}`}
      src={src}
      height={h}
      {...(natural ? {} : { width: size })}
      style={box}
      alt={alt}
      title={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed((prev) => new Set(prev).add(src))}
    />
  )
}
