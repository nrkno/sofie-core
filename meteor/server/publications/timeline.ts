import { Meteor } from 'meteor/meteor'
import { lazyIgnore } from '../../lib/lib'
import { TimelineSecurity } from '../security/timeline'
import { Timeline, TimelineObjGeneric, getRoutedTimeline } from '../../lib/collections/Timeline'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { Studios, getActiveRoutes } from '../../lib/collections/Studios'

meteorPublish(PubSub.timeline, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<TimelineObjGeneric> = {
		fields: {},
	}
	if (TimelineSecurity.allowReadAccess(selector, token, this)) {
		return Timeline.find(selector, modifier)
	}
	return null
})

meteorCustomPublishArray(PubSub.timelineForDevice, 'studioTimeline', (pub, deviceId: PeripheralDeviceId, token) => {
	if (PeripheralDeviceSecurity.allowReadAccess({ _id: deviceId }, token, this)) {
		let peripheralDevice = PeripheralDevices.findOne(deviceId)

		if (!peripheralDevice) throw new Meteor.Error('PeripheralDevice "' + deviceId + '" not found')

		const studioId = peripheralDevice.studioId

		const triggerUpdate = () => {
			lazyIgnore(
				`studioTimeline_${studioId}`,
				() => {
					const timeline = Timeline.find({
						studioId: studioId,
					}).fetch()
					const studio = Studios.findOne(studioId)
					if (!studio) {
						pub.updatedDocs([])
					} else {
						const routes = getActiveRoutes(studio)
						const routedTimeline = getRoutedTimeline(timeline, routes)
						pub.updatedDocs(routedTimeline)
					}
				},
				3 // ms
			)
		}

		const observeStudio = Studios.find(studioId).observeChanges({
			added: triggerUpdate,
			changed: triggerUpdate,
			removed: triggerUpdate,
		})
		const observeTimeline = Timeline.find({
			studioId: studioId,
		}).observeChanges({
			added: triggerUpdate,
			changed: triggerUpdate,
			removed: triggerUpdate,
		})
		pub.onStop(() => {
			observeStudio.stop()
			observeTimeline.stop()
		})
		triggerUpdate()
	}
})
