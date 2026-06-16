import type { Settings, Venue } from '../types'

/** resolve the IANA timezone to display a given match in, per user settings */
export function displayTz(settings: Settings, venue: Venue | null | undefined): string | undefined {
  if (settings.tzMode === 'venue') return venue?.tz ?? undefined
  if (settings.tzMode === 'fixed') return settings.fixedTz
  return undefined // browser local
}

// Intl.DateTimeFormat construction is expensive (~0.2-1 ms); memoize instances
// by locale + options so list pages (100+ matches) reuse the same formatters
const dtfCache = new Map<string, Intl.DateTimeFormat>()
function getFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`
  let fmt = dtfCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options)
    dtfCache.set(key, fmt)
  }
  return fmt
}

export function fmtTime(dateIso: string, locale: string, tz?: string): string {
  return getFormatter(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(dateIso))
}

export function fmtDate(dateIso: string, locale: string, tz?: string): string {
  return getFormatter(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: tz,
  }).format(new Date(dateIso))
}

export function fmtDateLong(dateIso: string, locale: string, tz?: string): string {
  return getFormatter(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz,
  }).format(new Date(dateIso))
}

export function fmtDateTime(dateIso: string, locale: string, tz?: string): string {
  return getFormatter(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(dateIso))
}

/** localized "11 June 2026"-style calendar date, formatted in UTC so a fixed
 * calendar day (e.g. a ranking release date) never shifts across user timezones */
export function fmtCalendarDate(dateIso: string, locale: string): string {
  return getFormatter(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateIso))
}

export function tzAbbr(dateIso: string, locale: string, tz?: string): string {
  const parts = getFormatter(locale, {
    timeZone: tz,
    timeZoneName: 'short',
    hour: 'numeric',
  }).formatToParts(new Date(dateIso))
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
}

/** calendar day key (YYYY-MM-DD) of a date in a given tz — used for grouping by day */
export function dayKey(dateIso: string, tz?: string): string {
  return getFormatter('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  }).format(new Date(dateIso))
}

/** -1 yesterday, 0 today, 1 tomorrow, else null */
export function relativeDay(dateIso: string, tz?: string): number | null {
  const target = dayKey(dateIso, tz)
  const now = Date.now()
  for (const off of [-1, 0, 1]) {
    if (dayKey(new Date(now + off * 86400e3).toISOString(), tz) === target) return off
  }
  return null
}

/** common IANA timezones offered in the settings picker */
export const COMMON_TZS = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Lima',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Lisbon',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Zagreb',
  'Europe/Istanbul',
  'Africa/Casablanca',
  'Africa/Algiers',
  'Africa/Tunis',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Dakar',
  'Africa/Abidjan',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Baghdad',
  'Asia/Tehran',
  'Asia/Amman',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Singapore',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Tashkent',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
  'UTC',
]

export function allTimezones(): string[] {
  try {
    const sup = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
      'timeZone',
    )
    if (sup?.length) return sup
  } catch {
    /* older browsers */
  }
  return COMMON_TZS
}
