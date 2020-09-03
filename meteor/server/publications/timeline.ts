import { Meteor } from 'meteor/meteor'
import { Timeline, TimelineObjGeneric, getRoutedTimeline, TimelineComplete } from '../../lib/collections/Timeline'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { setUpOptimizedObserver } from '../lib/optimizedObserver'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { Studios, getActiveRoutes, Studio } from '../../lib/collections/Studios'
import * as _ from 'underscore'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { StudioReadAccess } from '../security/studio'

meteorPublish(PubSub.timeline, function(selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	const modifier: FindOptions<TimelineObjGeneric> = {
		fields: {},
	}
	if (StudioReadAccess.studioContent(selector, { userId: this.userId, token })) {
		return Timeline.find(selector, modifier)
	}
	return null
})

meteorCustomPublishArray(PubSub.timelineForDevice, 'studioTimeline', function(
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
			`pub_${PubSub.timelineForDevice}_${studioId}`,
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
						added: (studio) => triggerUpdate({ studio: studio }),
						changed: (studio) => triggerUpdate({ studio: studio }),
						removed: () => triggerUpdate({ studio: null }),
					}),
					Timeline.find({
						_id: studioId,
					}).observe({
						added: (timeline) => triggerUpdate({ timeline: timeline }),
						changed: (timeline) => triggerUpdate({ timeline: timeline }),
						removed: () => triggerUpdate({ timeline: null }),
					}),
				]
			},
			() => {
				// Initial data fetch
				return {
					timeline: Timeline.findOne({
						_id: studioId,
					}),
					studio: Studios.findOne(studioId),
				}
			},
			(newData: { studio: Studio | undefined; timeline: TimelineComplete | undefined }) => {
				// Prepare data for publication:

				if (!newData.studio || !newData.timeline) {
					return []
				} else {
					const routes = getActiveRoutes(newData.studio)
					const routedTimeline = getRoutedTimeline(newData.timeline.timeline, routes)

					return [
						{
							_id: newData.timeline._id,
							mappingsHash: newData.studio.mappingsHash,
							timeline: routedTimeline,
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
