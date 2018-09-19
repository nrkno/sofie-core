import { ServerResponse, IncomingMessage } from 'http'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { ShowStyle, ShowStyles } from '../lib/collections/ShowStyles'
import { RuntimeFunction, RuntimeFunctions } from '../lib/collections/RuntimeFunctions'
import * as bodyParser from 'body-parser'
import { logger } from './logging'
import { Selector } from '../lib/typings/meteor'
import { Collections, getCollectionIndexes, getCollectionStats, getCurrentTime } from '../lib/lib'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { Random } from 'meteor/random'
import { Timeline } from '../lib/collections/Timeline'
import { PeripheralDeviceAPI } from '../lib/api/peripheralDevice'
import { PeripheralDevices } from '../lib/collections/PeripheralDevices'
import { ServerPeripheralDeviceAPI } from './api/peripheralDevice'
import { StudioInstallations } from '../lib/collections/StudioInstallations'
import { RunningOrders, RunningOrder } from '../lib/collections/RunningOrders'
import { Segments } from '../lib/collections/Segments'
import { SegmentLines } from '../lib/collections/SegmentLines'
import { SegmentLineItems } from '../lib/collections/SegmentLineItems'
import { UserActionsLog } from '../lib/collections/UserActionsLog'
import { PeripheralDeviceCommands } from '../lib/collections/PeripheralDeviceCommands'
import { SegmentLineAdLibItems } from '../lib/collections/SegmentLineAdLibItems'
import { RunningOrderDataCache } from '../lib/collections/RunningOrderDataCache'

export interface ShowStyleBackup {
	type: 'showstyle'
	showStyle: ShowStyle
	templates: RuntimeFunction[]
}

export function getShowBackup (showId: string, onlyActiveTemplates: boolean): ShowStyleBackup {
	const showStyle = ShowStyles.findOne(showId)
	if (!showStyle) throw new Meteor.Error(404, 'Show style not found')

	const filter: Selector<RuntimeFunction> = { showStyleId: showId }
	if (onlyActiveTemplates) {
		filter.active = true
	}

	const templates = RuntimeFunctions.find(filter,{
		sort: {
			showStyleId: 1,
			templateId: 1,
			active: -1,
			createdVersion: 1,
		}
	}).fetch()

	return {
		type: 'showstyle',
		showStyle: showStyle,
		templates: templates,
	}
}
function restoreShowBackup (backup: ShowStyleBackup) {
	const newShow = backup.showStyle
	if (!newShow) throw new Meteor.Error(500, 'ShowStyle missing from restore data')

	const showStyle = ShowStyles.findOne(newShow._id)
	if (showStyle) ShowStyles.remove(showStyle)
	ShowStyles.insert(newShow)

	RuntimeFunctions.remove({ showStyleId: newShow._id })
	if (backup.templates) {
		backup.templates.forEach(t => {
			const tmp: any = t
			// Rejoin any line breaks that were split in the backup process
			if (typeof tmp.code === 'object') {
				tmp.code = tmp.code.join('\n')
			}

			RuntimeFunctions.insert(t)
		})
	}
}

function runBackup (params, req: IncomingMessage, res: ServerResponse, onlyActive: boolean) {
	let data: any = getShowBackup(params.id, onlyActive)
	let fileName = 'backup'
	if (data && (data.showStyle as ShowStyle).name) {
		fileName = ((data.showStyle as ShowStyle).name).replace(/\s/g, '-')
	}
	res.setHeader('Content-Type', 'application/json')
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}.json"`)

	let content = ''
	if (!data) {
		res.statusCode = 404
		content = ''
	} else {
		res.statusCode = 200

		// Split on line breaks to an array to make it diff better
		data.templates.forEach(t => {
			t.code = t.code.split('\n')
			t.createdVersion = undefined
			t.modified = undefined
		})
		content = JSON.stringify(data, null, 4)
	}

	res.end(content)
}

// Server route
Picker.route('/backup/show/:id', (params, req: IncomingMessage, res: ServerResponse, next) => {
	runBackup(params, req, res, false)
})
Picker.route('/backup/show/:id/active', (params, req: IncomingMessage, res: ServerResponse, next) => {
	runBackup(params, req, res, true)
})

