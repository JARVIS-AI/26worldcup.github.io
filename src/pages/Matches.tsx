import { Fragment, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import type { Match } from '../types'
import { useI18n } from '../i18n'
import { useSettings } from '../settings/SettingsContext'
import { useAppData } from '../data/DataContext'
import { displayTz, dayKey, fmtDateLong, relativeDay } from '../utils/time'
import {
  applyMatchFilters,
  MATCH_FILTERS_KEY,
  parseMatchFilters,
  STAGE_FILTERS,
  STAGE_LABEL_KEY,
} from '../utils/helpers'
import MatchCard from '../components/MatchCard'
import Flag from '../components/Flag'
import Trophy from '../components/Trophy'
import Icon from '../components/Icon'
import './matches.css'

export default function Matches() {
  const { t, pick, locale } = useI18n()
  const { settings } = useSettings()
  const { matches, teams, venues, meta } = useAppData()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // remember the filter bar across visits: a shared/typed URL always wins, but
  // arriving with no params restores the last-used selection. Keyed on
  // location.key (not just mount) so navigating away and back — or clicking the
  // Matches nav link while already here — restores instead of wiping the saved
  // filters; the user's own in-page filter changes are never overridden.
  const selfChange = useRef(false)
  const restoredFor = useRef<string | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: must run once per navigation (location.key), not on every searchParams change
  useEffect(() => {
    if (restoredFor.current === location.key) return
    restoredFor.current = location.key
    if (selfChange.current) {
      // this navigation came from our own filter controls: nothing to restore
      selfChange.current = false
      return
    }
    if ([...searchParams.keys()].length > 0) return
    try {
      const saved = localStorage.getItem(MATCH_FILTERS_KEY)
      if (saved) {
        setSearchParams(new URLSearchParams(saved), { replace: true })
      }
    } catch {
      /* blocked storage */
    }
  }, [location.key])
  useEffect(() => {
    if (restoredFor.current === null) return
    try {
      localStorage.setItem(MATCH_FILTERS_KEY, searchParams.toString())
    } catch {
      /* best-effort */
    }
  }, [searchParams])

  // ---- filters from URL (shareable links), validated against data ----
  const filters = useMemo(() => parseMatchFilters(searchParams, teams, venues), [searchParams, teams, venues])
  const { stage, venueId, teamCodes } = filters

  const anyFilter = stage !== '' || venueId !== '' || teamCodes.length > 0

  // mobile: collapsible filter panel; start open when arriving with filters in the URL
  // title-odds strip: deliberately dismissible (remembered); a tiny trophy
  // chip stays behind to bring it back
  const [oddsHidden, setOddsHiddenState] = useState(() => {
    try {
      return localStorage.getItem('wc2026-odds-hidden') === '1'
    } catch {
      return false
    }
  })
  const setOddsHidden = (v: boolean) => {
    setOddsHiddenState(v)
    try {
      localStorage.setItem('wc2026-odds-hidden', v ? '1' : '0')
    } catch {
      /* blocked storage */
    }
  }

  // filters panel: remembered across visits; first visit defaults to open on
  // wide screens, and to open-when-filters-active on narrow ones
  const [open, setOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem('wc2026-filters-open')
      if (saved !== null) return saved === '1'
    } catch {
      /* blocked storage */
    }
    return window.matchMedia('(min-width: 760px)').matches || anyFilter
  })
  const setOpen = (fn: (o: boolean) => boolean) =>
    setOpenState((o) => {
      const v = fn(o)
      try {
        localStorage.setItem('wc2026-filters-open', v ? '1' : '0')
      } catch {
        /* blocked storage */
      }
      return v
    })

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    selfChange.current = true
    setSearchParams(next, { replace: true })
  }
  const toggleTeam = (code: string) => {
    const next = teamCodes.includes(code) ? teamCodes.filter((c) => c !== code) : [...teamCodes, code]
    setParam('teams', next.join(','))
  }
  const clearAll = () => {
    selfChange.current = true
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  // ---- option lists ----
  const allCodes = useMemo(() => Object.keys(teams).sort(), [teams])
  const venueList = useMemo(
    () =>
      Object.values(venues)
        .slice()
        .sort((a, b) => a.realName.localeCompare(b.realName)),
    [venues],
  )
  const favs = useMemo(() => settings.favorites.filter((c) => Boolean(teams[c])), [settings.favorites, teams])
  const favsActive =
    favs.length > 0 && teamCodes.length === favs.length && favs.every((c) => teamCodes.includes(c))

  // ---- filtering + grouping by calendar day in the display timezone ----
  const filtered = useMemo(() => applyMatchFilters(matches, filters), [matches, filters])

  const days = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of filtered) {
      const venue = m.venueId ? venues[m.venueId] : null
      const k = dayKey(m.date, displayTz(settings, venue))
      const arr = map.get(k)
      if (arr) arr.push(m)
      else map.set(k, [m])
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, venues, settings])

  // jump targets: opener / now / first knockout day / the final. "now" is the
  // last finished match in on-page (display) order, so the freshest result sits
  // on top, right before the first live match. match numbers are not in time
  // order, so we scan the rendered order (days asc, then sortMatches) and not
  // ids. before kickoff fall back to the first upcoming day, then the opener.
  const jumps = useMemo(() => {
    const todayK = dayKey(new Date().toISOString(), displayTz(settings, null))
    let nowMatchId: string | undefined
    for (const [, ms] of days) for (const m of ms) if (m.status === 'finished') nowMatchId = m.id
    return {
      opener: days[0]?.[0],
      nowMatchId,
      nowFallbackDay: days.find(([k]) => k >= todayK)?.[0] ?? days[0]?.[0],
      ko: days.find(([, ms]) => ms.some((m) => m.stage !== 'group'))?.[0],
      final: days.find(([, ms]) => ms.some((m) => m.stage === 'final'))?.[0] ?? days[days.length - 1]?.[0],
    }
  }, [days, settings])

  const scrollToDay = (k: string | undefined, behavior: ScrollBehavior = 'smooth') => {
    if (k) document.getElementById(`mxp-day-${k}`)?.scrollIntoView({ block: 'start', behavior })
  }

  // scroll a single match card clear of the sticky header + filter block + the
  // sticky day header that pins above it (scrollIntoView can't see those)
  const scrollToMatch = (id: string | undefined, behavior: ScrollBehavior = 'smooth') => {
    if (!id) return
    const el = document.getElementById(`mxp-match-${id}`)
    if (!el) return
    const head = el.closest('.mxp-day')?.querySelector<HTMLElement>('.day-head')
    const hdr =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 58
    const offset = hdr + (stickyRef.current?.offsetHeight ?? 0) + (head?.offsetHeight ?? 0) + 4
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior })
  }

  const goNow = (behavior: ScrollBehavior = 'smooth') => {
    if (jumps.nowMatchId) scrollToMatch(jumps.nowMatchId, behavior)
    else scrollToDay(jumps.nowFallbackDay, behavior)
  }

  // default position: "now" (instant, one-shot once the list is rendered)
  const jumpedRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot initial scroll keyed on the rendered day list only
  useEffect(() => {
    if (jumpedRef.current || days.length === 0) return
    jumpedRef.current = true
    const firstId = days[0]?.[1]?.[0]?.id
    // skip if "now" is already the very first card / day at the top
    const atTop = jumps.nowMatchId ? jumps.nowMatchId === firstId : jumps.nowFallbackDay === days[0]?.[0]
    if (!atTop) requestAnimationFrame(() => goNow('auto'))
  }, [days])

  // everything above the list is sticky; expose its height so day headers can
  // stack right below it and anchored scrolling lands clear of it
  const stickyRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = stickyRef.current
    if (!el) return
    const set = () => el.parentElement?.style.setProperty('--mxp-sticky-h', `${el.offsetHeight}px`)
    set() // before the initial-position scroll reads the scroll margins
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const teamChip = (code: string) => {
    const team = teams[code]
    const on = teamCodes.includes(code)
    return (
      <button
        key={code}
        type="button"
        className={`mxp-tchip${on ? ' on' : ''}`}
        title={pick(team.name, code)}
        aria-pressed={on}
        onClick={() => toggleTeam(code)}
      >
        <Flag team={team} size={18} />
        {code}
      </button>
    )
  }

  return (
    <div className="mxp">
      <div className="mxp-sticky" ref={stickyRef}>
        {meta.titleOdds && meta.titleOdds.length > 0 && (
          <div className={`mxp-odds-wrap${oddsHidden ? '' : ' open'}`}>
            <Link to="/forecast" className="mxp-odds" tabIndex={oddsHidden ? -1 : 0}>
              {meta.titleOdds[0].p >= 100 ? (
                <>
                  <span className="mxp-odds-label">
                    <Trophy size={17} /> {t('champion')}
                  </span>
                  <span className="mxp-odds-champ">
                    <Flag team={teams[meta.titleOdds[0].c]} size={20} />
                    {pick(teams[meta.titleOdds[0].c]?.name, meta.titleOdds[0].c)}
                  </span>
                </>
              ) : (
                <>
                  <span className="mxp-odds-label">
                    <Trophy size={17} /> {t('titleOdds')}
                  </span>
                  <span className="mxp-odds-list tnum">
                    {meta.titleOdds.map((o) => (
                      <span key={o.c} className="mxp-odds-item">
                        <Flag team={teams[o.c]} size={16} />
                        {o.p}%
                      </span>
                    ))}
                  </span>
                </>
              )}
              <span className="mxp-odds-cta">{t('runForecast')} →</span>
              <button
                type="button"
                className="mxp-odds-close"
                aria-label={t('probHide')}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOddsHidden(true)
                }}
              >
                ×
              </button>
            </Link>
          </div>
        )}
        <div className="page-head mxp-head">
          <h1>{t('navMatches')}</h1>
          <span className="mxp-head-right">
            {meta.titleOdds && meta.titleOdds.length > 0 && (
              <button
                type="button"
                className={`mxp-odds-restore${oddsHidden ? ' on' : ''}`}
                title={t('titleOdds')}
                aria-label={t('titleOdds')}
                tabIndex={oddsHidden ? 0 : -1}
                aria-hidden={!oddsHidden}
                onClick={() => setOddsHidden(false)}
              >
                <Trophy size={16} />
              </button>
            )}
            <span className="muted small tnum">{t('matchesShown', { n: filtered.length })}</span>
          </span>
        </div>

        <div className="mxp-bar">
          {/* mobile-only toggle row */}
          <div className="mxp-toggle-row">
            <button
              type="button"
              className={`btn${open ? ' on' : ''}`}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {`${t('filters')}${t('colon')}${stage ? t('filterStageSel') : t('filterStage')} · ${
                venueId ? t('filterVenueSel') : t('filterVenue')
              } · ${teamCodes.length > 0 ? t('filterTeamsSel', { n: teamCodes.length }) : t('filterTeams')}`}
            </button>
            {anyFilter && (
              <button type="button" className="btn" onClick={clearAll}>
                {t('clearFilters')}
              </button>
            )}
          </div>

          <div className={`mxp-panel${open ? ' open' : ''}`}>
            <div className="mxp-panel-in">
              <div className="mxp-teams-row">
                <div className="mxp-quick">
                  <button
                    type="button"
                    className={`mxp-tchip${teamCodes.length === 0 ? ' on' : ''}`}
                    onClick={() => setParam('teams', '')}
                  >
                    {t('allTeams')}
                  </button>
                  {favs.length > 0 && (
                    <button
                      type="button"
                      className={`mxp-tchip${favsActive ? ' on' : ''}`}
                      onClick={() => setParam('teams', favs.join(','))}
                    >
                      <Icon name="star" size={14} />
                      {t('favoritesOnly')}
                    </button>
                  )}
                  <span className="mxp-quick-selects">
                    <select
                      className="input mxp-select"
                      value={stage}
                      aria-label={t('filterStage')}
                      onChange={(e) => setParam('stage', e.target.value)}
                    >
                      <option value="">{t('allStages')}</option>
                      {STAGE_FILTERS.map((s) => (
                        <option key={s} value={s}>
                          {s === 'ko' ? t('filterKnockout') : t(STAGE_LABEL_KEY[s])}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input mxp-select"
                      value={venueId}
                      aria-label={t('filterVenue')}
                      onChange={(e) => setParam('venue', e.target.value)}
                    >
                      <option value="">{t('allVenues')}</option>
                      {venueList.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.realName} · {pick(v.cityName, v.city)}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <div className="mxp-teams">{allCodes.map(teamChip)}</div>
              </div>
            </div>
          </div>

          <div className="mxp-jump">
            <button type="button" className="mxp-jump-btn" onClick={() => scrollToDay(jumps.opener)}>
              {t('jumpOpener')}
            </button>
            <button type="button" className="mxp-jump-btn" onClick={() => goNow()}>
              {t('jumpNow')}
            </button>
            {jumps.ko && (
              <button type="button" className="mxp-jump-btn" onClick={() => scrollToDay(jumps.ko)}>
                {t('filterKnockout')}
              </button>
            )}
            <button type="button" className="mxp-jump-btn" onClick={() => scrollToDay(jumps.final)}>
              {t('stageFinal')}
            </button>
          </div>
        </div>
      </div>

      {days.length === 0 ? (
        <div className="empty">
          <p>{t('noMatchesFound')}</p>
          <button type="button" className="btn" onClick={clearAll}>
            {t('clearFilters')}
          </button>
        </div>
      ) : (
        days.map(([k, ms]) => {
          const first = ms[0]
          const tz0 = displayTz(settings, first.venueId ? venues[first.venueId] : null)
          const rel = relativeDay(first.date, tz0)
          return (
            <Fragment key={k}>
              <section className="mxp-day" id={`mxp-day-${k}`}>
                <div className="day-head">
                  <span>{fmtDateLong(first.date, locale, tz0)}</span>
                  {rel !== null && (
                    <span className="chip rel">
                      {t(rel === 0 ? 'today' : rel === 1 ? 'tomorrow' : 'yesterday')}
                    </span>
                  )}
                </div>
                <div className="cards-grid three">
                  {ms.map((m) => (
                    <MatchCard key={m.id} match={m} hideDate showWeather domId={`mxp-match-${m.id}`} />
                  ))}
                </div>
              </section>
            </Fragment>
          )
        })
      )}
    </div>
  )
}
