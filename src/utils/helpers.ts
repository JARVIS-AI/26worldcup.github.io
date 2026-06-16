import type { Lang, LocalizedName, Match, Stage, Standings, Team } from '../types'
import fifaIso from '../data/fifa-iso.json'

/** resolve a data note that may be a plain string (legacy) or a {en,zh,fr} object */
export function localizedNote(
  note: string | LocalizedName | null | undefined,
  pick: (n: LocalizedName | null | undefined, fallback?: string) => string,
): string | null {
  if (!note) return null
  if (typeof note === 'string') return note
  return pick(note) || null
}

/** FIFA 3-letter country code -> ISO2 (for flags & Intl.DisplayNames); null when unknown */
export function fifaToIso2(code: string | null | undefined): string | null {
  if (!code) return null
  return (fifaIso.map as Record<string, string>)[code] ?? null
}

export const STAGE_LABEL_KEY: Record<Stage, string> = {
  group: 'stageGroup',
  r32: 'stageR32',
  r16: 'stageR16',
  qf: 'stageQf',
  sf: 'stageSf',
  third: 'stageThird',
  final: 'stageFinal',
}

export const STAGE_ORDER: Stage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']

// FIFA match-centre deep link: /{lang}/match-centre/match/{idCompetition}/{idSeason}/{idStage}/{idMatch}.
// idCompetition (17 = men's World Cup) and idSeason (285023 = 2026) are fixed for the tournament; idStage is
// the numeric FIFA stage id, the inverse of the STAGE_KEY map in scripts/update.mjs.
const FIFA_STAGE_ID: Record<Stage, string> = {
  group: '289273',
  r32: '289287',
  r16: '289288',
  qf: '289289',
  sf: '289290',
  third: '289291',
  final: '289292',
}

// fifa.com serves only these languages; pt-BR collapses to FIFA's single Portuguese edition (mirroring
// DATA_FALLBACK in src/i18n), and every other UI language (zh, zh-TW, fa, nl, …) falls back to English.
const FIFA_SITE_LANG: Partial<Record<Lang, string>> = {
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
  pt: 'pt',
  'pt-BR': 'pt',
  it: 'it',
  id: 'id',
  ko: 'ko',
  ja: 'ja',
  ar: 'ar',
}

export function fifaMatchUrl(match: Match, lang: Lang): string {
  const sl = FIFA_SITE_LANG[lang] ?? 'en'
  return `https://www.fifa.com/${sl}/match-centre/match/17/285023/${FIFA_STAGE_ID[match.stage]}/${match.id}`
}

