import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { useData } from './data/DataContext'
import { useI18n } from './i18n'
import Layout from './components/Layout'

// route-level code splitting: each page loads on demand (Venues also pulls the 42 KB map JSON)
const Matches = lazy(() => import('./pages/Matches'))
const MatchDetail = lazy(() => import('./pages/MatchDetail'))
const Groups = lazy(() => import('./pages/Groups'))
const Bracket = lazy(() => import('./pages/Bracket'))
const Teams = lazy(() => import('./pages/Teams'))
const TeamDetail = lazy(() => import('./pages/TeamDetail'))
const Venues = lazy(() => import('./pages/Venues'))
const Watch = lazy(() => import('./pages/Watch'))
const Stats = lazy(() => import('./pages/Stats'))
const Forecast = lazy(() => import('./pages/Forecast'))
const MatchSimulator = lazy(() => import('./pages/MatchSimulator'))
const Settings = lazy(() => import('./pages/Settings'))
const More = lazy(() => import('./pages/More'))

// first path segment -> localized page-name key
const TITLE_KEY: Record<string, string> = {
  match: 'navMatches',
  groups: 'navGroups',
  bracket: 'navBracket',
  teams: 'navTeams',
  team: 'navTeams',
  venues: 'navVenues',
  watch: 'navWatch',
  stats: 'navStats',
  forecast: 'navSim',
  'match-simulator': 'navMatchSim',
  settings: 'navSettings',
  more: 'navMore',
}

/** keeps document.title in sync with the route (and language) */
function TitleManager() {
  const { pathname } = useLocation()
  const { t, pick } = useI18n()
  const { data } = useData()

  useEffect(() => {
    const brand = t('appFullName')
    const [seg, param] = pathname.split('/').filter(Boolean)
    let label = seg ? t(TITLE_KEY[seg] ?? '') : ''
    if (seg === 'team' && param && data?.teams[param.toUpperCase()]) {
      label = pick(data.teams[param.toUpperCase()].name, param.toUpperCase())
    }
    document.title = label && label !== TITLE_KEY[seg] ? `${label} - ${brand}` : brand
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('metaDesc'))
  }, [pathname, data, t, pick])

  return null
}

/** SPA route changes keep the scroll position by default — reset to top on every
 * forward navigation; browser back/forward (POP) keeps its position */
function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the change signal
  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navType])
  return null
}

export default function App() {
  const { data, error } = useData()
  const { t } = useI18n()

  if (error) {
    return (
      <div className="splash">
        <div className="ball">⚽</div>
        <p>{t('loadError')}</p>
        <code className="small muted">{error}</code>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="splash">
        <div className="ball">⚽</div>
        <p>{t('loading')}</p>
      </div>
    )
  }

  return (
    <>
      <ScrollToTop />
      <TitleManager />
      <Suspense fallback={<div className="page-loading" />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Matches />} />
            <Route path="/match/:id" element={<MatchDetail />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/bracket" element={<Bracket />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/team/:code" element={<TeamDetail />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/match-simulator" element={<MatchSimulator />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/more" element={<More />} />
            <Route path="*" element={<Matches />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
