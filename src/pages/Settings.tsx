import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData } from '../data/DataContext'
import { LANG_LABEL } from '../i18n/strings'
import type { Lang, Match, MatchSide, Team, Theme, TzMode, Units } from '../types'
import { allTimezones, fmtDateTime } from '../utils/time'
import {
  applyMatchFilters,
  buildIcs,
  detectMarket,
  flagEmoji,
  download,
  involvesTeams,
  placeholderLabel,
  savedMatchFilters,
  sortMatches,
  stageTag,
} from '../utils/helpers'
import { usePersistentState } from '../utils/viewState'
import Flag from '../components/Flag'
import Icon from '../components/Icon'
import './settings.css'

/** which matches the .ics export covers */
const EXPORT_SCOPES = ['filtered', 'favorites', 'all'] as const
type ExportScope = (typeof EXPORT_SCOPES)[number]

const SCOPE_LABEL_KEY: Record<ExportScope, string> = {
  filtered: 'exportScopeFiltered',
  favorites: 'exportScopeFavorites',
  all: 'exportScopeAll',
}

/** meta.counts keys -> existing i18n keys (raw key shown as-is when unmapped) */
const COUNT_LABEL_KEY: Record<string, string> = {
  matches: 'navMatches',
  teams: 'navTeams',
  squads: 'squad',
  weather: 'weatherTitle',
  lineups: 'lineups',
  flags: 'countFlags',
  venues: 'navVenues',
  broadcasters: 'whereToWatch',
  stats: 'navStats',
}

