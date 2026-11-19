/**
 * HerShield 9-State Emergency Lifecycle State Machine
 *
 * States:
 * 1. DISARMED: Inactive / standby.
 * 2. ARMED_MONITORING: Actively listening & analyzing audio windows.
 * 3. SUSPICIOUS_EVENT: Transient anomaly or isolated trigger detected.
 * 4. THREAT_ANALYSIS: Corroborated high risk; 10s countdown timer running with cancel option.
 * 5. EMERGENCY_CONFIRMED: Countdown expired or Manual SOS triggered.
 * 6. SOS_DISPATCHING: Dispatching alerts to emergency contacts & cloud.
 * 7. SOS_ACTIVE: Incident active and dispatched.
 * 8. DISPATCH_FAILED: Dispatch error occurred; retry available.
 * 9. INCIDENT_RESOLVED: User verified safety via PIN.
 */

export type EmergencyState =
  | 'DISARMED'
  | 'ARMED_MONITORING'
  | 'SUSPICIOUS_EVENT'
  | 'THREAT_ANALYSIS'
  | 'EMERGENCY_CONFIRMED'
  | 'SOS_DISPATCHING'
  | 'SOS_ACTIVE'
  | 'DISPATCH_FAILED'
  | 'INCIDENT_RESOLVED'

export type EmergencyStateListener = (
  state: EmergencyState,
  previousState: EmergencyState,
  metadata?: Record<string, unknown>,
) => void

export class EmergencyStateMachine {
  private _state: EmergencyState = 'DISARMED'
  private _listeners: Set<EmergencyStateListener> = new Set()
  private _countdownTimer: ReturnType<typeof setTimeout> | null = null
  private _countdownExpiresAt: number | null = null

  constructor(initialState: EmergencyState = 'DISARMED') {
    this._state = initialState
  }

  public get state(): EmergencyState {
    return this._state
  }

  public get isArmed(): boolean {
    return this._state !== 'DISARMED' && this._state !== 'INCIDENT_RESOLVED'
  }

  public get isCountdownActive(): boolean {
    return this._state === 'THREAT_ANALYSIS' && this._countdownExpiresAt !== null
  }

  public get countdownExpiresAt(): number | null {
    return this._countdownExpiresAt
  }

  public subscribe(listener: EmergencyStateListener): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  private notify(previousState: EmergencyState, metadata?: Record<string, unknown>): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state, previousState, metadata)
      } catch (err) {
        console.error('Error in EmergencyStateMachine listener:', err)
      }
    }
  }

  private clearCountdown(): void {
    if (this._countdownTimer) {
      clearTimeout(this._countdownTimer)
      this._countdownTimer = null
    }
    this._countdownExpiresAt = null
  }

  /**
   * Arm the system for monitoring.
   */
  public arm(): boolean {
    if (this._state === 'DISARMED' || this._state === 'INCIDENT_RESOLVED') {
      const prev = this._state
      this._state = 'ARMED_MONITORING'
      this.clearCountdown()
      this.notify(prev)
      return true
    }
    return false
  }

  /**
   * Disarm the system (requires PIN validation in runtime if armed).
   */
  public disarm(): boolean {
    const prev = this._state
    this.clearCountdown()
    this._state = 'DISARMED'
    this.notify(prev)
    return true
  }

  /**
   * Transition to SUSPICIOUS_EVENT when an isolated or ambiguous cue occurs.
   */
  public markSuspicious(metadata?: Record<string, unknown>): boolean {
    if (this._state === 'ARMED_MONITORING') {
      const prev = this._state
      this._state = 'SUSPICIOUS_EVENT'
      this.notify(prev, metadata)
      return true
    }
    return false
  }

  /**
   * Return from SUSPICIOUS_EVENT back to ARMED_MONITORING when cue is not repeated.
   */
  public returnToMonitoring(): boolean {
    if (this._state === 'SUSPICIOUS_EVENT') {
      const prev = this._state
      this._state = 'ARMED_MONITORING'
      this.notify(prev)
      return true
    }
    return false
  }

  /**
   * Start Threat Analysis with a mandatory confirmation countdown.
   */
  public startThreatAnalysis(
    countdownSeconds: number,
    onCountdownExpired: () => void,
    metadata?: Record<string, unknown>,
  ): boolean {
    if (
      this._state === 'ARMED_MONITORING' ||
      this._state === 'SUSPICIOUS_EVENT'
    ) {
      const prev = this._state
      this._state = 'THREAT_ANALYSIS'
      this.clearCountdown()

      this._countdownExpiresAt = Date.now() + countdownSeconds * 1000
      this._countdownTimer = setTimeout(() => {
        this.clearCountdown()
        if (this._state === 'THREAT_ANALYSIS') {
          this.confirmEmergency({ reason: 'Countdown expired without cancellation' })
          onCountdownExpired()
        }
      }, countdownSeconds * 1000)

      this.notify(prev, { ...metadata, expiresAt: this._countdownExpiresAt })
      return true
    }
    return false
  }

  /**
   * Cancel the threat analysis countdown and return to monitoring.
   */
  public cancelThreatAnalysis(): boolean {
    if (this._state === 'THREAT_ANALYSIS') {
      this.clearCountdown()
      const prev = this._state
      this._state = 'ARMED_MONITORING'
      this.notify(prev, { cancelledByUser: true })
      return true
    }
    return false
  }

  /**
   * Transition to EMERGENCY_CONFIRMED.
   */
  public confirmEmergency(metadata?: Record<string, unknown>): boolean {
    if (
      this._state === 'ARMED_MONITORING' ||
      this._state === 'SUSPICIOUS_EVENT' ||
      this._state === 'THREAT_ANALYSIS'
    ) {
      this.clearCountdown()
      const prev = this._state
      this._state = 'EMERGENCY_CONFIRMED'
      this.notify(prev, metadata)
      return true
    }
    return false
  }

  /**
   * Mark SOS as actively dispatching.
   */
  public markDispatching(metadata?: Record<string, unknown>): boolean {
    if (this._state === 'EMERGENCY_CONFIRMED' || this._state === 'DISPATCH_FAILED') {
      const prev = this._state
      this._state = 'SOS_DISPATCHING'
      this.notify(prev, metadata)
      return true
    }
    return false
  }

  /**
   * Mark SOS active once dispatched.
   */
  public markSosActive(metadata?: Record<string, unknown>): boolean {
    if (this._state === 'SOS_DISPATCHING' || this._state === 'EMERGENCY_CONFIRMED') {
      const prev = this._state
      this._state = 'SOS_ACTIVE'
      this.notify(prev, metadata)
      return true
    }
    return false
  }

  /**
   * Mark dispatch as failed.
   */
  public markDispatchFailed(error: string): boolean {
    if (this._state === 'SOS_DISPATCHING') {
      const prev = this._state
      this._state = 'DISPATCH_FAILED'
      this.notify(prev, { error })
      return true
    }
    return false
  }

  /**
   * Resolve the active incident and transition to INCIDENT_RESOLVED.
   */
  public resolveIncident(): boolean {
    if (
      this._state === 'SOS_ACTIVE' ||
      this._state === 'DISPATCH_FAILED' ||
      this._state === 'EMERGENCY_CONFIRMED'
    ) {
      this.clearCountdown()
      const prev = this._state
      this._state = 'INCIDENT_RESOLVED'
      this.notify(prev)
      return true
    }
    return false
  }
}
