export interface GeoPoint {
  lat: number
  lng: number
  accuracy: number
}

export interface GeoResult {
  position: GeoPoint | null
  error: string | null
}

const DEFAULT_TIMEOUT_MS = 10_000

function describeErrorCode(code: number): string {
  if (code === 1) return 'Location permission denied'
  if (code === 2) return 'Location unavailable'
  if (code === 3) return 'Location request timed out'
  return 'Unknown location error'
}

export async function getCurrentPosition(
  options: PositionOptions = {},
): Promise<GeoResult> {
  if (!('geolocation' in navigator)) {
    return { position: null, error: 'Geolocation not supported in this browser' }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          error: null,
        })
      },
      (err) => {
        resolve({ position: null, error: err.message || describeErrorCode(err.code) })
      },
      { enableHighAccuracy: true, timeout: DEFAULT_TIMEOUT_MS, maximumAge: 0, ...options },
    )
  })
}
