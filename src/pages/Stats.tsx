import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useAppData } from '../data/DataContext'
import TeamName from '../components/TeamName'
import Flag from '../components/Flag'
import './stats.css'

export default function Stats() {
  const { t } = useI18n()
  const { matches, teams, stats } = useAppData()

  const finished = matches.filter((m) => m.status === 'finished')
  const liveCount = matches.filter((m) => m.status === 'live').length
  const goals = finished.reduce((sum, m) => sum + (m.home?.score ?? 0) + (m.away?.score ?? 0), 0)
  // average goals per finished match, 1 decimal, Latin digits in every locale
  const goalsAvg = finished.length > 0 ? (goals / finished.length).toFixed(1) : null

  // top scorers with tie-aware ranks
  const scorers = stats.scorers.slice().sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
  let prevGoals = -1
  let prevRank = 0
  const rankedScorers = scorers.map((s, i) => {
    const rank = s.goals === prevGoals ? prevRank : i + 1
    prevGoals = s.goals
    prevRank = rank
    return { ...s, rank }
  })

  // all 48 teams by FIFA ranking, unranked last
  const ranked = Object.values(teams)
    .slice()
    .sort(
      (a, b) =>
        (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER) ||
        a.code.localeCompare(b.code),
    )

  return (
    <div>
      <div className="page-head">
        <h1>{t('statsTitle')}</h1>
      </div>

      <div className="sx-summary">
        <div className="card sx-stat">
          <div className="sx-num tnum">{finished.length}</div>
          <div className="sx-lbl">{t('matchesPlayed')}</div>
        </div>
        <div className="card sx-stat">
          <div className="sx-num tnum">{goals}</div>
          <div className="sx-lbl">{t('statGoals')}</div>
        </div>
        {goalsAvg !== null && (
          <div className="card sx-stat">
            <div className="sx-num tnum">{goalsAvg}</div>
            <div className="sx-lbl">{t('statGoalsAvg')}</div>
          </div>
        )}
        {(stats.cards?.yellow ?? 0) > 0 && (
          <div className="card sx-stat">
            <div className="sx-num tnum">🟨 {stats.cards?.yellow}</div>
            <div className="sx-lbl">{t('statYellowCards')}</div>
          </div>
        )}
        {(stats.cards?.red ?? 0) > 0 && (
          <div className="card sx-stat">
            <div className="sx-num tnum">🟥 {stats.cards?.red}</div>
            <div className="sx-lbl">{t('statRedCards')}</div>
          </div>
        )}
        {stats.biggestWin && (
          <Link
            to={stats.biggestWin.id ? `/match/${stats.biggestWin.id}` : '/'}
            className="card sx-stat sx-stat-link"
          >
            <div className="sx-num tnum sx-num-sm">
              <Flag team={teams[stats.biggestWin.h]} size={22} /> {stats.biggestWin.hs}–{stats.biggestWin.as}{' '}
              <Flag team={teams[stats.biggestWin.a]} size={22} />
            </div>
            <div className="sx-lbl">{t('statBiggestWin')}</div>
          </Link>
        )}
        {stats.fastestGoal && (
          <Link
            to={stats.fastestGoal.id ? `/match/${stats.fastestGoal.id}` : '/'}
            className="card sx-stat sx-stat-link"
          >
            <div className="sx-num tnum sx-num-sm">
              {stats.fastestGoal.minute} {stats.fastestGoal.name}
            </div>
            <div className="sx-lbl">{t('statFastestGoal')}</div>
          </Link>
        )}
        {stats.upset && (
          <Link to={`/match/${stats.upset.id}`} className="card sx-stat sx-stat-link">
            <div className="sx-num tnum sx-num-sm">
              <Flag team={teams[stats.upset.h]} size={22} /> {stats.upset.hs}–{stats.upset.as}{' '}
              <Flag team={teams[stats.upset.a]} size={22} /> ({stats.upset.p}%)
            </div>
            <div className="sx-lbl">{t('statUpset')}</div>
          </Link>
        )}
        {liveCount > 0 && (
          <div className="card sx-stat sx-live">
            <div className="sx-num tnum">{liveCount}</div>
            <div className="sx-lbl">
              <span className="sx-live-dot" />
              {t('liveNow')}
            </div>
          </div>
        )}
      </div>

      <div className="sx-cols">
        <section className="card card-pad sx-card">
          <h2>{t('topScorers')}</h2>
          {rankedScorers.length === 0 ? (
            <div className="empty">{t('noStatsYet')}</div>
          ) : (
            <table className="sx-table">
              <thead>
                <tr>
                  <th />
                  <th />
                  <th />
                  <th className="sx-goals-h">{t('goals')}</th>
                </tr>
              </thead>
              <tbody>
                {rankedScorers.map((s) => {
                  const team = teams[s.code]
                  return (
                    <tr key={s.id}>
                      <td className="sx-pos tnum">{s.rank}</td>
                      <td className="sx-player">{s.name}</td>
                      <td className="sx-team-cell">
                        {team ? (
                          <Link to={`/team/${s.code}`} className="team-inline sx-team">
                            <Flag team={team} size={20} />
                            <span className="nm">{s.code}</span>
                          </Link>
                        ) : (
                          <span className="muted small">{s.code}</span>
                        )}
                      </td>
                      <td className="sx-goals tnum">{s.goals}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {(stats.cards?.players.length ?? 0) > 0 && (
          <section className="card card-pad sx-card">
            <h2>{t('statCards')}</h2>
            <table className="sx-table">
              <thead>
                <tr>
                  <th />
                  <th />
                  <th className="sx-goals-h">🟨</th>
                  <th className="sx-goals-h">🟥</th>
                </tr>
              </thead>
              <tbody>
                {(stats.cards?.players ?? []).map((c) => {
                  const team = teams[c.code]
                  return (
                    <tr key={c.id}>
                      <td className="sx-player">{c.name}</td>
                      <td className="sx-team-cell">
                        {team ? (
                          <Link to={`/team/${c.code}`} className="team-inline sx-team">
                            <Flag team={team} size={20} />
                            <span className="nm">{c.code}</span>
                          </Link>
                        ) : (
                          <span className="muted small">{c.code}</span>
                        )}
                      </td>
                      <td className="sx-goals tnum">{c.y || ''}</td>
                      <td className="sx-goals tnum">{c.r || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        <section className="card card-pad sx-card">
          <h2>{t('fifaRanking')}</h2>
          <div className="sx-rank-list">
            {ranked.map((team) => (
              <div key={team.code} className="sx-rank-row">
                <span className="sx-rank-no tnum">{team.ranking ?? t('none')}</span>
                <TeamName code={team.code} flagSize={20} className="sx-rank-team" />
                <span className="chip">{t('groupX', { x: team.group })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
