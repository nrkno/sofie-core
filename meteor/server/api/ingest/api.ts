import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { IngestRundown, IngestSegment, IngestPart } from 'tv-automation-sofie-blueprints-integration'
import { Methods, setMeteorMethods } from '../../methods'

import { RundownInput } from './rundownInput'

let methods: Methods = {}

methods[PeripheralDeviceAPI.methods.dataRundownList] = (deviceId: string, deviceToken: string) => {
	return RundownInput.dataRundownList(this, deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.dataRundownGet] = (deviceId: string, deviceToken: string, rundownExternalId: string) => {
	return RundownInput.dataRundownGet(this, deviceId, deviceToken, rundownExternalId)
}
methods[PeripheralDeviceAPI.methods.dataRundownDelete] = (deviceId: string, deviceToken: string, rundownExternalId: string) => {
	return RundownInput.dataRundownDelete(this, deviceId, deviceToken, rundownExternalId)
}
methods[PeripheralDeviceAPI.methods.dataRundownCreate] = (deviceId: string, deviceToken: string, ingestRundown: IngestRundown) => {
	return RundownInput.dataRundownCreate(this, deviceId, deviceToken, ingestRundown)
}
methods[PeripheralDeviceAPI.methods.dataRundownUpdate] = (deviceId: string, deviceToken: string, ingestRundown: IngestRundown) => {
	return RundownInput.dataRundownUpdate(this, deviceId, deviceToken, ingestRundown)
}
methods[PeripheralDeviceAPI.methods.dataSegmentDelete] = (deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string) => {
	return RundownInput.dataSegmentDelete(this, deviceId, deviceToken, rundownExternalId, segmentExternalId)
}
methods[PeripheralDeviceAPI.methods.dataSegmentCreate] = (deviceId: string, deviceToken: string, rundownExternalId: string, ingestSegment: IngestSegment) => {
	return RundownInput.dataSegmentCreate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
}
methods[PeripheralDeviceAPI.methods.dataSegmentUpdate] = (deviceId: string, deviceToken: string, rundownExternalId: string, ingestSegment: IngestSegment) => {
	return RundownInput.dataSegmentUpdate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
}
methods[PeripheralDeviceAPI.methods.dataPartDelete] = (deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string, partExternalId: string) => {
	return RundownInput.dataPartDelete(this, deviceId, deviceToken, rundownExternalId, segmentExternalId, partExternalId)
}
methods[PeripheralDeviceAPI.methods.dataPartCreate] = (deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string, ingestPart: IngestPart) => {
	return RundownInput.dataPartCreate(this, deviceId, deviceToken, rundownExternalId, segmentExternalId, ingestPart)
}
methods[PeripheralDeviceAPI.methods.dataPartUpdate] = (deviceId: string, deviceToken: string, rundownExternalId: string, segmentExternalId: string, ingestPart: IngestPart) => {
	return RundownInput.dataPartUpdate(this, deviceId, deviceToken, rundownExternalId, segmentExternalId, ingestPart)
}

setMeteorMethods(methods)
