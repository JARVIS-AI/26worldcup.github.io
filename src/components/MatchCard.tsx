import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { Match, MatchSide } from '../types'
import { useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData } from '../data/DataContext'
import { displayTz, fmtDate, fmtTime } from '../utils/time'
import { placeholderLabel, STAGE_LABEL_KEY, wmoEmoji } from '../utils/helpers'
import Flag from './Flag'

interface MatchCardProps {
  match: Match
  /** hide the date inside the when-block (e.g. when shown under a day header) */
  hideDate?: boolean
  showWeather?: boolean
}

function SideRow({
  m,
  side,
  other,
  ph,
}: {
  m: Match
  side: MatchSide | null
  other: MatchSide | null
  ph: string | null
}) {
  const { t, pick } = useI18n()
  const { teams } = useAppData()
  const finished = m.status === 'finished'
  const team = side ? teams[side.code] : null
  const isLoser =
    finished &&
    side &&
    other &&
    (m.winner ? m.winner !== side.code && m.winner === other.code : (side.score ?? 0) < (other.score ?? 0))
  return (
    <div className={`mc-row${isLoser ? ' loser' : ''}`}>
      {team ? (
        <>
          <Flag team={team} size={24} />
          <span className="nm">{pick(team.name, side?.code)}</span>
        </>
      ) : (
        <>
          <Flag size={24} />
          <span className="nm tbd">{ph ? placeholderLabel(ph, t) : t('tbd')}</span>
        </>
      )}
      {(m.status === 'finished' || m.status === 'live') && side && (
        <span className="score">
          {side.score ?? '–'}
          {(m.home?.pen ?? 0) + (m.away?.pen ?? 0) > 0 && <small className="muted"> ({side.pen ?? 0})</small>}
        </span>
      )}
    </div>
  )
}

/** memoized: match objects are stable references from data.matches, so filter
 * interactions on list pages skip re-rendering the ~100 unchanged cards
 * (i18n/settings changes still propagate via context) */
function MatchCard({ match: m, hideDate = false, showWeather = false }: MatchCardProps) {
  const { t, pick, locale } = useI18n()
  const { settings } = useSettings()
  const { venues, weather } = useAppData()
  const venue = m.venueId ? venues[m.venueId] : null
  const tz = displayTz(settings, venue)
  const w = showWeather ? weather[m.id] : undefined

  return (
    <Link to={`/match/${m.id}`} className={`match-card${m.status === 'live' ? ' live' : ''}`}>
      <div className="mc-top">
        <span>{t('matchN', { n: m.n })}</span>
        <span className="chip">
          {m.stage === 'group' && m.group ? t('groupX', { x: m.group }) : t(STAGE_LABEL_KEY[m.stage])}
        </span>
        {venue && <span>{pick(venue.cityName, venue.city)}</span>}
        <span className="spacer" />
        {w && (
          <span title={t('weatherForecast')}>
            {wmoEmoji(w.code)} {Math.round(w.tC)}°C
          </span>
        )}
        {m.status === 'live' && <span className="chip chip-live">{t('statusLive')}</span>}
      </div>
      <div className="mc-mid">
        <div className="mc-teams">
          <SideRow m={m} side={m.home} other={m.away} ph={m.phA} />
          <SideRow m={m} side={m.away} other={m.home} ph={m.phB} />
        </div>
        <div className="mc-when">
          {m.status === 'finished' ? (
            <div className="st">{t('statusFinished')}</div>
          ) : m.status === 'live' ? (
            <div className="st">{t('statusLive')}</div>
          ) : (
            <div className="tm">{fmtTime(m.date, locale, tz)}</div>
          )}
          {!hideDate && <div className="dt">{fmtDate(m.date, locale, tz)}</div>}
        </div>
      </div>
    </Link>
  )
}

export default memo(MatchCard)
