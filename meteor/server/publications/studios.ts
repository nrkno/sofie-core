import { Meteor } from 'meteor/meteor'
import { lazyIgnore } from '../../lib/lib'
import { Studios, DBStudio, StudioId, getActiveRoutes, getRoutedMappings } from '../../lib/collections/Studios'
import { StudiosSecurity } from '../security/studios'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDevices, PeripheralDeviceId } from '../../lib/collections/PeripheralDevices'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'
import { meteorCustomPublishArray } from '../lib/customPublication'

meteorPublish(PubSub.studios, (selector, token) => {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<DBStudio> = {
		fields: {},
	}
	if (StudiosSecurity.allowReadAccess(selector, token, this)) {
		return Studios.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.studioOfDevice, (deviceId: PeripheralDeviceId, token) => {
	if (PeripheralDeviceSecurity.allowReadAccess({ _id: deviceId }, token, this)) {
		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const modifier: FindOptions<DBStudio> = {
			fields: {},
		}
		let selector = {
			_id: peripheralDevice.studioId,
		}
		if (StudiosSecurity.allowReadAccess(selector, token, this)) {
			return Studios.find(selector, modifier)
		}
	}
	return null
})

meteorCustomPublishArray(PubSub.mappingsForDevice, 'studioMappings', (pub, deviceId: PeripheralDeviceId, token) => {
	if (PeripheralDeviceSecurity.allowReadAccess({ _id: deviceId }, token, this)) {
		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const studioId = peripheralDevice.studioId

		const triggerUpdate = () => {
			lazyIgnore(
				`studioMappings_${studioId}`,
				() => {
					const studio = Studios.findOne(studioId)
					if (!studio) {
						pub.updatedDocs([])
					} else {
						const routes = getActiveRoutes(studio)
						const routedMappings = getRoutedMappings(studio.mappings, routes)

						pub.updatedDocs([
							{
								_id: studio._id,
								mappings: routedMappings,
							},
						])
					}
				},
				3 // ms
			)
		}

		const observer = Studios.find(studioId).observeChanges({
			added: triggerUpdate,
			changed: triggerUpdate,
			removed: triggerUpdate,
		})
		pub.onStop(() => {
			observer.stop()
		})
		triggerUpdate()
	}
})
