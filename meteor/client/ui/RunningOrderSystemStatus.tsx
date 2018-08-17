import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { RunningOrder } from '../../lib/collections/RunningOrders'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Time } from '../../lib/lib'

interface IProps {
	studioInstallation: StudioInstallation
}

interface ITrackedProps {
	mosStatus: PeripheralDeviceAPI.StatusCode
	mosLastUpdate: Time
	playoutStatus: PeripheralDeviceAPI.StatusCode
}

export const RunningOrderSystemStatus = translateWithTracker((props: IProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	const attachedDevices = PeripheralDevices.find({
		studioInstallationId: props.studioInstallation._id
	}).fetch()

	const mosDevices = attachedDevices.filter(i => i.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE)
	const playoutDevices = attachedDevices.filter(i => i.type === PeripheralDeviceAPI.DeviceType.PLAYOUT)

	return {
		
	}
})(class extends React.Component<Translated<IProps & ITrackedProps>> {

})
