import type { Match, Team } from '../types'
import { useI18n } from '../i18n'
import { tournamentRanking } from '../utils/tournamentRanking'
import type { RankBand } from '../utils/tournamentRanking'
import { bandResultLabel } from '../utils/helpers'
import TeamName from './TeamName'

const fmtGd = (n: number): string => (n > 0 ? `+${n}` : String(n))

// tier for the band separators (positions 1–4 | 5–8 | 9–16 | 17–32 | 33–48)
const TIER: Record<RankBand, number> = {
  champion: 0,
  runnerUp: 0,
  third: 0,
  fourth: 0,
  final: 0,
  sf: 0,
  thirdPlay: 0,
  qf: 1,
  r16: 2,
  r32: 3,
  group: 4,
}

/** The FIFA "Tournament ranking": a live final standing of all 48 teams. */
export default function TournamentStanding({
  matches,
  teams,
  fairPlay,
}: {
  matches: Match[]
  teams: Record<string, Team>
  fairPlay?: Record<string, number>
}) {
  const { t } = useI18n()
  const rows = tournamentRanking(matches, teams, fairPlay)
  if (!rows) return null

  return (
    <section id="sx-standing" className="card card-pad ts-card">
      <h2>{t('tsTitle')}</h2>
      <div className="ts-scroll">
        <table className="ts-table tnum" aria-label={t('tsTitle')}>
          <thead>
            <tr>
              <th className="ts-pos" scope="col">
                #
              </th>
              <th className="ts-grp" scope="col">
                {t('group')}
              </th>
              <th className="ts-team" scope="col">
                {t('filterTeams')}
              </th>
              <th scope="col">{t('colP')}</th>
              <th className="ts-xxs" scope="col">
                {t('colW')}
              </th>
              <th className="ts-xxs" scope="col">
                {t('colD')}
              </th>
              <th className="ts-xxs" scope="col">
                {t('colL')}
              </th>
              <th className="ts-xs" scope="col">
                {t('colGF')}
              </th>
              <th className="ts-xs" scope="col">
                {t('colGA')}
              </th>
              <th scope="col">{t('colGD')}</th>
              <th scope="col">{t('colPts')}</th>
              <th className="ts-res" scope="col">
                {t('tsResult')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sep = i > 0 && TIER[r.band] !== TIER[rows[i - 1].band]
              return (
                <tr
                  key={r.code}
                  className={`ts-tr ts-b-${r.band}${r.provisional ? ' ts-prov' : ''}${sep ? ' ts-sep' : ''}`}
                >
                  <td className="ts-pos">{r.pos ?? '•'}</td>
                  <td className="ts-grp">{r.group}</td>
                  <td className="ts-team">
                    <TeamName code={r.code} flagSize={20} />
                  </td>
                  <td>{r.p}</td>
                  <td className="ts-xxs">{r.w}</td>
                  <td className="ts-xxs">{r.d}</td>
                  <td className="ts-xxs">{r.l}</td>
                  <td className="ts-xs">{r.gf}</td>
                  <td className="ts-xs">{r.ga}</td>
                  <td>{fmtGd(r.gd)}</td>
                  <td className="ts-pts">{r.pts}</td>
                  <td className="ts-res">{bandResultLabel(r.band, t)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted ts-note">{t('tsConvNote')}</p>
    </section>
  )
}
