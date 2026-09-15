export type ArmState = 'DISARMED' | 'ARMED' | 'GUARDIAN_WATCH' | 'TIMED_ARM'

export interface TimedArmOptions {
  durationMs: number
}

export interface DisarmAuthenticator {
  validatePin(pin: string): Promise<boolean> | boolean
}

export interface SimplePinAuthenticator extends DisarmAuthenticator {
  configuredPin: string
  validatePin(pin: string): boolean
}

export function createPinAuthenticator(correctPin: string): SimplePinAuthenticator {
  return {
    configuredPin: correctPin,
    validatePin(pin: string) {
      return pin === correctPin
    },
  }
}

export interface ArmTransitionResult {
  success: boolean
  previousState: ArmState
  currentState: ArmState
  error?: string
  expiresAt?: number | null
}

export type ArmStateListener = (state: ArmState, previousState: ArmState) => void

export class ArmStateMachine {
  private _state: ArmState = 'DISARMED'
  private _expiresAt: number | null = null
  private _timer: ReturnType<typeof setTimeout> | null = null
  private _authenticator: DisarmAuthenticator | null = null
  private _listeners: Set<ArmStateListener> = new Set()

  constructor(initialState: ArmState = 'DISARMED', authenticator?: DisarmAuthenticator) {
    this._state = initialState
    if (authenticator) {
      this._authenticator = authenticator
    }
  }

  public get state(): ArmState {
    return this._state
  }

  public get isArmed(): boolean {
    return this._state !== 'DISARMED'
  }

  public get expiresAt(): number | null {
    return this._expiresAt
  }

  public setAuthenticator(authenticator: DisarmAuthenticator | null): void {
    this._authenticator = authenticator
  }

  public subscribe(listener: ArmStateListener): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  private notify(previousState: ArmState): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state, previousState)
      } catch (err) {
        console.error('Error in ArmState listener:', err)
      }
    }
  }

  private clearTimer(): void {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this._expiresAt = null
  }

  public arm(): ArmTransitionResult {
    const prev = this._state
    if (this._state === 'ARMED') {
      return { success: true, previousState: prev, currentState: this._state }
    }
    this.clearTimer()
    this._state = 'ARMED'
    this.notify(prev)
    return { success: true, previousState: prev, currentState: this._state }
  }

  public armGuardianWatch(): ArmTransitionResult {
    const prev = this._state
    if (this._state === 'GUARDIAN_WATCH') {
      return { success: true, previousState: prev, currentState: this._state }
    }
    this.clearTimer()
    this._state = 'GUARDIAN_WATCH'
    this.notify(prev)
    return { success: true, previousState: prev, currentState: this._state }
  }

  public armTimed(options: TimedArmOptions): ArmTransitionResult {
    if (!options || typeof options.durationMs !== 'number' || options.durationMs <= 0) {
      return {
        success: false,
        previousState: this._state,
        currentState: this._state,
        error: 'Timed arm requires a positive duration in milliseconds',
      }
    }

    const prev = this._state
    this.clearTimer()

    this._expiresAt = Date.now() + options.durationMs
    this._state = 'TIMED_ARM'

    this._timer = setTimeout(() => {
      if (this._state === 'TIMED_ARM') {
        const timeoutPrev = this._state
        this._state = 'DISARMED'
        this._expiresAt = null
        this._timer = null
        this.notify(timeoutPrev)
      }
    }, options.durationMs)

    this.notify(prev)
    return {
      success: true,
      previousState: prev,
      currentState: this._state,
      expiresAt: this._expiresAt,
    }
  }

  public async disarm(pin?: string): Promise<ArmTransitionResult> {
    const prev = this._state
    if (this._state === 'DISARMED') {
      return { success: true, previousState: prev, currentState: this._state }
    }

    if (this._authenticator) {
      if (!pin) {
        return {
          success: false,
          previousState: prev,
          currentState: this._state,
          error: 'PIN required to disarm',
        }
      }
      const isValid = await this._authenticator.validatePin(pin)
      if (!isValid) {
        return {
          success: false,
          previousState: prev,
          currentState: this._state,
          error: 'Invalid disarm PIN',
        }
      }
    }

    this.clearTimer()
    this._state = 'DISARMED'
    this.notify(prev)
    return { success: true, previousState: prev, currentState: this._state }
  }
}
