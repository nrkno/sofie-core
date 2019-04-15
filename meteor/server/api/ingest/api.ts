import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { Methods, setMeteorMethods } from '../../methods'

import { RundownInput } from './rundownInput'

let methods: Methods = {}

// methods['debug_rundownRunBlueprints'] = (rundownId: string, deleteFirst?: boolean) => {
// 	check(rundownId, String)
// 	const rundown = Rundowns.findOne(rundownId)
// 	if (!rundown) throw new Meteor.Error(404, 'Rundown not found')
// 	const ingestRundown = loadCachedRundownData(rundownId)
// 	if (deleteFirst) rundown.remove()
// 	const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
// 	if (!peripheralDevice) throw new Meteor.Error(404, 'MOS Device not found to be used for mock rundown!')
// 	handleReceivedRundown(peripheralDevice, ingestRundown, rundown.dataSource)
// 	logger.info('debug_rundownRunBlueprints: infinites')
// 	updateSourceLayerInfinitesAfterLine(rundown)
// 	logger.info('debug_rundownRunBlueprints: done')
// }

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
methods[PeripheralDeviceAPI.methods.dataPieceDelete] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string) => {
	return RundownInput.dataPartDelete(this, deviceId, deviceToken, rundownId, segmentId, partId)
}
methods[PeripheralDeviceAPI.methods.dataPieceCreate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string, newStory: any) => {
	return RundownInput.dataPartCreate(this, deviceId, deviceToken, rundownId, segmentId, partId, newStory)
}
methods[PeripheralDeviceAPI.methods.dataPieceUpdate] = (deviceId: string, deviceToken: string, rundownId: string, segmentId: string, partId: string, newStory: any) => {
	return RundownInput.dataPartUpdate(this, deviceId, deviceToken, rundownId, segmentId, partId, newStory)
}

setMeteorMethods(methods)
