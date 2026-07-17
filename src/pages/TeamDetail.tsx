import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { PosBucket, SquadPlayer, Team } from '../types'
import { useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData, useData } from '../data/DataContext'
import {
  assetUrl,
  bandResultLabel,
  CONF_REGION_KEY,
  fifaSquadUrl,
  fifaToIso2,
  qualState,
  sortMatches,
  TEAM_CONFEDERATION,
} from '../utils/helpers'
import { tournamentRanking } from '../utils/tournamentRanking'
import { FifaMark, HomeMark, WikipediaMark } from '../components/BrandMarks'
import Flag from '../components/Flag'
import Icon from '../components/Icon'
import MapLinks from '../components/MapLinks'
import MatchCard from '../components/MatchCard'
import TeamName from '../components/TeamName'
import './teamdetail.css'

const POS_ORDER: PosBucket[] = ['GK', 'DF', 'MF', 'FW']
const POS_KEY: Record<PosBucket, string> = {
  GK: 'posGK',
  DF: 'posDF',
  MF: 'posMF',
  FW: 'posFW',
}

// World Cup finish code -> i18n key; the top three finishes also get a medal tint.
// rounds that exist as tournament stages reuse those (already localized) labels;
// only the knockout finishes and the old second round need dedicated keys.
const FINISH_KEY: Record<string, string> = {
  W: 'finishW',
  RU: 'finishRU',
  '3': 'finish3',
  '4': 'finish4',
  R2: 'finishR2',
  SF: 'stageSf',
  QF: 'stageQf',
  R16: 'stageR16',
  R32: 'stageR32',
  GS: 'stageGroup',
}
const FINISH_MEDAL: Record<string, 'gold' | 'silver' | 'bronze'> = {
  W: 'gold',
  RU: 'silver',
  '3': 'bronze',
}
// reason a team missed a tournament -> i18n key
const REASON_KEY: Record<string, string> = {
  dnq: 'missDnq',
  withdrew: 'missWithdrew',
  dne: 'missDne',
  banned: 'missBanned',
  notmember: 'missNotMember',
  rejected: 'missRejected',
  noteligible: 'missNotEligible',
}
// "partOf:<iso>" / "protectorateOf:<iso>": the team was not an independent nation yet
const BELONGED_KEY: Record<string, string> = {
  partOf: 'missPartOf',
  protectorateOf: 'missProtectorate',
}
// CLDR aliases these away (YU -> Serbia, SU -> Russia), so we carry our own labels
const HISTORIC_STATE_KEY: Record<string, string> = { YU: 'entYugoslavia', SU: 'entSovietUnion' }

function ageFrom(dob: string): number {
  const d = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}

/** small Wikipedia-icon link */
function WikiIcon({ url }: { url: string }) {
  const { t } = useI18n()
  return (
    <a
      className="td-wiki-icon"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t('englishWikipedia')}
      aria-label={t('englishWikipedia')}
    >
      <WikipediaMark size={15} />
    </a>
  )
}

