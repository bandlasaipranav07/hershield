/**
 * HerShield Emergency Contact Messaging Engine
 * Dispatches real SMS and WhatsApp distress alerts directly to emergency contact phone numbers.
 */

import type { Contact } from '../contacts'

const WEBHOOK_STORAGE_KEY = 'hershield_sms_webhook_url'

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return ''
  // Preserve leading + if present, strip spaces, dashes, dots, parens
  const hasPlus = phone.trim().startsWith('+')
  const digits = phone.replace(/\D/g, '')
  return hasPlus ? `+${digits}` : digits
}

export function cleanWhatsAppNumber(phone: string): string {
  // WhatsApp wa.me requires digits only including country code
  return phone.replace(/\D/g, '')
}

export function composeEmergencyMessage(
  userName?: string,
  location?: { lat: number; lng: number } | null,
): string {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const sender = userName ? `from ${userName}` : ''
  let text = `🚨 EMERGENCY SOS ALERT ${sender}! I need urgent help.`
  if (location && location.lat && location.lng) {
    text += ` My location: https://maps.google.com/?q=${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
  }
  text += ` (Sent via HerShield at ${timeStr}). Please call me or contact emergency help immediately!`
  return text
}

export function getSmsIntentUrl(phone: string, message: string): string {
  const clean = cleanPhoneNumber(phone)
  // Use universal ?body= parameter compatible with Android and iOS
  return `sms:${clean}?body=${encodeURIComponent(message)}`
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const digits = cleanWhatsAppNumber(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function getTelUrl(phone: string): string {
  return `tel:${cleanPhoneNumber(phone)}`
}

export function getCustomWebhookUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(WEBHOOK_STORAGE_KEY) || ''
}

export function setCustomWebhookUrl(url: string): void {
  if (typeof window === 'undefined') return
  if (url && url.trim()) {
    window.localStorage.setItem(WEBHOOK_STORAGE_KEY, url.trim())
  } else {
    window.localStorage.removeItem(WEBHOOK_STORAGE_KEY)
  }
}

/**
 * Triggers native SMS client with pre-filled emergency recipient and text.
 */
export function openSmsApp(phone: string, message: string): void {
  if (typeof window === 'undefined') return
  const url = getSmsIntentUrl(phone, message)
  // On mobile browsers, assigning window.location triggers the native messaging application
  window.location.href = url
}

/**
 * Opens WhatsApp chat with pre-filled emergency text.
 */
export function openWhatsAppChat(phone: string, message: string): void {
  if (typeof window === 'undefined') return
  const url = getWhatsAppUrl(phone, message)
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Initiates direct phone call.
 * Uses an invisible <a> click for maximum browser/PWA compatibility.
 */
export function openPhoneDialer(phone: string): void {
  if (typeof window === 'undefined') return
  const url = getTelUrl(phone)
  // Create a hidden anchor and programmatically click it —
  // this works in Chrome, Safari, Firefox and Android PWAs where
  // window.location.href = 'tel:...' may be silently blocked.
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Dispatches an automated HTTP Webhook to an external SMS gateway (Twilio, Fast2SMS, AWS SNS, etc.)
 * if configured in user settings.
 */
export async function sendWebhookSms(
  contact: Contact,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = getCustomWebhookUrl()
  if (!webhookUrl) {
    return { success: false, error: 'No SMS webhook configured' }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'EMERGENCY_SOS',
        to: contact.phone,
        name: contact.name,
        message,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!res.ok) {
      return { success: false, error: `Webhook error HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook request failed'
    return { success: false, error: msg }
  }
}
