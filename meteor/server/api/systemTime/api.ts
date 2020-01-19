import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { Methods, setMeteorMethods } from '../../../lib/methods'
import { determineDiffTime } from './systemTime'
import { getCurrentTime, systemTime } from '../../../lib/lib'

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.determineDiffTime] = () => {
	return determineDiffTime({
		maxSampleCount: 20,
		minSampleCount: 10,
		maxAllowedDelay: 500
	})
}
methods[PeripheralDeviceAPI.methods.getTimeDiff] = () => {
	return {
		currentTime: getCurrentTime(),
		systemRawTime: Date.now(),
		diff: systemTime.diff,
		stdDev: systemTime.stdDev,
		good: (systemTime.stdDev < 1000 / 50)
	}
}
methods[PeripheralDeviceAPI.methods.getTime] = () => {
	return getCurrentTime()
}
setMeteorMethods(methods)
