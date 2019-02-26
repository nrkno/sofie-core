import { Meteor } from 'meteor/meteor'
import { check, Match } from 'meteor/check'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { getCurrentTime } from '../../lib/lib'
import { PeripheralDeviceSecurity } from '../security/peripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { logger } from '../logging'
import { Timeline } from '../../lib/collections/Timeline'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { ServerPlayoutAPI, afterUpdateTimeline } from './playout'
import { syncFunction } from '../codeControl'
import { setMeteorMethods, wrapMethods, Methods } from '../methods'

// import {ServerPeripheralDeviceAPIMOS as MOS} from './peripheralDeviceMos'
export namespace ServerPeripheralDeviceAPI {
	export function initialize (id: string, token: string, options: PeripheralDeviceAPI.InitOptions): string {
		check(id, String)
		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.type, Number)
		check(options.parentDeviceId, Match.Optional(String))
		check(options.versions, Match.Optional(Object))

		logger.debug('Initialize device ' + id, options)

		let peripheralDevice
		try {
			peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)

			PeripheralDevices.update(id, {
				$set: {
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					connected: true,
					connectionId: options.connectionId,
					type: options.type,
					name: peripheralDevice.name || options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,
				}
			})
		} catch (e) {
			if ((e as Meteor.Error).error === 404) {
				PeripheralDevices.insert({
					_id: id,
					created: getCurrentTime(),
					status: {
						statusCode: PeripheralDeviceAPI.StatusCode.UNKNOWN
					},
					studioInstallationId: '',
					connected: true,
					connectionId: options.connectionId,
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					token: token,
					type: options.type,
					name: options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,
					// settings: {}
				})
			} else {
				throw e
			}
		}
		return id
	}
	export function unInitialize (id: string, token: string): string {

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// TODO: Add an authorization for this?

		PeripheralDevices.remove(id)
		return id
	}
	export function setStatus (id: string, token: string, status: PeripheralDeviceAPI.StatusObject): PeripheralDeviceAPI.StatusObject {
		check(id, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {

			logger.debug(`Changed status of device ${peripheralDevice._id} "${peripheralDevice.name}" to ${status.statusCode}`)
			// perform the update:
			PeripheralDevices.update(id, {$set: {
				status: status
			}})
		}
		return status
	}
	export function ping (id: string, token: string ): void {
		check(id, String)
		check(token, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// Update lastSeen
		PeripheralDevices.update(id, {$set: {
			lastSeen: getCurrentTime()
		}})
	}
	export function getPeripheralDevice (id: string, token: string) {
		return PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
	}
	export const timelineTriggerTime = syncFunction(function timelineTriggerTime (id: string, token: string, results: PeripheralDeviceAPI.TimelineTriggerTimeResult) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		let studioIds: {[studioId: string]: true} = {}

		_.each(results, (o) => {
			check(o.id, String)

			// check(o.time, Number)
			logger.info('Timeline: Setting time: "' + o.id + '": ' + o.time)

			let obj = Timeline.findOne(o.id)

			if (obj) {
				studioIds[obj.siId] = true

				Timeline.update({
					_id: o.id
				}, {$set: {
					'trigger.value': o.time,
					'trigger.setFromNow': true
				}},{
					multi: true
				})
			}

			// Meteor.call('playout_timelineTriggerTimeUpdate', o.id, o.time)
			ServerPlayoutAPI.timelineTriggerTimeUpdateCallback(o.id, o.time)
		})

		// After we've updated the timeline, we must call afterUpdateTimeline!
		_.each(studioIds, (_val, studioId) => {
			let studio = StudioInstallations.findOne(studioId)
			if (studio) {
				afterUpdateTimeline(studio)
			}
		})
	}, 'timelineTriggerTime$0,$1')
	export function segmentLinePlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) {
		// This is called from the playout-gateway when a segmentLine starts playing.
		// Note that this function can / might be called several times from playout-gateway for the same segmentLine
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.slId, String)

		// Meteor.call('playout_segmentLinePlaybackStart', r.roId, r.slId, r.time)
		ServerPlayoutAPI.slPlaybackStartedCallback(r.roId, r.slId, r.time)
	}
	export function segmentLinePlaybackStopped (id: string, token: string, r: PeripheralDeviceAPI.SegmentLinePlaybackStoppedResult) {
		// This is called from the playout-gateway when an
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.slId, String)

		ServerPlayoutAPI.slPlaybackStoppedCallback(r.roId, r.slId, r.time)
	}
	export function segmentLineItemPlaybackStarted (id: string, token: string, r: PeripheralDeviceAPI.SegmentLineItemPlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.sliId, String)

		// Meteor.call('playout_segmentLineItemPlaybackStart', r.roId, r.sliId, r.time)
		ServerPlayoutAPI.sliPlaybackStartedCallback(r.roId, r.sliId, r.time)
	}
	export function segmentLineItemPlaybackStopped (id: string, token: string, r: PeripheralDeviceAPI.SegmentLineItemPlaybackStartedResult) {
		// This is called from the playout-gateway when an auto-next event occurs
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		check(r.time, Number)
		check(r.roId, String)
		check(r.sliId, String)

		// Meteor.call('playout_segmentLineItemPlaybackStart', r.roId, r.sliId, r.time)
		ServerPlayoutAPI.sliPlaybackStoppedCallback(r.roId, r.sliId, r.time)
	}
	export function pingWithCommand (id: string, token: string, message: string) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err, res) => {
			if (err) {
				logger.warn(err)
			}
		}, 'pingResponse', message)

		ServerPeripheralDeviceAPI.ping(id, token)
	}
	export function killProcess (id: string, token: string, really: boolean) {
		// This is used in integration tests only
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404, "peripheralDevice '" + id + "' not found!")

		// Make sure this never runs if this server isn't empty:
		if (RunningOrders.find().count()) throw new Meteor.Error(400, 'Unable to run killProcess: RunningOrders not empty!')

		if (really) {
			this.logger.info('KillProcess command received from ' + peripheralDevice._id + ', shutting down in 1000ms!')
			setTimeout(() => {
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	export function testMethod (id: string, token: string, returnValue: string, throwError?: boolean): string {
		// used for integration tests with core-connection
		check(id, String)
		check(token, String)
		check(returnValue, String)

		// logger.debug('device ping', id)

		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		if (!peripheralDevice) throw new Meteor.Error(404,"peripheralDevice '" + id + "' not found!")

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}
	export const executeFunction: (deviceId: string, functionName: string, ...args: any[]) => any = Meteor.wrapAsync((deviceId: string, functionName: string, ...args: any[]) => {
		let args0 = args.slice(0, -1)
		let cb = args.slice(-1)[0] // the last argument in ...args
		PeripheralDeviceAPI.executeFunction(deviceId, cb, functionName, ...args0)
	})
}

/**
 * Insert a Story (aka a Segment) into the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
// export function insertSegment (story: IMOSROStory, runningOrderId: string, rank: number) {
// 	let segment = convertToSegment(story, rank)
// 	Segments.upsert(segment._id, {$set: _.omit(segment,['_id']) })
// 	afterInsertUpdateSegment(story, runningOrderId)
// }
/**
 * After a Story (aka a Segment) has been inserted / updated, handle its contents
 * @param story The Story that was inserted / updated
 * @param runningOrderId Id of the Running Order that contains the story
 */
// export function afterInsertUpdateSegment (story: IMOSROStory, runningOrderId: string) {
	// Save Items (#####) into database:

	/*
	let segment = convertToSegment(story, runningOrderId, 0)
	let rank = 0
	saveIntoDb(SegmentLines, {
		runningOrderId: runningOrderId,
		segmentId: segment._id
	}, _.map(story.Items, (item: IMOSItem) => {
		return convertToSegmentLine(item, runningOrderId, segment._id, rank++)
	}), {
		afterInsert (o) {
			let item: IMOSItem | undefined = _.find(story.Items, (s) => { return s.ID.toString() === o.mosId } )
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, segment._id)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterUpdate (o) {
			let item: IMOSItem | undefined = _.find(story.Items, (s) => { return s.ID.toString() === o.mosId } )
			if (item) {
				afterInsertUpdateSegmentLine(item, runningOrderId, segment._id)
			} else throw new Meteor.Error(500, 'Item not found (it should have been)')
		},
		afterRemove (o) {
			afterRemoveSegmentLine(o._id)
		}
	})
	*/
// }

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.initialize] = (deviceId: string, deviceToken: string, options: PeripheralDeviceAPI.InitOptions) => {
	return ServerPeripheralDeviceAPI.initialize(deviceId, deviceToken, options)
}
methods[PeripheralDeviceAPI.methods.unInitialize] = (deviceId: string, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.unInitialize(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.setStatus] = (deviceId: string, deviceToken: string, status: PeripheralDeviceAPI.StatusObject) => {
	return ServerPeripheralDeviceAPI.setStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.ping] = (deviceId: string, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.ping(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.getPeripheralDevice ] = (deviceId: string, deviceToken: string) => {
	return ServerPeripheralDeviceAPI.getPeripheralDevice(deviceId, deviceToken)
}
methods[PeripheralDeviceAPI.methods.segmentLinePlaybackStarted] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLinePlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.segmentLinePlaybackStopped] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.SegmentLinePlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLinePlaybackStopped(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.segmentLineItemPlaybackStopped] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.SegmentLineItemPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLineItemPlaybackStopped(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.segmentLineItemPlaybackStarted] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.SegmentLineItemPlaybackStartedResult) => {
	return ServerPeripheralDeviceAPI.segmentLineItemPlaybackStarted(deviceId, deviceToken, r)
}
methods[PeripheralDeviceAPI.methods.pingWithCommand] = (deviceId: string, deviceToken: string, message: string) => {
	return ServerPeripheralDeviceAPI.pingWithCommand(deviceId, deviceToken, message)
}
methods[PeripheralDeviceAPI.methods.killProcess] = (deviceId: string, deviceToken: string, really: boolean) => {
	return ServerPeripheralDeviceAPI.killProcess(deviceId, deviceToken, really)
}
methods[PeripheralDeviceAPI.methods.testMethod] = (deviceId: string, deviceToken: string, returnValue: string, throwError?: boolean ) => {
	return ServerPeripheralDeviceAPI.testMethod(deviceId, deviceToken, returnValue, throwError)
}
methods[PeripheralDeviceAPI.methods.timelineTriggerTime] = (deviceId: string, deviceToken: string, r: PeripheralDeviceAPI.TimelineTriggerTimeResult) => {
	return ServerPeripheralDeviceAPI.timelineTriggerTime(deviceId, deviceToken, r)
}

// --------------------
methods[PeripheralDeviceAPI.methods.functionReply] = (deviceId: string, deviceToken: string, commandId: string, err: any, result: any) => {
	// logger.debug('functionReply', err, result)
	PeripheralDeviceCommands.update(commandId, {
		$set: {
			hasReply: true,
			reply: result,
			replyError: err,
			replyTime: getCurrentTime()
		}
	})
}

// Apply methods:
setMeteorMethods(wrapMethods(methods))

// temporary functions:
setMeteorMethods({
	'temporaryRemovePeripheralDevice' (id: string) {
		// TODO: Replace this function with an authorized one
		PeripheralDevices.remove(id)
		PeripheralDevices.remove({
			parentDeviceId: id
		})
		return id
	}
})