export default function Settings() {
  const { t, pick, locale, countryName } = useI18n()
  const {
    settings,
    setLang,
    setTzMode,
    setFixedTz,
    toggleFavorite,
    setFavorites,
    setTheme,
    setMarket,
    setUnits,
    reset,
  } = useSettings()
  const { matches, teams, venues, meta, broadcasters } = useAppData()

  const markets = useMemo(() => {
    const list = broadcasters?.markets ?? []
    return list
      .slice()
      .sort((a, b) => countryName(a.iso2, a.iso2).localeCompare(countryName(b.iso2, b.iso2), locale))
  }, [broadcasters, countryName, locale])
  const marketSel =
    settings.market && markets.some((m) => m.iso2 === settings.market)
      ? settings.market
      : detectMarket(new Set(markets.map((m) => m.iso2)))

  const [tzQuery, setTzQuery] = useState('')

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  const tzModes: { mode: TzMode; label: string }[] = [
    { mode: 'local', label: t('tzLocal', { tz: browserTz }) },
    { mode: 'venue', label: t('tzVenue') },
    { mode: 'fixed', label: t('tzFixed') },
  ]

  const allTz = useMemo(() => allTimezones(), [])
  // "UTC+8"-style offset per zone (computed once; also searchable)
  const tzOffsets = useMemo(() => {
    const map = new Map<string, string>()
    const now = new Date()
    for (const z of allTz) {
      try {
        const part = new Intl.DateTimeFormat('en', { timeZone: z, timeZoneName: 'shortOffset' })
          .formatToParts(now)
          .find((x) => x.type === 'timeZoneName')?.value
        map.set(z, (part ?? 'GMT').replace('GMT', 'UTC').replace(/^UTC$/, 'UTC+0'))
      } catch {
        /* unknown zone */
      }
    }
    return map
  }, [allTz])

  const [tzOpen, setTzOpen] = useState(false)
  const tzOptions = useMemo(() => {
    const qRaw = tzQuery.trim().toLowerCase()
    const q = qRaw.replace(/\s+/g, '_')
    const filtered = qRaw
      ? allTz.filter((z) => {
          const off = (tzOffsets.get(z) ?? '').toLowerCase()
          return (
            z.toLowerCase().includes(q) ||
            off.includes(qRaw) ||
            off.replace('utc', 'gmt').includes(qRaw) ||
            off.replace('utc', '').includes(qRaw)
          )
        })
      : allTz
    return filtered.includes(settings.fixedTz) ? filtered : [settings.fixedTz, ...filtered]
  }, [allTz, tzQuery, settings.fixedTz, tzOffsets])

  const grouped = useMemo(() => {
    const map = new Map<string, Team[]>()
    for (const team of Object.values(teams)) {
      const arr = map.get(team.group)
      if (arr) arr.push(team)
      else map.set(team.group, [team])
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([g, list]) => ({ g, list: list.sort((x, y) => x.code.localeCompare(y.code)) }))
  }, [teams])

  // ---- calendar export ----
  const [scopePref, setScopePref] = usePersistentState<ExportScope>('wc2026-ics-scope', 'filtered', (v) =>
    (EXPORT_SCOPES as readonly unknown[]).includes(v),
  )
  const [upcomingOnly, setUpcomingOnly] = usePersistentState<boolean>(
    'wc2026-ics-upcoming',
    true,
    (v) => typeof v === 'boolean',
  )

  const favorites = useMemo(
    () => settings.favorites.filter((c) => Boolean(teams[c])),
    [settings.favorites, teams],
  )
  // no favorites picked yet -> that scope has nothing to export, so fall back
  const scope: ExportScope = scopePref === 'favorites' && favorites.length === 0 ? 'filtered' : scopePref

  // the Matches page keeps its filter bar in storage; mirror the list it shows
  const pageFilters = useMemo(() => savedMatchFilters(teams, venues), [teams, venues])

  const scopeMatches: Record<ExportScope, Match[]> = useMemo(() => {
    const now = Date.now()
    const cut = (list: Match[]) => (upcomingOnly ? list.filter((m) => Date.parse(m.date) > now) : list)
    return {
      filtered: cut(applyMatchFilters(matches, pageFilters)),
      favorites: cut(favorites.length ? sortMatches(matches.filter((m) => involvesTeams(m, favorites))) : []),
      all: cut(sortMatches(matches)),
    }
  }, [matches, pageFilters, favorites, upcomingOnly])

  const exportMatches = scopeMatches[scope]

  const sideName = (side: MatchSide | null, ph: string | null): string => {
    if (side) return pick(teams[side.code]?.name, side.code)
    return ph ? placeholderLabel(ph, t) : t('tbd')
  }

  const exportIcs = () => {
    if (exportMatches.length === 0) return
    const ics = buildIcs(
      exportMatches,
      (m) => `${sideName(m.home, m.phA)} ${t('vs')} ${sideName(m.away, m.phB)} (${stageTag(m, t)})`,
      (m) => {
        const v = m.venueId ? venues[m.venueId] : null
        return v ? `${v.realName}, ${pick(v.cityName, v.city)}` : ''
      },
    )
    download('worldcup2026.ics', ics)
  }

  const onReset = () => {
    if (window.confirm(t('clearSettings'))) reset()
  }

  return (
    <div>
      <div className="page-head">
        <h1>{t('settingsTitle')}</h1>
      </div>

      <div className="se-stack">
        {/* language */}
        <section className="card card-pad se-card">
          <h2>{t('settingLang')}</h2>
          <div className="seg">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                className={settings.lang === l ? 'on' : ''}
                onClick={() => setLang(l)}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </section>

        {/* time zone */}
        <section className="card card-pad se-card">
          <h2>{t('settingTz')}</h2>
          <div role="radiogroup" aria-label={t('settingTz')} className="se-radio-list">
            {tzModes.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={settings.tzMode === mode}
                className={`se-radio${settings.tzMode === mode ? ' on' : ''}`}
                onClick={() => setTzMode(mode)}
              >
                <span className="se-dot" />
                <span>{label}</span>
                {mode === 'fixed' && (
                  <span className="se-radio-cur muted small tnum">
                    {settings.fixedTz.replaceAll('_', ' ')}
                  </span>
                )}
              </button>
            ))}
          </div>
          {settings.tzMode === 'fixed' && (
            <div className="se-tz-pick">
              <input
                type="search"
                className="input"
                value={tzQuery}
                aria-label={t('tzFixed')}
                placeholder={settings.fixedTz.replaceAll('_', ' ')}
                onChange={(e) => setTzQuery(e.target.value)}
                onFocus={() => setTzOpen(true)}
              />
              <select
                className="input"
                size={tzOpen ? 4 : undefined}
                value={settings.fixedTz}
                onChange={(e) => {
                  setFixedTz(e.target.value)
                  setTzOpen(false)
                }}
              >
                {tzOptions.map((z) => (
                  <option key={z} value={z}>
                    {z.replaceAll('_', ' ')} ({tzOffsets.get(z) ?? '—'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* country for TV channels (shared with the Watch page) */}
        {markets.length > 0 && (
          <section className="card card-pad se-card">
            <h2>{t('settingMarket')}</h2>
            <p className="muted small">{t('yourCountryHint')}</p>
            <div className="se-market">
              <select
                className="input"
                value={marketSel}
                onChange={(e) => setMarket(e.target.value)}
                aria-label={t('settingMarket')}
              >
                {markets.map((mk) => (
                  <option key={mk.iso2} value={mk.iso2}>
                    {flagEmoji(mk.iso2)}
                    {countryName(mk.iso2, mk.iso2)}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        {/* favorite teams */}
        <section className="card card-pad se-card">
          <div className="se-fav-head">
            <h2>{t('settingFavorites')}</h2>
            {settings.favorites.length > 0 && (
              <>
                <span className="chip chip-accent">
                  {t('selectedNTeams', { n: settings.favorites.length })}
                </span>
                <button type="button" className="btn se-clear" onClick={() => setFavorites([])}>
                  {t('allTeams')}
                </button>
              </>
            )}
          </div>
          <p className="se-hint">{t('favoritesHint')}</p>
          {grouped.map(({ g, list }) => (
            <div key={g} className="se-group">
              <div className="se-group-label">{t('groupX', { x: g })}</div>
              <div className="se-chips">
                {list.map((team) => {
                  const on = settings.favorites.includes(team.code)
                  return (
                    <button
                      key={team.code}
                      type="button"
                      aria-pressed={on}
                      className={`se-chip${on ? ' on' : ''}`}
                      onClick={() => toggleFavorite(team.code)}
                    >
                      <Flag team={team} size={18} />
                      <span>{pick(team.name, team.code)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* theme */}
        <section className="card card-pad se-card">
          <h2>{t('settingTheme')}</h2>
          <div className="seg">
            {(['auto', 'light', 'dark'] as Theme[]).map((th) => (
              <button
                key={th}
                type="button"
                className={settings.theme === th ? 'on' : ''}
                onClick={() => setTheme(th)}
              >
                {t(th === 'auto' ? 'themeAuto' : th === 'light' ? 'themeLight' : 'themeDark')}
              </button>
            ))}
          </div>
        </section>

        {/* units */}
        <section className="card card-pad se-card">
          <h2>{t('settingUnits')}</h2>
          <div className="seg">
            {(['metric', 'imperial'] as Units[]).map((u) => (
              <button
                key={u}
                type="button"
                className={settings.units === u ? 'on' : ''}
                onClick={() => setUnits(u)}
              >
                {t(u === 'metric' ? 'unitsMetric' : 'unitsImperial')}
              </button>
            ))}
          </div>
        </section>

        {/* calendar export */}
        <section className="card card-pad se-card">
          <h2>{t('exportCalendar')}</h2>
          <p className="se-hint">{t('exportCalendarHint')}</p>
          <div role="radiogroup" aria-label={t('exportScope')} className="se-radio-list">
            {EXPORT_SCOPES.map((s) => {
              const off = s === 'favorites' && favorites.length === 0
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  disabled={off}
                  title={off ? t('exportScopeFavoritesEmpty') : undefined}
                  className={`se-radio${scope === s ? ' on' : ''}`}
                  onClick={() => setScopePref(s)}
                >
                  <span className="se-dot" />
                  <span>{t(SCOPE_LABEL_KEY[s])}</span>
                  <span className="se-radio-cur muted small tnum">
                    {t('matchesShown', { n: scopeMatches[s].length })}
                  </span>
                </button>
              )
            })}
          </div>
          <label className="se-check">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(e) => setUpcomingOnly(e.target.checked)}
            />
            {t('exportUpcomingOnly')}
          </label>
          <div className="se-export-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={exportMatches.length === 0}
              onClick={exportIcs}
            >
              <Icon name="download" size={18} />
              {t('downloadIcs')}
            </button>
            {exportMatches.length === 0 && <span className="muted small">{t('exportEmpty')}</span>}
          </div>
        </section>

        {/* data */}
        <section className="card card-pad se-card">
          <h2>{t('dataTitle')}</h2>
          <p className="muted small">{t('updatedAt', { date: fmtDateTime(meta.updatedAt, locale) })}</p>
          <div className="se-counts">
            {Object.entries(meta.counts).map(([k, v]) => (
              <span key={k} className="chip">
                <strong className="tnum">{v}</strong> {t(COUNT_LABEL_KEY[k] ?? k)}
              </span>
            ))}
          </div>
          <div className="se-reset">
            <button type="button" className="btn se-danger" onClick={onReset}>
              {t('clearSettings')}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
