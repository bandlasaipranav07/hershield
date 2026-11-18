function scopedKey(resourceKey: string, userId: string): string {
  return `${resourceKey}:${encodeURIComponent(userId)}`
}

function readArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? (value as T[]) : []
  } catch {
    return []
  }
}

export function readOwnedRows<T extends { user_id: string }>(
  resourceKey: string,
  userId: string,
): T[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const key = scopedKey(resourceKey, userId)
    const scopedRaw = localStorage.getItem(key)
    if (scopedRaw !== null) {
      return readArray<T>(scopedRaw).filter((row) => row.user_id === userId)
    }

    // Import only legacy rows that already carry this exact owner. Keep the
    // original key intact so a migration never deletes or reassigns user data.
    const legacyRows = readArray<T>(localStorage.getItem(resourceKey)).filter(
      (row) => row.user_id === userId,
    )
    if (legacyRows.length > 0) localStorage.setItem(key, JSON.stringify(legacyRows))
    return legacyRows
  } catch {
    return []
  }
}

export function writeOwnedRows<T extends { user_id: string }>(
  resourceKey: string,
  userId: string,
  rows: T[],
): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      scopedKey(resourceKey, userId),
      JSON.stringify(rows.filter((row) => row.user_id === userId)),
    )
  } catch {
    // Local storage may be disabled or full. Callers still report the actual
    // operation result, and the demo never treats this as a cloud write.
  }
}
