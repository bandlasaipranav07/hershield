const PLACEHOLDER_MARKERS = ['your-project-ref', 'placeholder']

export function hasSupabaseConfiguration(url?: string, anonKey?: string): boolean {
  if (!url?.trim() || !anonKey?.trim()) return false
  const values = [url.toLowerCase(), anonKey.toLowerCase()]
  if (PLACEHOLDER_MARKERS.some((marker) => values.some((value) => value.includes(marker)))) return false

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && parsed.hostname === 'localhost')
  } catch {
    return false
  }
}

export function canEnableDemoMode(
  _isDevelopment: boolean,
  isConfigured: boolean,
  flag: string | undefined,
): boolean {
  // Allow demo mode in both dev and production when explicitly enabled via env flag
  // This ensures the app stays accessible on phones and after page reloads
  return !isConfigured && flag === 'true'
}
