import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Match } from '../types'
import { useI18n } from '../i18n'
import { useAppData, useData } from '../data/DataContext'
import { runTournament } from '../sim/engine'
import type { Outcome, SimRun, SimScore } from '../sim/engine'
import Flag from '../components/Flag'
import Trophy from '../components/Trophy'
import Icon from '../components/Icon'
import InfoDot from '../components/InfoDot'
import ForecastTable from '../components/ForecastTable'
import type { FcRow } from '../components/ForecastTable'
import './forecast.css'

const STAGES: { key: string; stages: string[] }[] = [
  { key: 'stageR32', stages: ['r32'] },
  { key: 'stageR16', stages: ['r16'] },
  { key: 'stageQf', stages: ['qf'] },
  { key: 'stageSf', stages: ['sf'] },
  { key: 'stageThird', stages: ['third'] },
  { key: 'stageFinal', stages: ['final'] },
]

// which slot in the per-team tally each final outcome counts toward
const OUT_IDX: Record<Outcome, number> = {
  group: 4,
  r32: 5,
  r16: 6,
  qf: 7,
  fourth: 8,
  third: 9,
  ru: 10,
  champ: 11,
}

type SimMode = 'now' | 'opener' | 'date' | 'match'

/** local calendar day (YYYY-MM-DD) for a UTC ISO timestamp */
const localDay = (iso: string): string => {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function Forecast() {
  const { t, pick } = useI18n()
  const { matches, teams, venues } = useAppData()
  const { simModel, loadSimModel } = useData()
  useEffect(() => {
    loadSimModel()
  })

  const anyFinished = useMemo(() => matches.some((m) => m.status === 'finished'), [matches])
  // once the final is played, "Now" would just replay the real result (nothing left
  // to simulate), so default to the opener and disable "Now"
  const finalDone = useMemo(
    () => matches.some((m) => m.stage === 'final' && m.status === 'finished'),
    [matches],
  )
  const [runs, setRuns] = useState(1000)

  // ---- "simulate from" cut point ----
  const [simMode, setSimMode] = useState<SimMode>(finalDone ? 'opener' : 'now')
  const { minDate, maxDate } = useMemo(() => {
    const days = matches.map((m) => localDay(m.date)).sort()
    const first = days[0] ?? '2026-06-11'
    const finalMatch = matches.find((m) => m.stage === 'final')
    const finalDay = finalMatch ? localDay(finalMatch.date) : (days[days.length - 1] ?? '2026-07-19')
    // upper bound: tomorrow (so every match through today can stay real and only the
    // future is simulated). once the final is played there is no future left, so the
    // final's day becomes the last meaningful cut.
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const tomorrow = localDay(d.toISOString())
    const upper = finalDone ? finalDay : tomorrow < finalDay ? tomorrow : finalDay
    return { minDate: first, maxDate: upper < first ? first : upper }
  }, [matches, finalDone])
  const [cutDate, setCutDate] = useState(() => {
    const days = matches.map((m) => localDay(m.date)).sort()
    const lo = days[0] ?? '2026-06-11'
    const hi = days[days.length - 1] ?? '2026-07-19'
    const today = localDay(new Date().toISOString())
    return today < lo ? lo : today > hi ? hi : today
  })
  const [cutMatch, setCutMatch] = useState(() => {
    const upcoming = matches.filter((m) => m.status !== 'finished').map((m) => m.n)
    return upcoming.length ? Math.min(...upcoming) : 1
  })

  // a predicate per match: keep its real finished result, or (re)simulate it
  const keepReal = useMemo<(m: Match) => boolean>(() => {
    if (simMode === 'opener') return () => false
    if (simMode === 'match') {
      // match numbers are NOT in kickoff order (a lower number can start at the same
      // time or later), so cut by the picked match's kickoff time: keep real only the
      // matches that kicked off strictly earlier; (re)simulate the picked match, anything
      // kicking off at the same time, and everything after. earlier matches with no real
      // result yet (live/unplayed) still get simulated via the engine's finished-guard.
      const sel = matches.find((m) => m.n === cutMatch)
      if (!sel) return (m) => m.n < cutMatch
      const cutoff = Date.parse(sel.date)
      return (m) => Date.parse(m.date) < cutoff
    }
    if (simMode === 'date') {
      // same kickoff-time logic, inclusive of the picked day: the day and everything
      // after it (local time) is (re)simulated; only matches that kicked off before that
      // day's local midnight keep their real result.
      const cutoff = new Date(`${cutDate}T00:00:00`).getTime()
      return (m) => Date.parse(m.date) < cutoff
    }
    return () => true // 'now' — keep every finished match, simulate the rest
  }, [simMode, cutDate, cutMatch, matches])

  // slider uses a piecewise-log scale: 1/4 travel -> 100, midpoint -> 1000, end -> 10000
  const posToRuns = (p: number) =>
    Math.round(
      p <= 250 ? 10 ** (p / 125) : p <= 500 ? 10 ** (2 + (p - 250) / 250) : 10 ** (3 + (p - 500) / 500),
    )
  const runsToPos = (v: number) => {
    const lg = Math.log10(Math.min(Math.max(v, 1), 10000))
    return Math.round(lg <= 2 ? lg * 125 : lg <= 3 ? 250 + (lg - 2) * 250 : 500 + (lg - 3) * 500)
  }
  const [last, setLast] = useState<SimRun | null>(null)
  const [stats, setStats] = useState<FcRow[] | null>(null)
  const [ranToCount, setRanToCount] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)

  // wheel over the runs input nudges the value by 1 instead of scrolling the page
  // (native non-passive listener: React's onWheel can't preventDefault reliably)
  const runsRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = runsRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setRuns((v) => Math.min(Math.max(v + (e.deltaY < 0 ? 1 : -1), 1), 10000))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // same wheel-to-nudge for the match-number input (also selects that mode on scroll)
  const matchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = matchRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setCutMatch((v) => Math.min(Math.max(v + (e.deltaY < 0 ? 1 : -1), 1), 104))
      setSimMode('match')
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const run = async () => {
    if (!simModel || progress !== null) return
    const n = Math.min(Math.max(runs, 1), 10000)
    const keep = keepReal
    // per team: [g1,g2,g3,g4, group,r32,r16,qf, 4th,3rd,ru,champ]
    const agg = new Map<string, number[]>()
    const bump = (code: string, i: number) => {
      let a = agg.get(code)
      if (!a) {
        a = new Array(12).fill(0)
        agg.set(code, a)
      }
      a[i]++
    }
    let lastRun: SimRun | null = null
    setProgress(0)
    const BATCH = 250 // keep the UI thread responsive on big runs
    for (let done = 0; done < n; done += BATCH) {
      const upto = Math.min(done + BATCH, n)
      for (let i = done; i < upto; i++) {
        lastRun = runTournament(simModel, matches, venues, teams, keep)
        for (const rows of Object.values(lastRun.groupTables)) {
          for (let p = 0; p < rows.length && p < 4; p++) bump(rows[p].code, p)
        }
        for (const [code, o] of Object.entries(lastRun.outcome)) bump(code, OUT_IDX[o])
      }
      setProgress(upto)
      await new Promise((r) => requestAnimationFrame(r))
    }
    setLast(lastRun)
    setRanToCount(n)
    setStats(
      n > 1
        ? [...agg.entries()].map(([code, c]) => ({
            code,
            s1: c[0] / n,
            s2: c[1] / n,
            s3: c[2] / n,
            oGroup: c[4] / n,
            oR32: c[5] / n,
            oR16: c[6] / n,
            oQf: c[7] / n,
            o4: c[8] / n,
            o3: c[9] / n,
            oRu: c[10] / n,
            oChamp: c[11] / n,
          }))
        : null,
    )
    setProgress(null)
  }

  const koMatches = useMemo(
    () => matches.filter((m) => m.stage !== 'group').sort((a, b) => a.n - b.n),
    [matches],
  )

  // forecast on arrival: run once with the defaults as soon as the model loads
  const autoRan = useRef(false)
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    if (simModel && !autoRan.current) {
      autoRan.current = true
      runRef.current()
    }
  }, [simModel])

  // "Now" radio: first by default, but disabled and moved last once the final is done
  const nowRadio = (
    <div className={`sim-radio${finalDone ? ' sim-radio-off' : ''}`}>
      <input
        type="radio"
        id="sf-now"
        name="simfrom"
        checked={simMode === 'now'}
        disabled={finalDone}
        onChange={() => setSimMode('now')}
      />
      <label htmlFor="sf-now">{t('jumpNow')}</label>
      <InfoDot text={t('simNowTip')} />
    </div>
  )

  return (
    <div className="sim-page">
      <div className="page-head">
        <div className="page-head-row">
          <h1>{t('simTitle')}</h1>
          <Link className="chip page-head-cta" to="/match-simulator">
            <Icon name="bolt" size={13} />
            {t('navMatchSim')}
          </Link>
        </div>
        <p>{t('simSub')}</p>
      </div>

      <div className="card card-pad sim-controls">
        {anyFinished && (
          <div className="sim-from" role="radiogroup" aria-label={t('simFrom')}>
            <span className="sim-from-label">{t('simFrom')}</span>
            {!finalDone && nowRadio}
            <div className="sim-radio">
              <input
                type="radio"
                id="sf-opener"
                name="simfrom"
                checked={simMode === 'opener'}
                onChange={() => setSimMode('opener')}
              />
              <label htmlFor="sf-opener">{t('jumpOpener')}</label>
              <InfoDot text={t('simOpenerTip')} />
            </div>
            <div className="sim-radio">
              <input
                type="radio"
                id="sf-date"
                name="simfrom"
                checked={simMode === 'date'}
                onChange={() => setSimMode('date')}
              />
              <input
                className="input sim-date"
                type="date"
                min={minDate}
                max={maxDate}
                value={cutDate}
                onChange={(e) => {
                  setCutDate(e.target.value)
                  setSimMode('date')
                }}
                onFocus={() => setSimMode('date')}
                aria-label={t('simDateTip')}
              />
              <InfoDot text={t('simDateTip')} />
            </div>
            <div className="sim-radio">
              <input
                type="radio"
                id="sf-match"
                name="simfrom"
                checked={simMode === 'match'}
                onChange={() => setSimMode('match')}
              />
              <label htmlFor="sf-match">{t('simMatch')}</label>
              <input
                ref={matchRef}
                className="input sim-matchno tnum"
                type="number"
                min={1}
                max={104}
                value={cutMatch}
                onChange={(e) => {
                  setCutMatch(Math.min(Math.max(Number(e.target.value) || 1, 1), 104))
                  setSimMode('match')
                }}
                onFocus={() => setSimMode('match')}
                aria-label={t('simMatchTip')}
              />
              <InfoDot text={t('simMatchTip')} />
            </div>
            {finalDone && nowRadio}
          </div>
        )}
        <div className="sim-runs">
          <label htmlFor="sim-n">{t('simRuns')}</label>
          <input
            id="sim-n"
            type="range"
            min={0}
            max={1000}
            value={runsToPos(runs)}
            onChange={(e) => setRuns(posToRuns(Number(e.target.value)))}
          />
          <input
            ref={runsRef}
            className="input sim-n tnum"
            type="number"
            min={1}
            max={10000}
            value={runs}
            onChange={(e) => setRuns(Math.min(Math.max(Number(e.target.value) || 1, 1), 10000))}
            aria-label={t('simRuns')}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={run}
          disabled={!simModel || progress !== null}
        >
          <Icon name="target" size={16} />
          {progress !== null ? (
            <span className="tnum">
              {progress}/{Math.min(Math.max(runs, 1), 10000)}
            </span>
          ) : (
            t('simRunBtn')
          )}
        </button>
        <p className="muted small sim-note">{t('probNote')}</p>
      </div>

      {stats && (
        <section className="card card-pad fc-section">
          <h2>{t('fcTitle', { n: ranToCount })}</h2>
          <ForecastTable rows={stats} teams={teams} />
        </section>
      )}

      {last && (
        <>
          <section className="card card-pad sim-champ">
            {ranToCount > 1 && <h2 className="sim-sample-h">{t('simSample')}</h2>}
            <div className="sim-champ-row">
              <Flag team={teams[last.champion]} size={44} />
              <div>
                <div className="sim-champ-label">
                  <Trophy size={16} /> {t('simChampion')}
                </div>
                <div className="sim-champ-name">{pick(teams[last.champion]?.name, last.champion)}</div>
              </div>
            </div>
            <div className="sim-podium">
              {(
                [
                  ['🥈', t('podium2'), last.runnerUp],
                  ['🥉', t('podium3'), last.third],
                  ['', t('podium4'), last.fourth],
                ] as const
              ).map(([medal, label, code]) =>
                code ? (
                  <div key={label} className="sim-podium-item">
                    <span className="sim-podium-label">
                      {medal} {label}
                    </span>
                    <Flag team={teams[code]} size={20} />
                    <span className="sim-podium-name">{pick(teams[code]?.name, code)}</span>
                  </div>
                ) : null,
              )}
            </div>
          </section>

          <section className="sim-groups">
            <h2 className="section-title-h">{t('navGroups')}</h2>
            <div className="sim-groups-grid">
              {Object.entries(last.groupTables)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([g, rows]) => (
                  <div key={g} className="card sim-group">
                    <div className="sim-group-head">{t('groupX', { x: g })}</div>
                    {rows.map((r, i) => {
                      const third = i === 2
                      const q = i < 2 || (third && last.thirds.find((x) => x.code === r.code)?.qualifies)
                      return (
                        <div key={r.code} className={`sim-group-row${q ? ' q' : ''}`}>
                          <span className="tnum sim-pos">{i + 1}</span>
                          <Flag team={teams[r.code]} size={16} />
                          <span className="sim-team">{r.code}</span>
                          <span className="tnum sim-gd">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
                          <span className="tnum sim-pts">{r.pts}</span>
                        </div>
                      )
                    })}
                    <div className="sim-group-matches">
                      {matches
                        .filter((m) => m.stage === 'group' && m.group === g && last.results[m.id])
                        .sort((a, b) => a.n - b.n)
                        .map((m) => {
                          const r = last.results[m.id]
                          return (
                            <div key={m.id} className="sim-gm tnum">
                              <span className={r.winner === r.homeCode ? 'win' : ''}>{r.homeCode}</span>
                              <span className="sim-gm-score">
                                {r.h}–{r.a}
                              </span>
                              <span className={r.winner === r.awayCode ? 'win' : ''}>{r.awayCode}</span>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          <section className="sim-ko">
            <h2 className="section-title-h">{t('navBracket')}</h2>
            {STAGES.map(({ key, stages }) => {
              const ms = koMatches.filter((m) => stages.includes(m.stage) && last.results[m.id])
              if (!ms.length) return null
              return (
                <div key={key} className="sim-stage">
                  <h3>{t(key)}</h3>
                  <div className="sim-stage-grid">
                    {ms.map((m) => (
                      <KoRow key={m.id} m={m} r={last.results[m.id]} />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}

function KoRow({ m, r }: { m: Match; r: SimScore }) {
  const { teams } = useAppData()
  const { pick, t } = useI18n()
  const home = r.homeCode ?? m.home?.code
  const away = r.awayCode ?? m.away?.code
  return (
    <div className="sim-ko-row">
      <span className={`sim-ko-team${r.winner === home ? ' win' : ''}`}>
        <Flag team={home ? teams[home] : undefined} size={16} />
        {home ? pick(teams[home]?.name, home) : '—'}
      </span>
      <span className="sim-ko-score tnum">
        {r.et ? (
          <>
            {r.et.h}–{r.et.a} <small className="sim-aet">{t('simAet')}</small>
          </>
        ) : (
          <>
            {r.h}–{r.a}
          </>
        )}
        {r.et && (
          <span className="sim-ko-sub">
            90′ {r.h}–{r.a}
            {r.pens && (
              <>
                {' '}
                · {t('pens')} {r.pens.h}–{r.pens.a}
              </>
            )}
          </span>
        )}
      </span>
      <span className={`sim-ko-team away${r.winner === away ? ' win' : ''}`}>
        {away ? pick(teams[away]?.name, away) : '—'}
        <Flag team={away ? teams[away] : undefined} size={16} />
      </span>
    </div>
  )
}
