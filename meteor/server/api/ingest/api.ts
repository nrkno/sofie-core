import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { Methods, setMeteorMethods } from '../../methods'

import { RundownInput } from './rundownInput'

let methods: Methods = {}

methods[PeripheralDeviceAPI.methods.dataRundownDelete] = (deviceId: string, deviceToken: string, rundownId: string) => {
	return RundownInput.dataRundownDelete(this, deviceId, deviceToken, rundownId)
}
methods[PeripheralDeviceAPI.methods.dataRundownCreate] = (deviceId: string, deviceToken: string, rundownId: string, rundownData: any) => {
	return RundownInput.dataRundownCreate(this, deviceId, deviceToken, rundownId, rundownData)
}
methods[PeripheralDeviceAPI.methods.dataRundownUpdate] = (deviceId: string, deviceToken: string, rundownId: string, rundownData: any) => {
	return RundownInput.dataRundownUpdate(this, deviceId, deviceToken, rundownId, rundownData)
}
methods[PeripheralDeviceAPI.methods.dataSegmentDelete] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string) => {
	return RundownInput.dataSegmentDelete(this, deviceId, deviceToken, rundownId, segmentId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentCreate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) => {
	return RundownInput.dataSegmentCreate(this, deviceId, deviceToken, rundownId, segmentId, newSection)
}
methods[PeripheralDeviceAPI.methods.dataSegmentUpdate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, newSection: any) => {
	return RundownInput.dataSegmentUpdate(this, deviceId, deviceToken, rundownId, segmentId, newSection)
}
methods[PeripheralDeviceAPI.methods.dataPartDelete] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string) => {
	return RundownInput.dataPartDelete(this, deviceId, deviceToken, rundownId, segmentId, partId)
}
methods[PeripheralDeviceAPI.methods.dataPartCreate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string, newStory: any) => {
	return RundownInput.dataPartCreate(this, deviceId, deviceToken, rundownId, segmentId, partId, newStory)
}
methods[PeripheralDeviceAPI.methods.dataPartUpdate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string, newStory: any) => {
	return RundownInput.dataPartUpdate(this, deviceId, deviceToken, rundownId, segmentId, partId, newStory)
}

setMeteorMethods(methods)
