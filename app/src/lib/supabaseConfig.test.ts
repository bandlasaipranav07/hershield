import { describe, expect, it } from 'vitest'
import { canEnableDemoMode, hasSupabaseConfiguration } from './supabaseConfig'

describe('Supabase and local demo configuration', () => {
  it('accepts a complete https Supabase configuration', () => {
    expect(hasSupabaseConfiguration('https://example.supabase.co', 'public-anon-key')).toBe(true)
  })

  it('rejects absent, placeholder, and malformed Supabase values', () => {
    expect(hasSupabaseConfiguration(undefined, undefined)).toBe(false)
    expect(hasSupabaseConfiguration('https://your-project-ref.supabase.co', 'public-anon-key')).toBe(false)
    expect(hasSupabaseConfiguration('not-a-url', 'public-anon-key')).toBe(false)
    expect(hasSupabaseConfiguration('https://example.supabase.co', 'placeholder-key')).toBe(false)
  })

  it('enables demo mode whenever the explicit flag is set without Supabase (dev or prod)', () => {
    expect(canEnableDemoMode(true, false, 'true')).toBe(true)
    // Also enabled in production so phone/reload works without bouncing to login
    expect(canEnableDemoMode(false, false, 'true')).toBe(true)
    // Never enabled when Supabase is properly configured
    expect(canEnableDemoMode(true, true, 'true')).toBe(false)
    expect(canEnableDemoMode(false, true, 'true')).toBe(false)
    // Requires the explicit flag
    expect(canEnableDemoMode(true, false, undefined)).toBe(false)
    expect(canEnableDemoMode(false, false, undefined)).toBe(false)
  })
})
