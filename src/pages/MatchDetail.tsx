import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Lang, MatchSide, Official, TeamLineup } from '../types'
import { DATA_FALLBACK, useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData } from '../data/DataContext'
import { dayKey, displayTz, fmtDateLong, fmtDateTime, fmtTime, tzAbbr } from '../utils/time'
import {
  detectMarket,
  fifaToIso2,
  fmtSpeed,
  fmtTemp,
  localizedNote,
  placeholderLabel,
  STAGE_LABEL_KEY,
  wmoEmoji,
  wmoKey,
} from '../utils/helpers'
import Flag from '../components/Flag'
import Icon from '../components/Icon'
import MapLinks from '../components/MapLinks'
import MatchCard from '../components/MatchCard'
import Pitch from '../components/Pitch'
import './matchdetail.css'

const ROLE_KEY: Record<string, string> = {
  referee: 'roleReferee',
  ar1: 'roleAr1',
  ar2: 'roleAr2',
  fourth: 'roleFourth',
  var: 'roleVar',
  avar: 'roleAvar',
  avar1: 'roleAvar',
  avar2: 'roleAvar',
}

const HOST_KEY: Record<'US' | 'CA' | 'MX', string> = { US: 'hostUS', CA: 'hostCA', MX: 'hostMX' }

const ROOF_KEY: Record<string, string> = {
  open: 'roofOpen',
  canopy: 'roofCanopy',
  retractable: 'roofRetractable',
  fixed: 'roofFixed',
}

function HeroSide({ side, ph }: { side: MatchSide | null; ph: string | null }) {
  const { t, pick } = useI18n()
  const { teams } = useAppData()
  const team = side ? teams[side.code] : null
  if (team && side) {
    return (
      <Link to={`/team/${side.code}`} className="md-side">
        <Flag team={team} size={44} />
        <span className="md-side-name">{pick(team.name, side.code)}</span>
      </Link>
    )
  }
  return (
    <div className="md-side">
      <Flag size={44} />
      <span className="md-side-name md-tbd">{ph ? placeholderLabel(ph, t) : t('tbd')}</span>
    </div>
  )
}

interface GoalRow {
  key: string
  minute: string | null
  name: string
  code: string | null
  own: boolean
  pen: boolean
}

