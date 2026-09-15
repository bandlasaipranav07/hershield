import type { EmergencyEventType } from '../events'
import type { RiskLevel, SafetyMode, JourneyStatus } from '../risk/riskEngine'
import type { GeoPoint } from '../geolocation'

export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED'

export interface LocalIncidentRecord {
  localId: string
  cloudId?: string | null
  userId?: string | null
  eventType: EmergencyEventType
  riskLevel: RiskLevel
  intentLevel?: string | null
  threatLevel?: string | null
  safetyMode?: SafetyMode | null
  journeyStatus?: JourneyStatus | null
  transcript?: string | null
  transcriptSummary?: string | null
  triggerSource?: string | null
  location?: GeoPoint | null
  asrConfidence?: number | null
  decisionReason?: string | null
  createdAt: string
  syncStatus: SyncStatus
  syncRetryCount: number
  lastSyncError?: string | null
}

const DB_NAME = 'hershield_local_db'
const DB_VERSION = 1
const STORE_NAME = 'incidents'

export class LocalIncidentStore {
  private _memoryStore: Map<string, LocalIncidentRecord> = new Map()
  private _useIndexedDb = typeof indexedDB !== 'undefined'

  private async getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!this._useIndexedDb) {
        return reject(new Error('IndexedDB not supported'))
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' })
          store.createIndex('syncStatus', 'syncStatus', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  public async saveIncident(
    incident: Omit<LocalIncidentRecord, 'localId' | 'createdAt' | 'syncStatus' | 'syncRetryCount'> & {
      localId?: string
      createdAt?: string
    },
  ): Promise<LocalIncidentRecord> {
    const record: LocalIncidentRecord = {
      ...incident,
      localId: incident.localId ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}_${Math.random()}`),
      createdAt: incident.createdAt ?? new Date().toISOString(),
      syncStatus: 'PENDING',
      syncRetryCount: 0,
    }

    if (!this._useIndexedDb) {
      this._memoryStore.set(record.localId, record)
      return record
    }

    try {
      const db = await this.getDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.put(record)
        req.onsuccess = () => resolve(record)
        req.onerror = () => reject(req.error)
      })
    } catch {
      this._memoryStore.set(record.localId, record)
      return record
    }
  }

  public async getPendingIncidents(): Promise<LocalIncidentRecord[]> {
    if (!this._useIndexedDb) {
      return Array.from(this._memoryStore.values()).filter((r) => r.syncStatus === 'PENDING')
    }

    try {
      const db = await this.getDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const index = store.index('syncStatus')
        const req = index.getAll('PENDING')
        req.onsuccess = () => resolve(req.result as LocalIncidentRecord[])
        req.onerror = () => reject(req.error)
      })
    } catch {
      return Array.from(this._memoryStore.values()).filter((r) => r.syncStatus === 'PENDING')
    }
  }

  public async updateSyncStatus(
    localId: string,
    status: SyncStatus,
    cloudId?: string | null,
    error?: string | null,
  ): Promise<void> {
    if (!this._useIndexedDb) {
      const rec = this._memoryStore.get(localId)
      if (rec) {
        rec.syncStatus = status
        if (cloudId) rec.cloudId = cloudId
        if (error) {
          rec.lastSyncError = error
          rec.syncRetryCount++
        }
      }
      return
    }

    try {
      const db = await this.getDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const getReq = store.get(localId)
        getReq.onsuccess = () => {
          const rec = getReq.result as LocalIncidentRecord | undefined
          if (!rec) return resolve()
          rec.syncStatus = status
          if (cloudId) rec.cloudId = cloudId
          if (error) {
            rec.lastSyncError = error
            rec.syncRetryCount++
          }
          store.put(rec).onsuccess = () => resolve()
        }
        getReq.onerror = () => reject(getReq.error)
      })
    } catch {
      const rec = this._memoryStore.get(localId)
      if (rec) {
        rec.syncStatus = status
        if (cloudId) rec.cloudId = cloudId
        if (error) {
          rec.lastSyncError = error
          rec.syncRetryCount++
        }
      }
    }
  }

  public async listAll(): Promise<LocalIncidentRecord[]> {
    if (!this._useIndexedDb) {
      return Array.from(this._memoryStore.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    }

    try {
      const db = await this.getDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.getAll()
        req.onsuccess = () => {
          const list = req.result as LocalIncidentRecord[]
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          resolve(list)
        }
        req.onerror = () => reject(req.error)
      })
    } catch {
      return Array.from(this._memoryStore.values())
    }
  }

  public clearMemory(): void {
    this._memoryStore.clear()
  }
}

export const localIncidentStore = new LocalIncidentStore()
