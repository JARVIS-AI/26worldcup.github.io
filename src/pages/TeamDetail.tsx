import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { PosBucket, SquadPlayer, Team } from '../types'
import { useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData, useData } from '../data/DataContext'
import { fifaToIso2, qualState, sortMatches } from '../utils/helpers'
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

function ageFrom(dob: string): number {
  const d = new Date(dob)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}

function PlayerCard({ p }: { p: SquadPlayer }) {
  const { t } = useI18n()
  const clubIso = fifaToIso2(p.clubNat)
  const age = p.dob ? ageFrom(p.dob) : null
  const showStats = p.caps !== null || p.goals !== null

  return (
    <div className="td-player">
      {p.no !== null && <span className="td-no tnum">{p.no}</span>}
      <div className="td-p-name">
        {p.wiki ? (
          <a
            className="td-wiki"
            href={p.wiki}
            target="_blank"
            rel="noopener noreferrer"
            title={t('wikipedia')}
          >
            {p.name}
            <Icon name="external" size={12} />
          </a>
        ) : (
          <span>{p.name}</span>
        )}
        {p.captain && (
          <span className="td-cap" title={t('captain')}>
            C
          </span>
        )}
      </div>
      <div className="td-p-rows">
        {age !== null && (
          <div className="td-p-row">
            <span title={t('age')}>{t('ageN', { n: age })}</span>
          </div>
        )}
        {showStats && (
          <div className="td-p-row">
            <span className="tnum" title={t('matchesPlayed')}>
              {p.caps ?? 0}
            </span>
            <span className="sep">·</span>
            <span className="tnum">{p.goals ?? 0}</span>
            <span>{t('goals')}</span>
          </div>
        )}
        {p.club && (
          <div className="td-p-row" title={t('club')}>
            {clubIso && <Flag iso2={clubIso} size={16} />}
            <span className="clip">{p.club}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TeamDetail() {
  const params = useParams<{ code: string }>()
  const code = (params.code ?? '').toUpperCase()
  const { t, pick, countryName } = useI18n()
  const { settings, toggleFavorite } = useSettings()
  const { squads, loadSquads } = useData()
  const { teams, matches, standings } = useAppData()

  const team = teams[code] as Team | undefined

  useEffect(() => {
    if (team) loadSquads()
  })

  const teamMatches = useMemo(
    () => sortMatches(matches.filter((m) => m.home?.code === code || m.away?.code === code)),
    [matches, code],
  )

  const squad = squads ? (squads[code] ?? null) : null

  const byPos = useMemo(() => {
    const g: Record<PosBucket, SquadPlayer[]> = { GK: [], DF: [], MF: [], FW: [] }
    for (const p of squad?.players ?? []) g[p.pos].push(p)
    for (const k of POS_ORDER) g[k].sort((a, b) => (a.no ?? 99) - (b.no ?? 99))
    return g
  }, [squad])

  if (!team) {
    return (
      <div className="empty">
        <p>{t('teamNotFound')}</p>
        <Link to="/teams" className="btn">
          <Icon name="back" size={16} />
          {t('backToList')}
        </Link>
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

  return (
    <div className="team-detail">
      <Link to="/teams" className="td-back">
        <Icon name="back" size={15} />
        {t('backToList')}
      </Link>

      <header className="card card-pad td-hero" style={heroStyle}>
        <Flag team={team} size={64} alt={name} />
        <div className="td-hero-main">
          <h1>{name}</h1>
          {team.nickname && <div className="muted td-nick">{team.nickname}</div>}
          <div className="td-chips">
            <Link to="/groups" className="chip chip-accent">
              {t('groupX', { x: team.group })}
            </Link>
            {team.ranking !== null && (
              <span className="chip">
                {t('fifaRanking')} <b className="tnum">#{team.ranking}</b>
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
              {squads === null ? <span className="td-skel">{t('loading')}</span> : squad?.coach || t('none')}
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
          {webUrl && (
            <div className="td-row">
              <span className="td-row-l">{t('officialWebsite')}</span>
              <span className="td-row-v">
                <a className="td-web" href={webUrl} target="_blank" rel="noopener noreferrer">
                  {webText}
                  <Icon name="external" size={14} />
                </a>
              </span>
            </div>
          )}
          {squad?.wiki && (
            <div className="td-row">
              <span className="td-row-l">{t('wikipedia')}</span>
              <span className="td-row-v">
                <a className="td-web" href={squad.wiki.url} target="_blank" rel="noopener noreferrer">
                  {squad.wiki.title}
                  <Icon name="external" size={14} />
                </a>
              </span>
            </div>
          )}
        </section>

        <section className="card card-pad td-group">
          <h3>
            <Link to="/groups">{t('groupX', { x: team.group })}</Link>
          </h3>
          <table className="td-table">
            <thead>
              <tr>
                <th />
                <th className="l" />
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
    </div>
  )
}