function PlayerCard({ p }: { p: SquadPlayer }) {
  const { t } = useI18n()
  const clubIso = fifaToIso2(p.clubNat)
  const clubUrl = p.club
    ? p.clubWiki || `https://en.wikipedia.org/wiki/${encodeURIComponent(p.club.trim().replace(/ /g, '_'))}`
    : null
  const age = p.dob ? ageFrom(p.dob) : null
  const showStats = p.caps !== null || p.goals !== null || (p.wcApps ?? 0) > 0 || (p.wcGoals ?? 0) > 0

  // "<n> Apps (<g>⚽)" — first segment is this World Cup alone, second the running
  // national-team career total (frozen pre-tournament base + this World Cup's tally,
  // so the career figure stays live without double-counting); each gets its own hover
  // tooltips for apps and goals
  const statSeg = (apps: number, g: number, appsTitle: string, goalsTitle: string) => (
    <span className="td-stat">
      <span className="td-apps" title={appsTitle}>
        <span className="tnum">{apps}</span> {t('apps')}
      </span>{' '}
      <span className="muted" title={goalsTitle}>
        (<span className="tnum">{g}</span>
        {' ⚽)'}
      </span>
    </span>
  )

  return (
    <div className="td-player" id={p.no !== null ? `sq-p-${p.no}` : undefined}>
      {p.no !== null && <span className="td-no tnum">{p.no}</span>}
      <div className="td-p-name">
        <span>{p.name}</span>
        {p.captain && (
          <span className="td-cap" title={t('captain')}>
            C
          </span>
        )}
      </div>
      <div className="td-p-rows">
        {(age !== null || p.wiki) && (
          <div className="td-p-row td-p-age">
            {age !== null && <span title={t('age')}>{t('ageN', { n: age })}</span>}
            {p.wiki && <WikiIcon url={p.wiki} />}
          </div>
        )}
        {showStats && (
          <div className="td-p-row td-p-stats">
            {statSeg(p.wcApps ?? 0, p.wcGoals ?? 0, t('appsWc'), t('goalsWc'))}
            <span className="sep">·</span>
            {statSeg(
              (p.caps ?? 0) + (p.wcApps ?? 0),
              (p.goals ?? 0) + (p.wcGoals ?? 0),
              t('appsCareer'),
              t('goalsCareer'),
            )}
          </div>
        )}
        {((p.wcYellow ?? 0) > 0 || (p.wcRed ?? 0) > 0) && (
          <div className="td-p-row td-p-cards">
            {(p.wcYellow ?? 0) > 0 && (
              <span title={t('statYellowCards')}>
                🟨 <span className="tnum">{p.wcYellow}</span>
              </span>
            )}
            {(p.wcYellow ?? 0) > 0 && (p.wcRed ?? 0) > 0 && <span className="sep">·</span>}
            {(p.wcRed ?? 0) > 0 && (
              <span title={t('statRedCards')}>
                🟥 <span className="tnum">{p.wcRed}</span>
              </span>
            )}
          </div>
        )}
        {p.club && (
          <div className="td-p-row" title={t('club')}>
            {clubIso && <Flag iso2={clubIso} size={16} />}
            {clubUrl ? (
              <a className="td-wiki clip" href={clubUrl} target="_blank" rel="noopener noreferrer">
                {p.club}
              </a>
            ) : (
              <span className="clip">{p.club}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TeamDetail() {
  const params = useParams<{ code: string }>()
  const code = (params.code ?? '').toUpperCase()
  const { t, pick, countryName, lang } = useI18n()
  const { settings, toggleFavorite } = useSettings()
  const { squads, loadSquads, wcHistory, loadWcHistory } = useData()
  const { teams, matches, standings, stats } = useAppData()
  // World Cup history is collapsed by default; click the header to expand
  const [showHistory, setShowHistory] = useState(false)

  const team = teams[code] as Team | undefined

  useEffect(() => {
    if (team) {
      loadSquads()
      loadWcHistory()
    }
  })

  // round reached, or reason for absence (both fall back to the raw code)
  const finishLabel = (f: string | null) => (f ? (FINISH_KEY[f] ? t(FINISH_KEY[f]) : f) : t('none'))
  const reasonLabel = (r: string | null) => {
    if (!r) return t('none')
    if (REASON_KEY[r]) return t(REASON_KEY[r])
    const [kind, iso] = r.split(':')
    const frame = BELONGED_KEY[kind]
    if (frame && iso) {
      const state = HISTORIC_STATE_KEY[iso]
      return t(frame, { x: state ? t(state) : countryName(iso, iso) })
    }
    return r
  }

  const teamMatches = useMemo(
    () => sortMatches(matches.filter((m) => m.home?.code === code || m.away?.code === code)),
    [matches, code],
  )
  // this team's row in the final tournament standing (null until the quarter-finals
  // are done); its result label + overall record head the matches section
  const teamResult = useMemo(
    () => tournamentRanking(matches, teams, stats.fairPlay?.all)?.find((r) => r.code === code) ?? null,
    [matches, teams, stats, code],
  )

  const squad = squads ? (squads[code] ?? null) : null

  const byPos = useMemo(() => {
    const g: Record<PosBucket, SquadPlayer[]> = { GK: [], DF: [], MF: [], FW: [] }
    for (const p of squad?.players ?? []) g[p.pos].push(p)
    for (const k of POS_ORDER) g[k].sort((a, b) => (a.no ?? 99) - (b.no ?? 99))
    return g
  }, [squad])

  // deep link from lineups / scorers / cards: #/team/CODE?p=<shirt no> scrolls
  // to that player's squad card and flashes it once the squad has loaded
  const [searchParams] = useSearchParams()
  const playerParam = searchParams.get('p')
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when the squad finishes loading or the target player changes
  useEffect(() => {
    if (!playerParam || !squad) return
    const el = document.getElementById(`sq-p-${playerParam}`)
    if (!el) return
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 1800)
    })
    return () => cancelAnimationFrame(id)
  }, [playerParam, squad, code])

  if (!team) {
    return (
      <div className="empty">
        <p>{t('teamNotFound')}</p>
      </div>
    )
  }

  const name = pick(team.name, code)
  const fav = settings.favorites.includes(code)

  const heroStyle = {
    '--td-c1': team.colors[0] || 'var(--accent)',
    '--td-c2': team.colors[1] || team.colors[0] || 'var(--accent-2)',
  } as CSSProperties

  // base camp text
  const bc = team.baseCamp
  let baseCampText = t('none')
  if (bc) {
    const parts = [bc.facility, bc.city].filter((x): x is string => !!x)
    const ctry = bc.country ? countryName(bc.country) : ''
    const joined = parts.join(' · ')
    baseCampText = joined && ctry ? `${joined}, ${ctry}` : joined || ctry || t('none')
  }

  const webText = team.web ? team.web.replace(/^https?:\/\//, '') : null
  const webUrl = webText ? `https://${webText}` : null

  const rows = standings.groups[team.group] ?? []

  // frozen World Cup history; only present for curated teams
  const wc = wcHistory?.[code]

  // suspension chips: flag score flag (finished) or flag vs flag (upcoming)
  const matchChip = (mid: string, accent = false) => {
    const mm = matches.find((x) => x.id === mid)
    if (!mm) return null
    const cls = `chip td-susp-chip tnum${accent ? ' chip-accent' : ''}`
    return (
      <Link key={mid} to={`/match/${mid}`} className={cls}>
        {mm.home && mm.away ? (
          <>
            <Flag team={teams[mm.home.code]} size={15} />
            {mm.status === 'finished' ? `${mm.home.score}–${mm.away.score}` : t('vs')}
            <Flag team={teams[mm.away.code]} size={15} />
          </>
        ) : (
          t('matchN', { n: mm.n })
        )}
      </Link>
    )
  }

  return (
    <div className="team-detail">
      <header className="card card-pad td-hero" style={heroStyle}>
        <Flag team={team} size={64} alt={name} />
        <div className="td-hero-main">
          <h1>{name}</h1>
          {team.nickname && <div className="muted td-nick">{team.nickname}</div>}
          <div className="td-chips">
            {team.ranking !== null && (
              <span className="chip">
                {t('fifaRanking')} <b className="tnum">#{team.ranking}</b>
              </span>
            )}
            {TEAM_CONFEDERATION[code] && (
              <span className="chip">
                {TEAM_CONFEDERATION[code]} ({t(CONF_REGION_KEY[TEAM_CONFEDERATION[code]])})
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`btn td-fav${fav ? ' on' : ''}`}
          onClick={() => toggleFavorite(code)}
          aria-pressed={fav}
        >
          <Icon name={fav ? 'starFill' : 'star'} size={17} />
          {t(fav ? 'removeFavorite' : 'addFavorite')}
        </button>
      </header>

      <div className="td-cols">
        <section className="card card-pad">
          <div className="td-row">
            <span className="td-row-l">{t('coach')}</span>
            <span className="td-row-v">
              {squads === null ? (
                <span className="td-skel">{t('loading')}</span>
              ) : squad?.coach ? (
                <span className="td-coach">
                  {squad.coach}
                  <WikiIcon
                    url={
                      squad.coachWiki ||
                      `https://en.wikipedia.org/wiki/${encodeURIComponent(squad.coach.trim().replace(/ /g, '_'))}`
                    }
                  />
                </span>
              ) : (
                t('none')
              )}
            </span>
          </div>
          <div className="td-row">
            <span className="td-row-l">{t('baseCamp')}</span>
            <span className="td-row-v td-camp-links">
              {bc ? (
                <>
                  <Link className="td-web" to={`/venues?team=${code}`} title={t('navVenues')}>
                    {baseCampText}
                    <Icon name="pin" size={14} />
                  </Link>
                  {bc && (
                    <MapLinks
                      query={[bc.facility, bc.city].filter(Boolean).join(', ') || `${bc.lat},${bc.lon}`}
                    />
                  )}
                </>
              ) : (
                baseCampText
              )}
            </span>
          </div>
          <div className="td-row">
            <span className="td-row-l">{t('links')}</span>
            <span className="td-row-v td-links">
              {webUrl && (
                <a
                  className="td-link-icon td-link-home"
                  href={webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('officialTeamWebsite')}
                  aria-label={t('officialTeamWebsite')}
                >
                  <HomeMark size={20} />
                </a>
              )}
              <a
                className="td-link-icon"
                href={fifaSquadUrl(team, lang)}
                target="_blank"
                rel="noopener noreferrer"
                title={t('fifaWorldCupPage')}
                aria-label={t('fifaWorldCupPage')}
              >
                <FifaMark size={19} />
              </a>
              {squad?.wiki && (
                <a
                  className="td-link-icon td-link-wiki"
                  href={squad.wiki.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('englishWikipedia')}
                  aria-label={t('englishWikipedia')}
                >
                  <WikipediaMark size={19} />
                </a>
              )}
            </span>
          </div>
        </section>

        <section className="card card-pad td-group">
          <table className="td-table">
            <thead>
              <tr>
                <th className="l td-group-h" colSpan={2}>
                  <h3>
                    <Link to={`/groups?g=${team.group}`}>{t('groupX', { x: team.group })}</Link>
                  </h3>
                </th>
                <th>{t('colP')}</th>
                <th className="xw">{t('colW')}</th>
                <th className="xw">{t('colD')}</th>
                <th className="xw">{t('colL')}</th>
                <th className="xw">{t('colGF')}</th>
                <th className="xw">{t('colGA')}</th>
                <th>{t('colGD')}</th>
                <th>{t('colPts')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const qs = qualState(standings, team.group, r.rank, r.code)
                const cls = [r.code === code ? 'td-row-me' : '', qs ? `td-q-${qs}` : '']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <tr key={r.code} className={cls || undefined}>
                    <td>
                      <span className="td-rank tnum">{r.rank}</span>
                    </td>
                    <td className="l team">
                      <TeamName code={r.code} flagSize={18} link={r.code !== code} />
                    </td>
                    <td>{r.p}</td>
                    <td className="xw">{r.w}</td>
                    <td className="xw">{r.d}</td>
                    <td className="xw">{r.l}</td>
                    <td className="xw">{r.gf}</td>
                    <td className="xw">{r.ga}</td>
                    <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="pts">{r.pts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>

      {teamResult && (
        <Link to="/bracket?standing=1" className={`card card-pad td-result td-band-${teamResult.band}`}>
          <span className="td-result-head">
            <span className="td-result-label">{bandResultLabel(teamResult.band, t)}</span>
            {teamResult.pos != null && <span className="td-result-pos tnum">#{teamResult.pos}</span>}
            <span className="td-result-cta">{t('fullStanding')} →</span>
          </span>
          <span className="td-result-stats tnum">
            <span>
              {t('colP')} <b>{teamResult.p}</b>
            </span>
            <span>
              {t('colW')} <b>{teamResult.w}</b>
            </span>
            <span>
              {t('colD')} <b>{teamResult.d}</b>
            </span>
            <span>
              {t('colL')} <b>{teamResult.l}</b>
            </span>
            <span>
              {t('colGF')} <b>{teamResult.gf}</b>
            </span>
            <span>
              {t('colGA')} <b>{teamResult.ga}</b>
            </span>
            <span>
              {t('colGD')} <b>{teamResult.gd > 0 ? `+${teamResult.gd}` : teamResult.gd}</b>
            </span>
            <span>
              {t('colPts')} <b>{teamResult.pts}</b>
            </span>
          </span>
        </Link>
      )}
      <div className="section-title">
        <h2>{t('teamMatches')}</h2>
      </div>
      {teamMatches.length === 0 ? (
        <div className="empty">{t('noMatchesFound')}</div>
      ) : (
        <div className="cards-grid">
          {teamMatches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>{t('squad')}</h2>
      </div>
      {(stats.suspensions?.[code]?.length ?? 0) > 0 && (
        <div className="card card-pad td-susp">
          <h3>{t('suspTitle')}</h3>
          {(stats.suspensions?.[code] ?? []).map((sp) =>
            sp.bans.map((ban, i) => (
              <div className="td-susp-row" key={`${sp.id}-${i}`}>
                <span aria-hidden="true">{ban.type === 'red' ? '🟥' : '🟨🟨'}</span>
                <span className="td-susp-name">{sp.name}</span>
                <span className="td-susp-due">{ban.due.map((mid) => matchChip(mid))}</span>
                <span className="td-susp-miss muted small">→ {t('suspMisses')}</span>
                {ban.banned && matchChip(ban.banned, true)}
              </div>
            )),
          )}
        </div>
      )}
      <p className="small muted td-squad-note">{t('squadNote')}</p>
      {squads === null ? (
        <div>
          <p className="small td-skel">{t('loading')}</p>
          <div className="td-players td-skel-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="td-skel-card" />
            ))}
          </div>
        </div>
      ) : !squad || squad.players.length === 0 ? (
        <div className="empty">{t('none')}</div>
      ) : (
        POS_ORDER.map((pos) =>
          byPos[pos].length === 0 ? null : (
            <div key={pos}>
              <div className="td-pos-head">
                {t(POS_KEY[pos])}
                <span className="chip tnum">{byPos[pos].length}</span>
              </div>
              <div className="td-players">
                {byPos[pos].map((p) => (
                  <PlayerCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          ),
        )
      )}

      {wc && (
        <section className="td-wc-sec">
          <h2 className="td-wc-title">
            <button
              type="button"
              className="td-wc-head"
              aria-expanded={showHistory}
              aria-controls="td-wc-body"
              onClick={() => setShowHistory((s) => !s)}
            >
              <span className="td-wc-name">{t('wcHistoryTitle')}</span>
              <span className="td-wc-summary">
                <span className="chip">{t('wcAppsN', { n: wc.total.apps })}</span>
                {wc.total.titles > 0 ? (
                  <span className="chip td-wc-titles">🏆 {t('wcTitlesN', { n: wc.total.titles })}</span>
                ) : wc.total.best ? (
                  <span className="chip">{t('wcBest', { x: finishLabel(wc.total.best) })}</span>
                ) : null}
              </span>
              <Icon name="chevron" size={18} className={`td-wc-chev${showHistory ? ' open' : ''}`} />
            </button>
          </h2>
          {showHistory && (
            <div id="td-wc-body" className="td-wc-body">
              <table className="td-table td-wc-table">
                <thead>
                  <tr>
                    <th className="l">{t('wcColEdition')}</th>
                    <th className="l">{t('wcColResult')}</th>
                    <th>{t('colP')}</th>
                    <th className="xw">{t('colW')}</th>
                    <th className="xw">{t('colD')}</th>
                    <th className="xw">{t('colL')}</th>
                    <th className="xw">{t('colGF')}</th>
                    <th className="xw">{t('colGA')}</th>
                  </tr>
                </thead>
                <tbody>
                  {wc.history.map((h) => {
                    const edition = (
                      <span className="td-wc-ed">
                        <span className="tnum">{h.year}</span>
                        {h.host.map((hp, i) => (
                          <Flag
                            key={hp.iso ?? String(i)}
                            iso2={hp.iso}
                            url={assetUrl(hp.flag)}
                            title={hp.loc === false ? (hp.name ?? '') : countryName(hp.iso, hp.name ?? '')}
                            size={18}
                          />
                        ))}
                      </span>
                    )
                    if (!h.played) {
                      return (
                        <tr key={h.year} className="td-wc-miss">
                          <td className="l">{edition}</td>
                          <td className="l muted" colSpan={7}>
                            {reasonLabel(h.reason)}
                          </td>
                        </tr>
                      )
                    }
                    const medal = h.finish ? FINISH_MEDAL[h.finish] : undefined
                    return (
                      <tr key={h.year}>
                        <td className="l">{edition}</td>
                        <td className="l">
                          <span className={`td-wc-fin${medal ? ` td-wc-fin-${medal}` : ''}`}>
                            {finishLabel(h.finish)}
                          </span>
                        </td>
                        <td className="tnum">{h.p}</td>
                        <td className="xw tnum">{h.w}</td>
                        <td className="xw tnum">{h.d}</td>
                        <td className="xw tnum">{h.l}</td>
                        <td className="xw tnum">{h.gf}</td>
                        <td className="xw tnum">{h.ga}</td>
                      </tr>
                    )
                  })}
                  {wc.total.apps > 0 && (
                    <tr className="td-wc-total">
                      <td className="l">{t('wcAllTime')}</td>
                      <td className="l" />
                      <td className="tnum">{wc.total.p}</td>
                      <td className="xw tnum">{wc.total.w}</td>
                      <td className="xw tnum">{wc.total.d}</td>
                      <td className="xw tnum">{wc.total.l}</td>
                      <td className="xw tnum">{wc.total.gf}</td>
                      <td className="xw tnum">{wc.total.ga}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