const postRoute = Picker.filter((req, res) => req.method === 'POST')
postRoute.middleware(bodyParser.json({
	limit: '1mb' // Arbitrary limit
}))
postRoute.route('/backup/restore', (params, req: IncomingMessage, res: ServerResponse, next) => {
	res.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const body = (req as any).body
		if (!body || !body.type) throw new Meteor.Error(500, 'Missing type in request body')

		switch (body.type) {
			case 'showstyle':
				restoreShowBackup(body as ShowStyleBackup)
				break
			default:
				throw new Meteor.Error(500, 'Unknown type "' + body.type + '" in request body')
		}

		res.statusCode = 200
	} catch (e) {
		res.statusCode = 500
		content = e + ''
		logger.debug('Backup restore failed: ', e)
	}

	res.end(content)
})
Picker.route('/snapshot/:studioId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	let snapshot = getSystemSnapshot(params.studioId)

	res.setHeader('Content-Type', 'application/json')
	res.setHeader('Content-Disposition', `attachment; filename="${snapshot.snapshotId + '_' + snapshot.timestampStart}.json"`)

	let content = JSON.stringify(snapshot, null, 4)
	res.end(content)
})

function getSystemSnapshot (studioId: string) {
	// produce a snapshot of all relevant parts of the system, for debugging purposes

	let id = Random.id()

	logger.info('Generating system snapshot "' + id + '"...')

	let snapshot: any = {
		snapshotId: id,
		timestampStart: getCurrentTime(),
		errors: [],
		collections: {},
		core: {},
		devices: {},
	}
	function wrap (name: string, fcn: Function) {
		try {
			fcn()
		} catch (e) {
			snapshot.errors.push('Error ' + name + ': ' + e.toString())
		}
	}

	wrap('collections', () => {
		_.each(Collections, (collection: Mongo.Collection<any>, name: string) => {
			let stat = {
				objectCount: collection.find().count(),
				indexes: getCollectionIndexes(collection),
				stats: getCollectionStats(collection)
			}
			snapshot.collections[name] = stat
		})
	})

	wrap('core', () => {
		let studio = StudioInstallations.findOne(studioId)

		snapshot.core.studio = studio
		snapshot.core.timeline = Timeline.find().fetch()
		snapshot.core.userActionLogLatest = UserActionsLog.find({timestamp: {$gt: getCurrentTime() - 3 * 3600 * 60}}).fetch() // latest 3 hours
		snapshot.core.runtimeFunctions = RuntimeFunctions.find({active: true}).fetch()

		if (studio) {
			let activeROs = RunningOrders.find({
				studioInstallationId: studio._id,
				active: true,
			}).fetch()
			snapshot.core.activeROs = activeROs
			if (activeROs.length === 1) {
				let activeRO = activeROs[0]

				snapshot.core.showStyle				= ShowStyles.findOne(activeRO.showStyleId)
				snapshot.core.segments				= Segments.find({runningOrderId: activeRO._id}).fetch()
				snapshot.core.segmentLines			= SegmentLines.find({runningOrderId: activeRO._id}).fetch()
				snapshot.core.segmentLineItems		= SegmentLineItems.find({runningOrderId: activeRO._id}).fetch()
				snapshot.core.segmentLineAdLibItems	= SegmentLineAdLibItems.find({runningOrderId: activeRO._id}).fetch()

				snapshot.core.runningOrderDataCache	= RunningOrderDataCache.find({roId: activeRO._id}).fetch()
			}
		}
	})

	let devices = PeripheralDevices.find().fetch()
	_.each(devices, (device) => {
		wrap('device ' + device._id, () => {
			// fetch info from device:
			let d: any = {
				device: device,
				coreTimestamp: getCurrentTime(),
				commands: PeripheralDeviceCommands.find({ deviceId: device._id }).fetch()
			}
			snapshot.devices[device._id] = d
			if (device.connected && device.type !== PeripheralDeviceAPI.DeviceType.OTHER) {
				let o = ServerPeripheralDeviceAPI.executeFunction(device._id,'getSnapshot')
				d = _.extend(d,o)
				logger.info('Got snapshot from device "' + device._id + '"')
				// logger.info(o)
			}
			// if (device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT) {
			// // } else if (device.type === PeripheralDeviceAPI.DeviceType.MOSDEVICE) {
			// }
		})
	})

	snapshot.timestampEnd = getCurrentTime()
	logger.info('System snapshot "' + id + '" generated')

	return snapshot

}