export default function MatchDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, pick, countryName, locale, lang } = useI18n()
  // FIFA localizes typeName in 12 languages; for the rest prefer our dictionary
  // role names over typeName's English fallback
  const officialLabel = (o: Official) =>
    o.typeName[lang] ??
    (DATA_FALLBACK[lang] ? o.typeName[DATA_FALLBACK[lang] as Lang] : null) ??
    (ROLE_KEY[o.role] ? t(ROLE_KEY[o.role]) : null) ??
    o.typeName.en ??
    o.role
  const { settings } = useSettings()
  const { matches, teams, venues, weather, lineups, broadcasters, probs } = useAppData()
  const [showProbPast, setShowProbPast] = useState(false)

  const m = matches.find((x) => x.id === id)
  const venue = m?.venueId ? (venues[m.venueId] ?? null) : null
  const lu = m ? lineups[m.id] : undefined

  /* market for the watch teaser — shared app-wide via Settings */
  const market = useMemo(() => {
    const markets = broadcasters?.markets
    if (!markets?.length) return null
    const codes = new Set(markets.map((mk) => mk.iso2))
    const want = settings.market && codes.has(settings.market) ? settings.market : detectMarket(codes)
    return markets.find((mk) => mk.iso2 === want) ?? markets[0]
  }, [broadcasters, settings.market])

  /* other matches of this tournament between the same two teams (knockout rematches) */
  const h2h = useMemo(() => {
    if (!m?.home || !m.away) return []
    const a = m.home.code
    const b = m.away.code
    return matches.filter(
      (x) =>
        x.id !== m.id &&
        x.home !== null &&
        x.away !== null &&
        ((x.home.code === a && x.away.code === b) || (x.home.code === b && x.away.code === a)),
    )
  }, [matches, m])

  const goalRows = useMemo<GoalRow[]>(() => {
    if (!m || !lu) return []
    const rows: GoalRow[] = []
    const collect = (tl: TeamLineup | null, code: string | null) => {
      if (!tl) return
      const all = [...tl.xi, ...tl.subs]
      tl.goals.forEach((g, i) => {
        if (g.period === 11) return // shootout kicks are not goals
        const p = all.find((x) => x.id === g.player)
        rows.push({
          key: `${code ?? 'x'}-${i}`,
          minute: g.minute,
          name: p?.name || g.player,
          code,
          own: g.type === 3,
          pen: g.type === 1,
        })
      })
    }
    collect(lu.home, m.home?.code ?? null)
    collect(lu.away, m.away?.code ?? null)
    return rows.sort((a, b) => (parseInt(a.minute || '0', 10) || 0) - (parseInt(b.minute || '0', 10) || 0))
  }, [lu, m])

  // red cards (incl. second yellow) shown under the score; card marks for the
  // pitch dots; substitution minutes for the bench list
  const cardInfo = useMemo(() => {
    const reds: GoalRow[] = []
    const marks: Record<string, { card?: 'y' | 'r' }> = {}
    const subOn: Record<string, string> = {}
    const sides: [TeamLineup | null | undefined, string | null][] = [
      [lu?.home, m?.home?.code ?? null],
      [lu?.away, m?.away?.code ?? null],
    ]
    for (const [tl, code] of sides) {
      if (!tl) continue
      const all = [...tl.xi, ...tl.subs]
      tl.bookings.forEach((b, i) => {
        const red = (b.card ?? 0) >= 2
        marks[b.player] = { card: red ? 'r' : marks[b.player]?.card === 'r' ? 'r' : 'y' }
        if (red)
          reds.push({
            key: `r-${code ?? 'x'}-${i}`,
            minute: b.minute,
            name: all.find((x) => x.id === b.player)?.name || b.player,
            code,
            own: false,
            pen: false,
          })
      })
      for (const sub of tl.substitutions ?? []) if (sub.minute) subOn[sub.on] = sub.minute
    }
    reds.sort((a, b) => (parseInt(a.minute || '0', 10) || 0) - (parseInt(b.minute || '0', 10) || 0))
    return { reds, marks, subOn }
  }, [lu, m])
  const redRows = cardInfo.reds

  if (!m) {
    return (
      <div className="card">
        <div className="empty">
          <p>{t('matchNotFound')}</p>
          <Link className="btn" to="/">
            <Icon name="back" size={17} />
            {t('backToList')}
          </Link>
        </div>
      </div>
    )
  }

  const tz = displayTz(settings, venue)
  const w = weather[m.id]
  const showScore = m.status === 'live' || m.status === 'finished'
  const homeLabel = m.home
    ? pick(teams[m.home.code]?.name, m.home.code)
    : m.phA
      ? placeholderLabel(m.phA, t)
      : t('tbd')
  const awayLabel = m.away
    ? pick(teams[m.away.code]?.name, m.away.code)
    : m.phB
      ? placeholderLabel(m.phB, t)
      : t('tbd')
  const fifaName = venue ? pick(venue.fifaName) : ''
  const monthKey: 'jun' | 'jul' = dayKey(m.date, venue?.tz).slice(5, 7) === '07' ? 'jul' : 'jun'
  const clim = venue?.climate?.[monthKey]
  const hasLineups = Boolean(lu && (lu.home || lu.away))

  return (
    <div>
      <button type="button" className="btn md-back" onClick={() => navigate(-1)}>
        <Icon name="back" size={17} />
        {t('backToList')}
      </button>

      {/* ===== header card ===== */}
      <div className="card md-hero">
        <div className="md-hero-top">
          <span className={m.stage === 'final' ? 'chip chip-accent' : 'chip'}>
            {m.stage === 'group' && m.group ? t('groupX', { x: m.group }) : t(STAGE_LABEL_KEY[m.stage])}
          </span>
          <span>{t('matchN', { n: m.n })}</span>
          {m.status === 'live' && <span className="chip chip-live">{t('statusLive')}</span>}
          {m.status === 'finished' && <span className="chip">{t('statusFinished')}</span>}
          {m.status === 'postponed' && <span className="chip">{t('statusPostponed')}</span>}
        </div>

        <div className="md-hero-main">
          <HeroSide side={m.home} ph={m.phA} />
          <div className="md-score">
            {showScore && m.home && m.away ? (
              <>
                <div className="md-score-big tnum">
                  {m.home.score ?? '–'} : {m.away.score ?? '–'}
                </div>
                {(m.home.pen ?? 0) + (m.away.pen ?? 0) > 0 && (
                  <div className="md-pens small muted">
                    {t('pens')} {m.home.pen ?? 0}–{m.away.pen ?? 0}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="small muted">{t('kickoff')}</div>
                <div className="md-score-big md-time tnum">{fmtTime(m.date, locale, tz)}</div>
              </>
            )}
          </div>
          <HeroSide side={m.away} ph={m.phB} />
        </div>
        {showScore && goalRows.length > 0 && (
          <div className="md-scorers small">
            <div className="md-scorers-side">
              {goalRows
                .filter((g) => g.code === m.home?.code)
                .map((g) => (
                  <div key={g.key}>
                    {g.name} {g.minute}
                    {g.own && <span className="muted"> ({t('ownGoal')})</span>}
                    {g.pen && <span className="muted"> ({t('penaltyGoal')})</span>}
                  </div>
                ))}
            </div>
            <span className="md-scorers-ball" aria-hidden="true">
              ⚽
            </span>
            <div className="md-scorers-side away">
              {goalRows
                .filter((g) => g.code === m.away?.code)
                .map((g) => (
                  <div key={g.key}>
                    {g.name} {g.minute}
                    {g.own && <span className="muted"> ({t('ownGoal')})</span>}
                    {g.pen && <span className="muted"> ({t('penaltyGoal')})</span>}
                  </div>
                ))}
            </div>
          </div>
        )}
        {showScore && redRows.length > 0 && (
          <div className="md-scorers small">
            <div className="md-scorers-side">
              {redRows
                .filter((g) => g.code === m.home?.code)
                .map((g) => (
                  <div key={g.key}>
                    {g.name} {g.minute}
                  </div>
                ))}
            </div>
            <span className="md-scorers-ball" aria-hidden="true">
              🟥
            </span>
            <div className="md-scorers-side away">
              {redRows
                .filter((g) => g.code === m.away?.code)
                .map((g) => (
                  <div key={g.key}>
                    {g.name} {g.minute}
                  </div>
                ))}
            </div>
          </div>
        )}
        {m.status === 'live' && <p className="md-semilive small">{t('semiLiveNote')}</p>}
        {m.home && m.away && probs[m.id] && m.status !== 'scheduled' && (
          <button
            type="button"
            className="md-prob-show small"
            aria-expanded={showProbPast}
            onClick={() => setShowProbPast((v) => !v)}
          >
            {t(showProbPast ? 'probHide' : 'probShow')}
          </button>
        )}
        {m.home && m.away && probs[m.id] && (m.status === 'scheduled' || showProbPast) && (
          <div className="md-prob">
            <div className="md-prob-head small">
              <span>{t('probTitle')}</span>
            </div>
            <div
              className="md-prob-bar"
              role="img"
              aria-label={`${m.home.code} ${probs[m.id].h}% · ${t('probDraw')} ${probs[m.id].d}% · ${m.away.code} ${probs[m.id].a}%`}
            >
              <span className="md-prob-h" style={{ width: `${probs[m.id].h}%` }} />
              <span className="md-prob-d" style={{ width: `${probs[m.id].d}%` }} />
              <span className="md-prob-a" style={{ width: `${probs[m.id].a}%` }} />
            </div>
            <div className="md-prob-legend small tnum">
              <span>
                {m.home.code} {probs[m.id].h}%
              </span>
              <span>
                {t('probDraw')} {probs[m.id].d}%
              </span>
              <span>
                {m.away.code} {probs[m.id].a}%
              </span>
            </div>
            {probs[m.id].eh != null ? (
              <table className="md-prob-path small tnum">
                <thead>
                  <tr>
                    <td />
                    <th scope="col">{m.home.code}</th>
                    <th scope="col">{m.away.code}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{t('prob90')}</th>
                    <td>{probs[m.id].h}%</td>
                    <td>{probs[m.id].a}%</td>
                  </tr>
                  <tr>
                    <th scope="row">{t('probEt')}</th>
                    <td>+{probs[m.id].eh}%</td>
                    <td>+{probs[m.id].ea}%</td>
                  </tr>
                  <tr>
                    <th scope="row">{t('probPens')}</th>
                    <td>+{probs[m.id].ph}%</td>
                    <td>+{probs[m.id].pa}%</td>
                  </tr>
                  <tr className="md-prob-total">
                    <th scope="row">{t('probAdvance')}</th>
                    <td>{probs[m.id].ah}%</td>
                    <td>{100 - (probs[m.id].ah ?? 0)}%</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              probs[m.id].ah != null && (
                <div className="md-prob-adv small muted">
                  {t('probAdvance')}
                  {t('colon')}
                  {m.home.code} {probs[m.id].ah}% · {m.away.code} {100 - (probs[m.id].ah ?? 0)}%
                </div>
              )
            )}
            <p className="md-prob-note small muted">{t('probNote')}</p>
          </div>
        )}

        <div className="md-when">
          <Icon name="clock" size={15} />
          <span>
            {fmtDateLong(m.date, locale, tz)} · {fmtTime(m.date, locale, tz)} {tzAbbr(m.date, locale, tz)}
          </span>
        </div>
        {settings.tzMode !== 'venue' && venue && (
          <div className="md-when md-when-sub">
            <span>
              {t('localTime')}
              {fmtDateTime(m.date, locale, venue.tz)} ({tzAbbr(m.date, locale, venue.tz)})
            </span>
          </div>
        )}
      </div>

      {/* ===== info cards ===== */}
      <div className="md-grid">
        {venue && (
          <section className="card card-pad">
            <h3 className="md-info-title">
              <Icon name="stadium" size={18} />
              {t('venue')}
              <Link to={`/venues?venue=${m.venueId}`} className="md-cardlink">
                {t('navVenues')}
                <Icon name="external" size={13} />
              </Link>
            </h3>
            <div className="md-venue-name">
              {venue.realName}
              <MapLinks
                query={`${venue.realName}, ${venue.city}`}
                wiki={venue.wiki ? { url: venue.wiki.url, title: t('wikipedia') } : undefined}
              />
            </div>
            {fifaName && fifaName !== venue.realName && <div className="md-venue-sub">{fifaName}</div>}
            <div className="md-chips md-facts">
              <span className="chip">
                <Flag iso2={venue.country} size={16} />
                {pick(venue.cityName, venue.city)} · {t(HOST_KEY[venue.country])}
              </span>
              <span className="chip">{t('capacityK', { n: venue.capacity.toLocaleString(locale) })}</span>
              <span className="chip">{t(ROOF_KEY[venue.roof])}</span>
            </div>
            {m.attendance !== null && (
              <div className="md-rows">
                <div className="md-row">
                  <span className="lbl">{t('attendance')}</span>
                  <span className="val tnum">{m.attendance.toLocaleString(locale)}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {(w || (venue && clim)) && (
          <section className="card card-pad">
            <h3 className="md-info-title">
              <span className="md-title-emoji" aria-hidden="true">
                {w ? wmoEmoji(w.code) : '🌤️'}
              </span>
              {t('weatherTitle')}
            </h3>
            {w ? (
              <>
                <div className="md-wx-main">
                  <span className="md-wx-emoji" aria-hidden="true">
                    {wmoEmoji(w.code)}
                  </span>
                  <div>
                    <div className="md-wx-temp tnum">{fmtTemp(w.tC, settings.units)}</div>
                    <div className="md-wx-cond">{t(wmoKey(w.code))}</div>
                  </div>
                  {m.status !== 'finished' && <span className="chip md-wx-chip">{t('weatherForecast')}</span>}
                </div>
                <div className="md-rows">
                  <div className="md-row">
                    <span className="lbl">{t('feelsLike')}</span>
                    <span className="val tnum">{fmtTemp(w.feelsC, settings.units)}</span>
                  </div>
                  <div className="md-row">
                    <span className="lbl">{t('precipChance')}</span>
                    <span className="val tnum">{w.pp !== null ? `${w.pp}%` : t('none')}</span>
                  </div>
                  <div className="md-row">
                    <span className="lbl">{t('humidity')}</span>
                    <span className="val tnum">{w.rh}%</span>
                  </div>
                  <div className="md-row">
                    <span className="lbl">{t('wind')}</span>
                    <span className="val tnum">{fmtSpeed(w.windKmh, settings.units)}</span>
                  </div>
                </div>
              </>
            ) : (
              venue &&
              clim && (
                <>
                  <div className="md-wx-main">
                    <span className="md-wx-emoji" aria-hidden="true">
                      🌤️
                    </span>
                    <div>
                      <div className="md-wx-temp tnum">
                        {fmtTemp(clim.lowC, settings.units)}–{fmtTemp(clim.highC, settings.units)}
                      </div>
                      <div className="md-wx-cond">{t(monthKey === 'jul' ? 'monthJul' : 'monthJun')}</div>
                    </div>
                    <span className="chip md-wx-chip">{t('weatherTypical')}</span>
                  </div>
                  {localizedNote(venue.climate?.rainNote, pick) && (
                    <p className="md-wx-note">{localizedNote(venue.climate?.rainNote, pick)}</p>
                  )}
                  <p className="md-wx-note">
                    {t('climateNote', {
                      month: t(monthKey === 'jul' ? 'monthJul' : 'monthJun'),
                      city: pick(venue.cityName, venue.city),
                    })}
                  </p>
                </>
              )
            )}
          </section>
        )}

        {m.officials.length > 0 && (
          <section className="card card-pad">
            <h3 className="md-info-title">
              <Icon name="whistle" size={18} />
              {t('officialsTitle')}
            </h3>
            <div className="md-rows">
              {m.officials.map((o) => {
                const iso = fifaToIso2(o.country)
                return (
                  <div className="md-row" key={o.id}>
                    <span className="lbl">{officialLabel(o)}</span>
                    <span className="val">
                      {pick(o.name)}
                      {iso && <Flag iso2={iso} size={18} />}
                      <span className="muted small">{countryName(iso, o.country ?? '')}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {market && (
          <section className="card card-pad">
            <h3 className="md-info-title">
              <Icon name="tv" size={18} />
              {t('whereToWatch')}
              <Link to="/watch" className="md-cardlink">
                {t('navWatch')}
                <Icon name="external" size={13} />
              </Link>
            </h3>
            <div className="md-market">
              <Flag iso2={market.iso2} size={22} />
              {countryName(market.iso2, market.iso2)}
            </div>
            <div className="md-chips">
              {market.channels.map((c) => (
                <span
                  key={c.name}
                  className={c.free ? 'chip chip-free' : 'chip'}
                  title={localizedNote(c.note, pick) ?? undefined}
                >
                  {c.name}
                  {c.free && <span>· {t('freeChannel')}</span>}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ===== lineups ===== */}
      <div className="section-title">
        <h2>{t('lineups')}</h2>
      </div>
      {hasLineups && lu ? (
        <div className="card md-pitch-card">
          <Pitch
            home={lu.home}
            away={lu.away}
            homeName={homeLabel}
            awayName={awayLabel}
            marks={cardInfo.marks}
          />
          {((lu.home?.subs.length ?? 0) > 0 || (lu.away?.subs.length ?? 0) > 0) && (
            <div className="md-subs">
              {(
                [
                  ['home', lu.home, homeLabel],
                  ['away', lu.away, awayLabel],
                ] as const
              ).map(([k, tl, label]) =>
                tl?.subs.length ? (
                  <div key={k}>
                    <div className="md-subhead">{label}</div>
                    <h4>{t('substitutes')}</h4>
                    {tl.subs.map((p) => (
                      <div className="md-sub" key={p.id}>
                        <span className="no tnum">{p.number ?? ''}</span>
                        <span className="nm">{p.name}</span>
                        {p.captain && (
                          <span className="md-cap" title={t('captain')}>
                            C
                          </span>
                        )}
                        {cardInfo.subOn[p.id] && (
                          <span className="md-sub-on tnum">↑ {cardInfo.subOn[p.id]}</span>
                        )}
                        {cardInfo.marks[p.id]?.card === 'y' && <span aria-hidden="true">🟨</span>}
                        {cardInfo.marks[p.id]?.card === 'r' && <span aria-hidden="true">🟥</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div key={k} />
                ),
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="empty">{t('noLineups')}</div>
        </div>
      )}

      {/* ===== head-to-head in this tournament ===== */}
      {h2h.length > 0 && (
        <>
          <div className="section-title">
            <h2>{t('h2hMatches')}</h2>
          </div>
          <div className="cards-grid">
            {h2h.map((x) => (
              <MatchCard key={x.id} match={x} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