// team code -> fifa.com URL slug for the WC2026 squad page. The pages use a name
// slug (not the tri-code) and a few differ from the plain English name, so these
// are verified against fifa.com; anything missing derives from the English name.
export const FIFA_TEAM_SLUG: Record<string, string> = {
  ALG: 'algeria',
  ARG: 'argentina',
  AUS: 'australia',
  AUT: 'austria',
  BEL: 'belgium',
  BIH: 'bosnia-herzegovina',
  BRA: 'brazil',
  CAN: 'canada',
  CIV: 'cote-d-ivoire',
  COD: 'congo-dr',
  COL: 'colombia',
  CPV: 'cabo-verde',
  CRO: 'croatia',
  CUW: 'curacao',
  CZE: 'czechia',
  ECU: 'ecuador',
  EGY: 'egypt',
  ENG: 'england',
  ESP: 'spain',
  FRA: 'france',
  GER: 'germany',
  GHA: 'ghana',
  HAI: 'haiti',
  IRN: 'ir-iran',
  IRQ: 'iraq',
  JOR: 'jordan',
  JPN: 'japan',
  KOR: 'korea-republic',
  KSA: 'saudi-arabia',
  MAR: 'morocco',
  MEX: 'mexico',
  NED: 'netherlands',
  NOR: 'norway',
  NZL: 'new-zealand',
  PAN: 'panama',
  PAR: 'paraguay',
  POR: 'portugal',
  QAT: 'qatar',
  RSA: 'south-africa',
  SCO: 'scotland',
  SEN: 'senegal',
  SUI: 'switzerland',
  SWE: 'sweden',
  TUN: 'tunisia',
  TUR: 'turkiye',
  URU: 'uruguay',
  USA: 'usa',
  UZB: 'uzbekistan',
}
function deriveFifaSlug(en: string): string {
  return en
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
export function fifaSquadUrl(team: Team, lang: Lang): string {
  const sl = FIFA_SITE_LANG[lang] ?? 'en'
  const slug = FIFA_TEAM_SLUG[team.code] || deriveFifaSlug(team.name.en || team.code)
  return `https://www.fifa.com/${sl}/tournaments/mens/worldcup/canadamexicousa2026/teams/${slug}/squad`
}

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC'
// confederation by FIFA tri-code for the 48 WC2026 teams (static)
export const TEAM_CONFEDERATION: Record<string, Confederation> = {
  AUT: 'UEFA',
  BEL: 'UEFA',
  BIH: 'UEFA',
  CRO: 'UEFA',
  CZE: 'UEFA',
  ENG: 'UEFA',
  ESP: 'UEFA',
  FRA: 'UEFA',
  GER: 'UEFA',
  NED: 'UEFA',
  NOR: 'UEFA',
  POR: 'UEFA',
  SCO: 'UEFA',
  SUI: 'UEFA',
  SWE: 'UEFA',
  TUR: 'UEFA',
  ARG: 'CONMEBOL',
  BRA: 'CONMEBOL',
  COL: 'CONMEBOL',
  ECU: 'CONMEBOL',
  PAR: 'CONMEBOL',
  URU: 'CONMEBOL',
  CAN: 'CONCACAF',
  CUW: 'CONCACAF',
  HAI: 'CONCACAF',
  MEX: 'CONCACAF',
  PAN: 'CONCACAF',
  USA: 'CONCACAF',
  ALG: 'CAF',
  CIV: 'CAF',
  COD: 'CAF',
  CPV: 'CAF',
  EGY: 'CAF',
  GHA: 'CAF',
  MAR: 'CAF',
  RSA: 'CAF',
  SEN: 'CAF',
  TUN: 'CAF',
  AUS: 'AFC',
  IRN: 'AFC',
  IRQ: 'AFC',
  JOR: 'AFC',
  JPN: 'AFC',
  KOR: 'AFC',
  KSA: 'AFC',
  QAT: 'AFC',
  UZB: 'AFC',
  NZL: 'OFC',
}
// i18n key holding each confederation's region label (e.g. UEFA -> "Europe")
export const CONF_REGION_KEY: Record<Confederation, string> = {
  UEFA: 'confUEFA',
  CONMEBOL: 'confCONMEBOL',
  CONCACAF: 'confCONCACAF',
  CAF: 'confCAF',
  AFC: 'confAFC',
  OFC: 'confOFC',
}

// flags are downloaded into public/flags/ by `npm run update`: flat, official
// aspect ratio, 120px tall (flagcdn h120); the <Flag> box letterboxes them
const FLAG_BASE = `${import.meta.env.BASE_URL}flags/`

export function flagSrc(iso2: string, remote = false): string {
  const code = iso2.toLowerCase()
  return remote ? `https://flagcdn.com/h120/${code}.png` : `${FLAG_BASE}${code}.png`
}

export function flagUrl(team: Team | null | undefined): string | null {
  if (!team) return null
  if (team.iso2) return flagSrc(team.iso2)
  return team.flag || null
}

export function flagUrlIso(iso2: string | null | undefined): string | null {
  if (!iso2) return null
  return flagSrc(iso2)
}

/** data image paths are repo-relative (img/...) since `npm run update` localizes them */
/** flag emojis are hidden on Windows entirely (no native flag font there; even
 * browsers that bundle one render inconsistently), and elsewhere whenever the
 * platform can't ligate them (a ligated flag measures ~1 glyph wide, a failure ~2) */
let emojiFlagSupport: boolean | null = null
export function supportsEmojiFlags(): boolean {
  if (emojiFlagSupport !== null) return emojiFlagSupport
  if (typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)) {
    emojiFlagSupport = false
    return emojiFlagSupport
  }
  try {
    const cv = document.createElement('canvas')
    const ctx = cv.getContext('2d')
    if (!ctx) {
      emojiFlagSupport = true
      return emojiFlagSupport
    }
    ctx.font = '16px sans-serif'
    const pair = ctx.measureText('\u{1F1E9}\u{1F1EA}').width // 🇩🇪
    const single = ctx.measureText('\u{1F1E9}').width // 🇩
    emojiFlagSupport = pair < single * 1.8
  } catch {
    emojiFlagSupport = true
  }
  return emojiFlagSupport
}

/** emoji flag (with a trailing space) from an ISO2 code, or '' where the platform
 * can't render them; GB-ENG/SCT/WLS use subdivision tag sequences */
