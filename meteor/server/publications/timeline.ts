import { Meteor } from 'meteor/meteor'
import { lazyIgnore, unprotectString } from '../../lib/lib'
import { TimelineSecurity } from '../security/timeline'
import { Timeline, TimelineObjGeneric, getRoutedTimeline, TimelineObjType } from '../../lib/collections/Timeline'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { FindOptions } from '../../lib/typings/meteor'
import { meteorCustomPublishArray } from '../lib/customPublication'
import { PeripheralDeviceId, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { Studios, getActiveRoutes, StudioId } from '../../lib/collections/Studios'
import { generateTimelineStatObj } from '../api/playout/timeline'
import * as _ from 'underscore'

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
		if (!studioId) return []

		const observer = setUpPrepareObserver(
			studioId,
			() => {
				const timeline = Timeline.find({
					studioId: studioId,
					objectType: { $ne: TimelineObjType.STAT },
				}).fetch()
				const studio = Studios.findOne(studioId)
				if (!studio) {
					return []
				} else {
					const routes = getActiveRoutes(studio)
					const routedTimeline = getRoutedTimeline(timeline, routes)

					const statObj = generateTimelineStatObj(studio._id, routedTimeline)
					routedTimeline.push(statObj)

					return routedTimeline
				}
			},
			(routedTimeline) => {
				pub.updatedDocs(routedTimeline)
			}
		)

		pub.onStop(() => {
			observer.stop()
		})
	}
})
const callbacks: { [studioId: string]: { stop: Function; callbacks: Function[] } } = {}
function setUpPrepareObserver<T>(studioId: StudioId, prepareData: () => T, callback: (T) => void) {
	const sid = unprotectString(studioId)
	if (!callbacks[sid]) {
		const triggerUpdate = () => {
			lazyIgnore(
				`studioTimeline_${studioId}`,
				() => {
					const o = callbacks[sid]
					if (o) {
						const result = prepareData()

						_.each(o.callbacks, (cb) => cb(result))
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

		callbacks[sid] = {
			stop: () => {
				observeStudio.stop()
				observeTimeline.stop()
			},
			callbacks: [],
		}
	}
	callbacks[sid].callbacks.push(callback)
	return {
		stop: () => {
			const o = callbacks[sid]
			if (o) {
				const i = o.callbacks.indexOf(callback)
				if (i != -1) {
					o.callbacks.splice(i, 1)
				}
				// clean up if empty:
				if (!o.callbacks.length) {
					o.stop()
					delete callbacks[sid]
				}
			}
		},
	}
}
