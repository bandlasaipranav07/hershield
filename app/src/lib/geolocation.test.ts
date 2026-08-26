import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPosition } from './geolocation'

type CapturedCallbacks = {
  success?: PositionCallback
  failure?: PositionErrorCallback
  options?: PositionOptions
}

function stubGeolocation(): CapturedCallbacks {
  const captured: CapturedCallbacks = {}
  const geolocation = {
    getCurrentPosition: vi.fn(
      (success: PositionCallback, failure: PositionErrorCallback, options: PositionOptions) => {
        captured.success = success
        captured.failure = failure
        captured.options = options
      },
    ),
  }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  })
  return captured
}

function removeGeolocation() {
  delete (navigator as unknown as Record<string, unknown>).geolocation
}

function makePosition(overrides: Partial<GeolocationCoordinates> = {}): GeolocationPosition {
  const coords = {
    latitude: 17.385,
    longitude: 78.4867,
    accuracy: 12.5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    ...overrides,
  }
  return {
    coords: { ...coords, toJSON: () => coords },
    timestamp: Date.now(),
    toJSON: () => ({ coords, timestamp: Date.now() }),
  }
}

describe('getCurrentPosition', () => {
  afterEach(() => {
    removeGeolocation()
  })

  it('resolves lat/lng/accuracy from a successful fix', async () => {
    const captured = stubGeolocation()

    const pending = getCurrentPosition()
    captured.success?.(makePosition())

    await expect(pending).resolves.toEqual({
      position: { lat: 17.385, lng: 78.4867, accuracy: 12.5 },
      error: null,
    })
  })

  it('maps PERMISSION_DENIED to a friendly message', async () => {
    const captured = stubGeolocation()

    const pending = getCurrentPosition()
    captured.failure?.({ code: 1, message: '' } as GeolocationPositionError)

    await expect(pending).resolves.toEqual({
      position: null,
      error: 'Location permission denied',
    })
  })

  it('maps POSITION_UNAVAILABLE and TIMEOUT', async () => {
    const captured = stubGeolocation()

    const unavailable = getCurrentPosition()
    captured.failure?.({ code: 2, message: '' } as GeolocationPositionError)
    await expect(unavailable).resolves.toEqual({
      position: null,
      error: 'Location unavailable',
    })

    removeGeolocation()
    const second = stubGeolocation()
    const timedOut = getCurrentPosition()
    second.failure?.({ code: 3, message: '' } as GeolocationPositionError)
    await expect(timedOut).resolves.toEqual({
      position: null,
      error: 'Location request timed out',
    })
  })

  it('prefers the browser error message when one exists', async () => {
    const captured = stubGeolocation()

    const pending = getCurrentPosition()
    captured.failure?.({
      code: 2,
      message: 'Network is down',
    } as GeolocationPositionError)

    await expect(pending).resolves.toEqual({
      position: null,
      error: 'Network is down',
    })
  })

  it('reports unsupported browsers without throwing', async () => {
    removeGeolocation()

    await expect(getCurrentPosition()).resolves.toEqual({
      position: null,
      error: 'Geolocation not supported in this browser',
    })
  })

  it('defaults to high accuracy, no cache, and a 10s timeout; caller can override', async () => {
    let captured = stubGeolocation()

    void getCurrentPosition()
    expect(captured.options).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    })

    removeGeolocation()
    captured = stubGeolocation()

    void getCurrentPosition({ timeout: 1000, maximumAge: 30_000 })
    expect(captured.options).toMatchObject({
      enableHighAccuracy: true,
      timeout: 1000,
      maximumAge: 30_000,
    })
  })
})
