import { beforeEach, describe, expect, it } from 'vitest'
import { grantVoiceConsent, hasVoiceConsent, revokeVoiceConsent } from './consent'

describe('voice consent store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to no consent', () => {
    expect(hasVoiceConsent()).toBe(false)
  })

  it('round-trips grant and revoke', () => {
    grantVoiceConsent()
    expect(hasVoiceConsent()).toBe(true)

    revokeVoiceConsent()
    expect(hasVoiceConsent()).toBe(false)
  })
})
