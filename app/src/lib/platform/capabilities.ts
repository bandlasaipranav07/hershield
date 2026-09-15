export interface BatteryState {
  level: number // 0 to 1
  charging: boolean
}

export interface EmergencyPowerManagementCapability {
  isSupported(): boolean
  getBatteryStatus(): Promise<BatteryState | null>
  enableEmergencyPowerSaving(): Promise<{ success: boolean; message: string }>
}

/**
 * Browser implementation of emergency power capability.
 * Explicitly acknowledges browser sandbox constraints: a standard web app cannot
 * force the OS-level battery saver on, but can throttle local background polling/animations.
 */
export class BrowserEmergencyPowerManager implements EmergencyPowerManagementCapability {
  public isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'getBattery' in (navigator as unknown as Record<string, unknown>)
    )
  }

  public async getBatteryStatus(): Promise<BatteryState | null> {
    if (!this.isSupported()) return null
    try {
      const getBat = (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean }> }).getBattery
      const bat = await getBat()
      return {
        level: bat.level,
        charging: bat.charging,
      }
    } catch {
      return null
    }
  }

  public async enableEmergencyPowerSaving(): Promise<{ success: boolean; message: string }> {
    // Gracefully inform caller of platform boundaries
    return {
      success: false,
      message:
        'OS-level emergency power management is unsupported in standard browser sandbox. Handled via application-level throttling.',
    }
  }
}

export const browserPowerManager = new BrowserEmergencyPowerManager()
