const STORAGE_KEY = 'hershield.voice_consent'

export function hasVoiceConsent(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'granted'
  } catch {
    return false
  }
}

export function grantVoiceConsent(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'granted')
  } catch {
    return
  }
}

export function revokeVoiceConsent(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}