export function flagEmoji(iso2: string | null | undefined): string {
  if (!iso2 || !supportsEmojiFlags()) return ''
  const code = iso2.toUpperCase()
  if (code.startsWith('GB-')) {
    const tag = (c: string) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))
    return `\u{1F3F4}${['g', 'b', ...code.slice(3).toLowerCase()].map(tag).join('')}\u{E007F} `
  }
  if (!/^[A-Z]{2}$/.test(code)) return ''
  return `${String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))} `
}

export function assetUrl(p: string | null | undefined): string | null {
  if (!p) return null
  return /^https?:/.test(p) ? p : import.meta.env.BASE_URL + p
}

// IANA timezone -> country, for the broadcast markets we carry. The device
// timezone tracks where the user actually IS (unlike the browser language).
const TZ_COUNTRY: Record<string, string> = {
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Busingen': 'DE',
  'Europe/Madrid': 'ES',
  'Atlantic/Canary': 'ES',
  'Africa/Ceuta': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Lisbon': 'PT',
  'Atlantic/Madeira': 'PT',
  'Atlantic/Azores': 'PT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Zurich': 'CH',
  'Europe/Vienna': 'AT',
  'Europe/Copenhagen': 'DK',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Warsaw': 'PL',
  'Europe/Istanbul': 'TR',
  'Asia/Riyadh': 'SA',
  'Asia/Shanghai': 'CN',
  'Asia/Urumqi': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Africa/Lagos': 'NG',
  'Africa/Johannesburg': 'ZA',
  'Pacific/Auckland': 'NZ',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Los_Angeles': 'US',
  'America/Anchorage': 'US',
  'America/Adak': 'US',
  'Pacific/Honolulu': 'US',
  'America/Detroit': 'US',
  'America/Boise': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'America/Regina': 'CA',
  'America/Moncton': 'CA',
  'America/Whitehorse': 'CA',
  'America/Yellowknife': 'CA',
  'America/Iqaluit': 'CA',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/Chihuahua': 'MX',
  'America/Hermosillo': 'MX',
  'America/Mazatlan': 'MX',
  'America/Matamoros': 'MX',
  'America/Ciudad_Juarez': 'MX',
  'America/Bahia_Banderas': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Manaus': 'BR',
  'America/Fortaleza': 'BR',
  'America/Recife': 'BR',
  'America/Bahia': 'BR',
  'America/Belem': 'BR',
  'America/Campo_Grande': 'BR',
  'America/Cuiaba': 'BR',
  'America/Maceio': 'BR',
  'America/Porto_Velho': 'BR',
  'America/Rio_Branco': 'BR',
  'America/Boa_Vista': 'BR',
}
const TZ_PREFIX: [string, string][] = [
  ['America/Argentina/', 'AR'],
  ['Australia/', 'AU'],
  ['America/Indiana/', 'US'],
  ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'],
]

/**
 * best-guess broadcast market: device timezone first, then browser-locale region.
 * Returns null when the detected country has no broadcaster data, so callers
 * can show an explicit "pick your country" state instead of a wrong market.
 */
/** best-effort ISO2 country from the device timezone/locale (no permission needed) */
export function detectCountry(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      const c = TZ_COUNTRY[tz] ?? TZ_PREFIX.find(([p]) => tz.startsWith(p))?.[1]
      if (c) return c
    }
  } catch {
    /* fall through */
  }
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    if (region) return region
  } catch {
    /* unknown */
  }
  return null
}

export function fmtTemp(celsius: number, units: 'metric' | 'imperial'): string {
  return units === 'imperial' ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`
}

export function fmtSpeed(kmh: number, units: 'metric' | 'imperial'): string {
  return units === 'imperial' ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`
}

export function detectMarketOrNull(available: ReadonlySet<string>): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) {
      const c = TZ_COUNTRY[tz] ?? TZ_PREFIX.find(([p]) => tz.startsWith(p))?.[1]
      if (c && available.has(c)) return c
    }
  } catch {
    /* fall through to locale */
  }
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    if (!tag) continue
    let region: string | null = null
    try {
      const r = new Intl.Locale(tag).region
      if (r && /^[A-Za-z]{2}$/.test(r)) region = r.toUpperCase()
    } catch {
      const m = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(tag)
      region = m ? m[1].toUpperCase() : null
    }
    if (region && available.has(region)) return region
  }
  return null
}

/** like detectMarketOrNull, but falls back to the US market when undetected */
export function detectMarket(available: ReadonlySet<string>): string {
  return detectMarketOrNull(available) ?? 'US'
}

