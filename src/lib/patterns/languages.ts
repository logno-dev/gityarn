export const PATTERN_LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
] as const

export function normalizePatternLanguage(code: string | null | undefined) {
  const cleaned = (code ?? '').trim()
  if (!cleaned) return { code: 'en-US', label: 'English (US)' }
  const found = PATTERN_LANGUAGE_OPTIONS.find((item) => item.code === cleaned)
  if (found) return { code: found.code, label: found.label }
  return { code: cleaned, label: cleaned }
}
