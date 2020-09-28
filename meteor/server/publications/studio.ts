import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Studios, DBStudio, getActiveRoutes, getRoutedMappings, Studio, StudioId } from '../../lib/collections/Studios'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../lib/collections/ExternalMessageQueue'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { StudioReadAccess } from '../security/studio'
import { OrganizationReadAccess } from '../security/organization'
import { FindOptions } from '../../lib/typings/meteor'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver } from '../lib/optimizedObserver'

meteorPublish(PubSub.studios, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	const modifier: FindOptions<DBStudio> = {
		fields: {},
	}
	if (
		NoSecurityReadAccess.any() ||
		(selector._id && StudioReadAccess.studio(selector, cred)) ||
		(selector.organizationId && OrganizationReadAccess.organizationContent(selector, cred))
	) {
		return Studios.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.studioOfDevice, function(deviceId: PeripheralDeviceId, token) {
	if (PeripheralDeviceReadAccess.peripheralDevice({ _id: deviceId }, { userId: this.userId, token })) {
		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const modifier: FindOptions<DBStudio> = {
			fields: {},
		}
		let selector = {
			_id: peripheralDevice.studioId,
		}
		if (StudioReadAccess.studioContent(selector, { userId: this.userId, token })) {
			return Studios.find(selector, modifier)
		}
	}
	return null
})

meteorPublish(PubSub.externalMessageQueue, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<ExternalMessageQueueObj> = {
		fields: {},
	}
	if (StudioReadAccess.studioContent(selector, { userId: this.userId, token })) {
		return ExternalMessageQueue.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.mediaObjects, function(studioId, selector, token) {
	if (!studioId) throw new Meteor.Error(400, 'studioId argument missing')
	selector = selector || {}
	check(studioId, String)
	check(selector, Object)
	const modifier: FindOptions<MediaObject> = {
		fields: {},
	}
	selector.studioId = studioId
	if (StudioReadAccess.studioContent(selector, { userId: this.userId, token })) {
		return MediaObjects.find(selector, modifier)
	}
	return null
})

meteorCustomPublishArray(PubSub.mappingsForDevice, 'studioMappings', function(
	pub,
	deviceId: PeripheralDeviceId,
	token
) {
	if (PeripheralDeviceReadAccess.peripheralDeviceContent({ deviceId: deviceId }, { userId: this.userId, token })) {
		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const studioId = peripheralDevice.studioId
		if (!studioId) return []

		const observer = setUpOptimizedObserver(
			`pub_${PubSub.mappingsForDevice}_${studioId}`,
			(triggerUpdate) => {
				// Set up observers:
				return [
					Studios.find(studioId, {
						fields: {
							// It should be enough to watch the mappingsHash, since that should change whenever there is a
							// change to the mappings or the routes
							mappingsHash: 1,
						},
					}).observe({
						added: () => triggerUpdate({ studioId: studioId }),
						changed: () => triggerUpdate({ studioId: studioId }),
						removed: () => triggerUpdate({ studioId: undefined }),
					}),
				]
			},
			() => {
				// Initialize data
				return {
					studioId: studioId,
				}
			},
			(newData: { studioId: StudioId | undefined }) => {
				// Prepare data for publication:

				if (!newData.studioId) {
					return []
				} else {
					const studio = Studios.findOne(newData.studioId)
					if (!studio) return []

					const routes = getActiveRoutes(studio)
					const routedMappings = getRoutedMappings(studio.mappings, routes)

					return [
						{
							_id: studio._id,
							mappingsHash: studio.mappingsHash,
							mappings: routedMappings,
						},
					]
				}
			},
			(newData) => {
				pub.updatedDocs(newData)
			}
		)
		pub.onStop(() => {
			observer.stop()
		})
	}
})
