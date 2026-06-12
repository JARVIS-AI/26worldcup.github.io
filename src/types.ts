// Data contracts for public/data/*.json produced by scripts/update.mjs

export type Lang =
  | 'en'
  | 'fr'
  | 'es'
  | 'pt'
  | 'pt-BR'
  | 'de'
  | 'nl'
  | 'cs'
  | 'hr'
  | 'sv'
  | 'no'
  | 'ar'
  | 'fa'
  | 'tr'
  | 'uz'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'zh-TW'
  | 'it'
  | 'id'
  | 'ru'
  | 'uk'

export type LocalizedName = Partial<Record<Lang, string | null>>

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed'

export interface MatchSide {
  code: string
  score: number | null
  pen: number | null
}

export interface Official {
  id: string
  country: string | null
  role: string // 'referee' | 'ar1' | 'ar2' | 'fourth' | 'var' | 'avar' | ...
  name: LocalizedName
  typeName: LocalizedName // FIFA's localized role label, authoritative
}

export interface Match {
  id: string
  n: number
  stage: Stage
  group: string | null
  date: string // UTC ISO
  venueId: string | null
  status: MatchStatus
  time: string | null
  home: MatchSide | null
  away: MatchSide | null
  phA: string | null // placeholder like 'A1', '2B', 'W73', '3ABCDF'
  phB: string | null
  winner: string | null
  attendance: number | null
  officials: Official[]
}

export interface BaseCamp {
  city: string | null
  facility?: string | null
  country?: string | null
  lat?: number
  lon?: number
}

export interface Team {
  code: string
  fifaId: string | null
  group: string
  name: LocalizedName
  iso2: string | null
  ranking: number | null
  rankingPrev: number | null
  baseCamp: BaseCamp | null
  colors: string[]
  nickname: string | null
  web: string | null
  flag: string
}

export interface VenueClimate {
  jun?: { highC: number; lowC: number }
  jul?: { highC: number; lowC: number }
  rainNote?: string | LocalizedName | null
  roof?: string | null
}

export interface Venue {
  id: string
  realName: string
  city: string
  country: 'US' | 'CA' | 'MX'
  lat: number
  lon: number
  tz: string
  capacity: number
  roof: 'open' | 'canopy' | 'retractable' | 'fixed'
  note: string | null
  wiki: { title: string; url: string } | null
  fifaName: LocalizedName | null
  cityName: LocalizedName | null
  climate: VenueClimate | null
  matches: string[]
}

export interface StandingRow {
  code: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  gd: number
  pts: number
  rank: number
}

export interface ThirdRow extends StandingRow {
  group: string
  thirdRank: number
  qualifies: boolean | null
}

export interface Standings {
  groups: Record<string, StandingRow[]>
  thirds: ThirdRow[]
  complete: Record<string, boolean>
}

export interface LineupPlayer {
  id: string
  name: string | null
  number: number | null
  captain: boolean
  gk: boolean
  start: boolean
  fieldPos: number | null
  x: number | null
  y: number | null
}

export interface TeamLineup {
  tactics: string | null
  xi: LineupPlayer[]
  subs: LineupPlayer[]
  goals: { player: string; minute: string | null; type: number | null; period: number | null }[]
  bookings: { player: string; minute: string | null; card: number | null; period: number | null }[]
  substitutions?: { off: string; on: string; minute: string | null; period: number | null }[]
}

export interface MatchLineups {
  home: TeamLineup | null
  away: TeamLineup | null
  matchTime: string | null
  period: number | null
  final: boolean
}

export interface WeatherInfo {
  tC: number
  feelsC: number
  pp: number | null
  code: number
  windKmh: number
  rh: number
  fetchedAt: string
}

export type PosBucket = 'GK' | 'DF' | 'MF' | 'FW'

export interface SquadPlayer {
  id: string
  no: number | null
  pos: PosBucket
  name: string
  dob: string | null
  caps: number | null
  goals: number | null
  club: string | null
  clubNat: string | null
  captain: boolean
  wiki: string | null // English Wikipedia article URL
}

export interface TeamSquad {
  coach: string | null
  wiki: { title: string; url: string } | null
  players: SquadPlayer[]
}

export interface BroadcastChannel {
  name: string
  type: 'tv' | 'streaming' | 'tv+streaming'
  free: boolean
  lang: string | null
  note: string | LocalizedName | null
}

export interface BroadcastMarket {
  iso2: string
  channels: BroadcastChannel[]
  source: string | null
}

export interface Broadcasters {
  markets: BroadcastMarket[]
  asOf?: string
}

export interface MatchProbs {
  h: number
  d: number
  a: number
  ah?: number // knockout: advance incl. ET + pens
  eh?: number // knockout path: win in extra time (home/away)
  ea?: number
  ph?: number // knockout path: win on penalties (home/away)
  pa?: number
}

export interface Stats {
  scorers: { id: string; name: string; code: string; goals: number; ownGoals: number }[]
  cards?: {
    yellow: number
    red: number
    players: { id: string; name: string; code: string; y: number; r: number }[]
  }
  attAvg?: number | null
  biggestWin?: { diff: number; id?: string; h: string; a: string; hs: number; as: number } | null
  fastestGoal?: { min: number; minute: string; name: string; code: string | null; id?: string } | null
  upset?: { p: number; id: string; h: string; a: string; hs: number; as: number } | null
}

export interface Meta {
  updatedAt: string
  season: string
  titleOdds?: { c: string; p: number }[]
  counts: Record<string, number>
  errors: string[]
  sources: string[]
}

export interface AppData {
  meta: Meta
  matches: Match[]
  teams: Record<string, Team>
  venues: Record<string, Venue>
  standings: Standings
  weather: Record<string, WeatherInfo>
  lineups: Record<string, MatchLineups>
  stats: Stats
  probs: Record<string, MatchProbs>
  broadcasters: Broadcasters | null
}

export type Squads = Record<string, TeamSquad>

// ---- settings ----

export type TzMode = 'local' | 'venue' | 'fixed'

export type Theme = 'auto' | 'light' | 'dark'

export type Units = 'metric' | 'imperial'

export interface Settings {
  lang: Lang
  tzMode: TzMode
  fixedTz: string
  favorites: string[] // team codes; empty = all teams
  theme: Theme
  market: string | null // ISO2 country for TV channels; null = auto-detect
  units: Units // °C+km/h vs °F+mph
}
