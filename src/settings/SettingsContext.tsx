import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lang, Settings, Theme, TzMode, Units } from '../types'
import { LANG_LABEL, RTL_LANGS } from '../i18n/strings'
import { detectCountry } from '../utils/helpers'

const KEY = 'wc2026-settings'

const LANG_PREFIX: [string, Lang][] = [
  ['fr', 'fr'],
  ['es', 'es'],
  ['pt-br', 'pt-BR'],
  ['pt', 'pt'],
  ['de', 'de'],
  ['nl', 'nl'],
  ['cs', 'cs'],
  ['hr', 'hr'],
  ['sv', 'sv'],
  ['nb', 'no'],
  ['nn', 'no'],
  ['no', 'no'],
  ['ar', 'ar'],
  ['fa', 'fa'],
  ['tr', 'tr'],
  ['uz', 'uz'],
  ['ja', 'ja'],
  ['ko', 'ko'],
  ['zh-tw', 'zh-TW'],
  ['zh-hant', 'zh-TW'],
  ['zh-hk', 'zh-TW'],
  ['zh-mo', 'zh-TW'],
  ['zh', 'zh'],
  ['it', 'it'],
  ['id', 'id'],
  ['ru', 'ru'],
  ['uk', 'uk'],
  ['en', 'en'],
]

function detectLang(): Lang {
  for (const l of navigator.languages || [navigator.language]) {
    const low = (l || '').toLowerCase()
    for (const [prefix, lang] of LANG_PREFIX) {
      if (low.startsWith(prefix)) return lang
    }
  }
  return 'en'
}

function defaults(): Settings {
  let legacyMarket: string | null = null
  try {
    // pre-existing installs stored the watch market under its own key
    legacyMarket = localStorage.getItem('wc2026-market')
  } catch {
    legacyMarket = null
  }
  return {
    lang: detectLang(),
    tzMode: 'local',
    // host-country anchor: most matches and the final are on US Eastern time
    fixedTz: 'America/New_York',
    favorites: [],
    theme: 'auto',
    market: legacyMarket,
    units: detectCountry() === 'US' ? 'imperial' : 'metric',
  }
}

function isValidTz(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function load(): Settings {
  const d = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return d
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('settings: not an object')
    }
    // merge field-by-field, validating each value: a stale/corrupted entry
    // (unknown lang, bad tz, non-array favorites…) must never crash the app
    const p = parsed as Record<string, unknown>
    return {
      lang: typeof p.lang === 'string' && p.lang in LANG_LABEL ? (p.lang as Lang) : d.lang,
      tzMode: p.tzMode === 'local' || p.tzMode === 'venue' || p.tzMode === 'fixed' ? p.tzMode : d.tzMode,
      fixedTz: isValidTz(p.fixedTz) ? p.fixedTz : d.fixedTz,
      favorites: Array.isArray(p.favorites)
        ? p.favorites.filter((c): c is string => typeof c === 'string')
        : d.favorites,
      theme: p.theme === 'auto' || p.theme === 'light' || p.theme === 'dark' ? p.theme : d.theme,
      market: typeof p.market === 'string' ? p.market : d.market,
      units: p.units === 'metric' || p.units === 'imperial' ? p.units : d.units,
    }
  } catch {
    // corrupted storage must not become a persistent crash loop: drop the bad
    // key entirely and boot with defaults
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* blocked storage */
    }
    return d
  }
}

interface SettingsCtx {
  settings: Settings
  setLang: (l: Lang) => void
  setTzMode: (m: TzMode) => void
  setFixedTz: (tz: string) => void
  toggleFavorite: (code: string) => void
  setFavorites: (codes: string[]) => void
  setTheme: (t: Theme) => void
  setMarket: (iso2: string) => void
  setUnits: (u: Units) => void
  reset: () => void
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* private mode */
    }
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
    root.setAttribute('lang', settings.lang === 'zh' ? 'zh-CN' : settings.lang)
    root.setAttribute('dir', RTL_LANGS.has(settings.lang) ? 'rtl' : 'ltr')
    root.setAttribute('data-lang', settings.lang)
  }, [settings.theme, settings.lang])

  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      setLang: (lang) => setSettings((s) => ({ ...s, lang })),
      setTzMode: (tzMode) => setSettings((s) => ({ ...s, tzMode })),
      setFixedTz: (fixedTz) => setSettings((s) => ({ ...s, fixedTz, tzMode: 'fixed' })),
      toggleFavorite: (code) =>
        setSettings((s) => ({
          ...s,
          favorites: s.favorites.includes(code)
            ? s.favorites.filter((c) => c !== code)
            : [...s.favorites, code],
        })),
      setFavorites: (favorites) => setSettings((s) => ({ ...s, favorites })),
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setMarket: (market) => setSettings((s) => ({ ...s, market })),
      setUnits: (units) => setSettings((s) => ({ ...s, units })),
      reset: () => setSettings(defaults()),
    }),
    [settings],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSettings outside SettingsProvider')
  return ctx
}
