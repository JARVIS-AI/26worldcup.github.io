import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Team } from '../types'
import { DATA_FALLBACK, useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData } from '../data/DataContext'
import Flag from '../components/Flag'
import Icon from '../components/Icon'
import { makeTeamMatcher } from '../utils/teamSearch'
import { CONF_REGION_KEY, type Confederation, TEAM_CONFEDERATION } from '../utils/helpers'
import './teams.css'

const CONF_ORDER: Confederation[] = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC']
type TeamMode = 'group' | 'confed' | 'ranking'
const byName = (a: Team, b: Team) => (a.name.en || a.code).localeCompare(b.name.en || b.code)
// FIFA ranking, best first; teams without a ranking sink to the end, ties broken by name
const byRanking = (a: Team, b: Team) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity) || byName(a, b)

function TeamCard({ team }: { team: Team }) {
  const { t, pick } = useI18n()
  const { settings, toggleFavorite } = useSettings()
  const fav = settings.favorites.includes(team.code)
  const favLabel = t(fav ? 'removeFavorite' : 'addFavorite')
  const conf = TEAM_CONFEDERATION[team.code]
  return (
    <Link to={`/team/${team.code}`} className="card tm-card">
      <Flag team={team} size={36} />
      <div className="tm-info">
        <div className="tm-name">{pick(team.name, team.code)}</div>
        <div className="tm-meta small muted">
          {team.ranking !== null && <span className="chip tnum">FIFA #{team.ranking}</span>}
          {conf && <span className="chip">{conf}</span>}
        </div>
        {team.nickname && <div className="tm-nick">{team.nickname}</div>}
      </div>
      <button
        type="button"
        className={`tm-star${fav ? ' on' : ''}`}
        aria-label={favLabel}
        title={favLabel}
        aria-pressed={fav}
        onClick={(e) => {
          e.preventDefault()
          toggleFavorite(team.code)
        }}
      >
        <Icon name={fav ? 'starFill' : 'star'} size={20} />
      </button>
    </Link>
  )
}

export default function Teams() {
  const { t, lang } = useI18n()
  const { settings } = useSettings()
  const { teams } = useAppData()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<TeamMode>('group')

  // sections to render: by World Cup group, by confederation, or a single
  // flat list sorted by FIFA ranking
  const sections = useMemo(() => {
    const all = Object.values(teams)
    if (mode === 'ranking') {
      return [
        {
          key: '',
          teams: all.slice().sort(byRanking),
        },
      ]
    }
    const by: Record<string, Team[]> = {}
    for (const tm of all) {
      const k = mode === 'confed' ? (TEAM_CONFEDERATION[tm.code] ?? '') : tm.group
      by[k] = by[k] ?? []
      by[k].push(tm)
    }
    const order = mode === 'confed' ? CONF_ORDER.filter((c) => by[c]?.length) : Object.keys(by).sort()
    return order.map((k) => ({ key: k, teams: by[k].slice().sort(byRanking) }))
  }, [teams, mode])

  // space-separated terms AND together: "ko pu" finds Korea Republic, "墨 哥" finds 墨西哥;
  // matching is diacritic-insensitive and includes common English aliases
  const visible = useMemo(() => {
    if (!query.trim()) return null // no filter — show everything
    const match = makeTeamMatcher(query, lang, DATA_FALLBACK[lang])
    const set = new Set<string>()
    for (const team of Object.values(teams)) if (match(team)) set.add(team.code)
    return set
  }, [query, teams, lang])

  const show = (code: string) => !visible || visible.has(code)

  const favTeams = settings.favorites
    .map((c) => teams[c])
    .filter((tm): tm is Team => Boolean(tm) && show(tm.code))

  const nothing = visible !== null && visible.size === 0

  const sectionTitle = (key: string): string =>
    mode === 'confed'
      ? `${key} (${t(CONF_REGION_KEY[key as Confederation])})`
      : mode === 'group'
        ? t('groupX', { x: key })
        : t('allTeams')

  return (
    <div className="tm-page">
      <div className="page-head tm-head">
        <h1>{t('teamsTitle')}</h1>
        <input
          className="input tm-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('teamsTitle')}
          aria-label={t('teamsTitle')}
        />
      </div>

      <div className="tm-modes" role="group" aria-label={t('teamsTitle')}>
        <button
          type="button"
          className={`tm-mode${mode === 'group' ? ' on' : ''}`}
          onClick={() => setMode('group')}
        >
          {t('teamsByGroup')}
        </button>
        <button
          type="button"
          className={`tm-mode${mode === 'confed' ? ' on' : ''}`}
          onClick={() => setMode('confed')}
        >
          {t('teamsByConfed')}
        </button>
        <button
          type="button"
          className={`tm-mode${mode === 'ranking' ? ' on' : ''}`}
          onClick={() => setMode('ranking')}
        >
          {t('teamsByRanking')}
        </button>
      </div>

      {nothing ? (
        <div className="empty">{t('noMatchesFound')}</div>
      ) : (
        <>
          {favTeams.length > 0 && (
            <section>
              <div className="section-title">
                <h2>
                  {t('favoritesOnly')} ({favTeams.length})
                </h2>
              </div>
              <div className="cards-grid three">
                {favTeams.map((tm) => (
                  <TeamCard key={tm.code} team={tm} />
                ))}
              </div>
            </section>
          )}

          {sections.map((sec) => {
            const list = sec.teams.filter((tm) => show(tm.code))
            if (!list.length) return null
            // counts are informative where section sizes vary (confederations,
            // the full ranked list); World Cup groups are always four, so skip
            const title =
              mode === 'group' ? sectionTitle(sec.key) : `${sectionTitle(sec.key)} (${list.length})`
            return (
              <section key={sec.key || 'rank'}>
                <div className="section-title">
                  <h2>{title}</h2>
                </div>
                <div className="cards-grid three">
                  {list.map((tm) => (
                    <TeamCard key={tm.code} team={tm} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
