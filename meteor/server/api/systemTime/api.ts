import { TimeDiff } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { getCurrentTime, systemTime } from '../../../lib/lib'

export function getTimeDiff(): TimeDiff {
	return {
		currentTime: getCurrentTime(),
		systemRawTime: Date.now(),
		diff: systemTime.diff,
		stdDev: systemTime.stdDev,
		good: systemTime.stdDev < 1000 / 50,
	}
}