/** weather WMO code -> dictionary key */
export function wmoKey(code: number): string {
  const known = [0, 1, 2, 3, 45, 51, 53, 55, 61, 63, 65, 71, 80, 81, 82, 95, 96, 99]
  if (known.includes(code)) return `wmo${code}`
  if (code >= 95) return 'wmo95'
  if (code >= 80) return 'wmo80'
  if (code >= 71 && code <= 77) return 'wmo71'
  if (code >= 61 && code <= 67) return 'wmo63'
  if (code >= 51 && code <= 57) return 'wmo53'
  if (code >= 40 && code < 50) return 'wmo45'
  return 'wmo2'
}

export function wmoEmoji(code: number): string {
  if (code === 0 || code === 1) return '☀️'
  if (code === 2) return '⛅'
  if (code === 3) return '☁️'
  if (code >= 40 && code < 50) return '🌫️'
  if (code >= 51 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '🌨️'
  if (code >= 80 && code <= 82) return '🌦️'
  if (code >= 95) return '⛈️'
  return '🌤️'
}

/**
 * Human label for a knockout placeholder like 'A1', '2B', 'W73', 'RU101', '3ABCDF'.
 * Returns a translation request the caller resolves with t().
 */
export function placeholderLabel(
  ph: string,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (/^[A-L][1-4]$/.test(ph)) return t('nthOfGroup', { x: ph[0], rank: t(`ordinal${ph[1]}`) })
  if (/^[1-4][A-L]$/.test(ph)) return t('nthOfGroup', { x: ph[1], rank: t(`ordinal${ph[0]}`) })
  if (/^W\d+$/.test(ph)) return t('winnerOf', { n: ph.slice(1) })
  if (/^RU\d+$/.test(ph)) return t('loserOf', { n: ph.slice(2) })
  if (/^3[A-L]+$/.test(ph)) return t('thirdOfGroups', { x: ph.slice(1).split('').join('/') })
  return ph
}

/** does this match involve any of the given team codes (empty set = all match) */
export function involvesTeams(m: Match, codes: string[]): boolean {
  if (!codes.length) return true
  return codes.some((c) => m.home?.code === c || m.away?.code === c)
}

/** matches sorted by official match number (already sorted by update script, but be safe) */
export function sortMatches(matches: Match[]): Match[] {
  return matches.slice().sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.n - b.n)
}

export type QualState = 'through' | 'third' | 'out' | null

/** qualification state of a row for group-table coloring, only when group complete */
export function qualState(standings: Standings, group: string, rank: number, code: string): QualState {
  if (!standings.complete[group]) return null
  if (rank <= 2) return 'through'
  if (rank === 4) return 'out'
  const third = standings.thirds.find((tr) => tr.code === code)
  if (third?.qualifies === true) return 'through'
  if (third?.qualifies === false) return 'out'
  return 'third'
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** build an .ics calendar for the given matches */
export function buildIcs(
  matches: Match[],
  titleOf: (m: Match) => string,
  locationOf: (m: Match) => string,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wc2026-app//2026 World Cup//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:2026 World Cup',
  ]
  const fmt = (ms: number) => {
    const d = new Date(ms)
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`
  }
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/[,;]/g, (c) => `\\${c}`)
      .replace(/\r?\n/g, '\\n')
  // RFC 5545 line folding: content lines longer than 75 octets are split with CRLF + space
  const encoder = new TextEncoder()
  const fold = (line: string): string => {
    if (encoder.encode(line).length <= 75) return line
    const parts: string[] = []
    let cur = ''
    let len = 0
    for (const ch of line) {
      const n = encoder.encode(ch).length
      if (len + n > 75) {
        parts.push(cur)
        cur = ' '
        len = 1
      }
      cur += ch
      len += n
    }
    parts.push(cur)
    return parts.join('\r\n')
  }
  for (const m of matches) {
    const start = Date.parse(m.date)
    lines.push(
      'BEGIN:VEVENT',
      `UID:wc2026-${m.id}@wc2026.app`,
      `DTSTAMP:${fmt(Date.now())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(start + 2 * 3600e3)}`,
      `SUMMARY:${esc(titleOf(m))}`,
      `LOCATION:${esc(locationOf(m))}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

export function download(filename: string, content: string, mime = 'text/calendar'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // revoke later: revoking immediately can abort the download in Firefox/Safari
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** all twelve groups finished -> the knockout phase drives the UI */
export function groupStageComplete(
  standings: { complete: Record<string, boolean> } | null | undefined,
): boolean {
  if (!standings) return false
  const flags = Object.values(standings.complete)
  return flags.length >= 12 && flags.every(Boolean)
}
