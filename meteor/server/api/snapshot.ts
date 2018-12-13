import * as Path from 'path'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
import * as bodyParser from 'body-parser'
import { check, Match } from 'meteor/check'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { Snapshots, SnapshotRunningOrder, SnapshotType, SnapshotSystem, SnapshotDebug, SnapshotBase } from '../../lib/collections/Snapshots'
import { RunningOrders, RunningOrder } from '../../lib/collections/RunningOrders'
import { RunningOrderDataCache, RunningOrderDataCacheObj } from '../../lib/collections/RunningOrderDataCache'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { Segments, Segment } from '../../lib/collections/Segments'
import { SegmentLineItems, SegmentLineItem } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import { getCurrentTime, Time, formatDateAsTimecode, formatDateTime, fixValidPath, saveIntoDb, sumChanges } from '../../lib/lib'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { logger } from '../logging'
import { Timeline, TimelineObj } from '../../lib/collections/Timeline'
import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { ServerPeripheralDeviceAPI } from './peripheralDevice'
import { Methods, setMeteorMethods, wrapMethods } from '../methods'
import { SnapshotFunctionsAPI } from '../../lib/api/shapshot'
import { getCoreSystem, ICoreSystem, CoreSystem, parseVersion, compareVersions } from '../../lib/collections/CoreSystem'
import { fsWriteFile, fsReadFile, fsUnlinkFile } from '../lib'
import { CURRENT_SYSTEM_VERSION, isVersionSupported } from '../migration/databaseMigration'
import { restoreRunningOrder } from '../backups'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { AudioContent } from 'tv-automation-sofie-blueprints-integration'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { MongoSelector } from '../../lib/typings/meteor'
interface RunningOrderSnapshot {
	version: string
	runningOrderId: string
	snapshot: SnapshotRunningOrder
	runningOrder: RunningOrder
	mosData: Array<RunningOrderDataCacheObj>
	userActions: Array<UserActionsLogItem>
	segments: Array<Segment>
	segmentLineItems: Array<SegmentLineItem>
	segmentLineAdLibItems: Array<SegmentLineAdLibItem>
	mediaObjects: Array<MediaObject>
}
interface SystemSnapshot {
	version: string
	studioId: string | null
	snapshot: SnapshotSystem
	studios: Array<StudioInstallation>
	showStyleBases: Array<ShowStyleBase>
	showStyleVariants: Array<ShowStyleVariant>
	blueprints?: Array<Blueprint> // optional, to be backwards compatible
	devices: Array<PeripheralDevice>
	deviceCommands: Array<PeripheralDeviceCommand>
	coreSystem: ICoreSystem
}
interface DebugSnapshot {
	version: string
	studioId?: string
	snapshot: SnapshotDebug
	system: SystemSnapshot
	activeRunningOrders: Array<RunningOrderSnapshot>
	timeline: Array<TimelineObj>
	userActionLog: Array<UserActionsLogItem>
	deviceSnaphots: Array<DeviceSnapshot>
}
interface DeviceSnapshot {
	deviceId: string
	created: Time
	replyTime: Time
	content: any
}
type AnySnapshot = RunningOrderSnapshot | SystemSnapshot | DebugSnapshot

/**
 * Create a snapshot of all items related to a runningOrder
 * @param runningOrderId
 */
function createRunningOrderSnapshot (runningOrderId: string): RunningOrderSnapshot {
	let snapshotId = Random.id()
	logger.info(`Generating RunningOrder snapshot "${snapshotId}" for runningOrder "${runningOrderId}"`)

	const runningOrder = RunningOrders.findOne(runningOrderId)
	if (!runningOrder) throw new Meteor.Error(404,`RunningOrder ${runningOrderId} not found`)
	const mosData = RunningOrderDataCache.find({ roId: runningOrderId }, { sort: { modified: -1 } }).fetch() // @todo: check sorting order
	const userActions = UserActionsLog.find({ args: { $regex: `.*"${runningOrderId}".*` } }).fetch()

	const segments = Segments.find({ runningOrderId }).fetch()
	const segmentLineItems = SegmentLineItems.find({ runningOrderId }).fetch()
	const segmentLineAdLibItems = SegmentLineAdLibItems.find({ runningOrderId }).fetch()
	const mediaObjectIds: Array<string> = [
		...segmentLineItems.filter(item => item.content && item.content.fileName).map((item) => ((item.content as AudioContent).fileName)),
		...segmentLineAdLibItems.filter(item => item.content && item.content.fileName).map((item) => ((item.content as AudioContent).fileName))
	]
	const mediaObjects = MediaObjects.find({ mediaId: { $in: mediaObjectIds } }).fetch()

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		runningOrderId: runningOrderId,
		snapshot: {
			_id: snapshotId,
			created: getCurrentTime(),
			type: SnapshotType.RUNNING_ORDER,
			runningOrderId: runningOrderId,
			studioId: runningOrder.studioInstallationId,
			name: `RunningOrder_${runningOrder.name}_${runningOrder._id}_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION
		},
		runningOrder,
		mosData,
		userActions,
		segments,
		segmentLineItems,
		segmentLineAdLibItems,
		mediaObjects
	}
}

/**
 * Create a snapshot of all items related to the base system (all settings),
 * that means all studios, showstyles, peripheralDevices etc
 * If studioId is provided, only return items related to that studio
 * @param studioId (Optional) Only generate for a certain studio
 */
function createSystemSnapshot (studioId: string | null): SystemSnapshot {
	let snapshotId = Random.id()
	logger.info(`Generating System snapshot "${snapshotId}"` + (studioId ? `for studio "${studioId}"` : ''))

	const coreSystem 		= getCoreSystem()
	if (!coreSystem) throw new Meteor.Error(500, `coreSystem not set up`)
	const studios 			= StudioInstallations.find((studioId ? {_id: studioId} : {})).fetch()

	let queryShowStyleBases: MongoSelector<ShowStyleBase> = {}
	let queryShowStyleVariants: MongoSelector<ShowStyleVariant> = {}
	let queryDevices: MongoSelector<PeripheralDevice> = {}
	let queryBlueprints: MongoSelector<Blueprint> = {}

	if (studioId) {
		let showStyleBaseIds: string[] = []
		_.each(studios, (studio) => {
			showStyleBaseIds = showStyleBaseIds.concat(studio.supportedShowStyleBase)
		})

		queryShowStyleBases = {
			_id: {$in: showStyleBaseIds}
		}
		queryShowStyleVariants = {
			showStyleBaseId: {$in: showStyleBaseIds}
		}
		queryDevices = { studioInstallationId: studioId }
	}
	const showStyleBases 	= ShowStyleBases	.find(queryShowStyleBases).fetch()
	const showStyleVariants = ShowStyleVariants	.find(queryShowStyleVariants).fetch()
	const devices 			= PeripheralDevices	.find(queryDevices).fetch()

	if (studioId) {
		let blueprintIds: string[] = []
		_.each(showStyleBases, (showStyleBase => {
			blueprintIds = blueprintIds.concat(showStyleBase.blueprintId)
		}))
		queryBlueprints = {
			_id: {$in: blueprintIds}
		}
	}
	const blueprints 		= Blueprints		.find(queryBlueprints).fetch()

	const deviceCommands = PeripheralDeviceCommands.find({
		deviceId: {$in: _.pluck(devices, '_id')}
	}).fetch()

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		studioId: studioId,
		snapshot: {
			_id: snapshotId,
			type: SnapshotType.SYSTEM,
			created: getCurrentTime(),
			name: `System` + (studioId ? `_${studioId}` : '' ) + `_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION,
		},
		studios,
		showStyleBases,
		showStyleVariants,
		blueprints,
		devices,
		coreSystem,
		deviceCommands: deviceCommands,
	}
}

/**
 * Create a snapshot of active runningOrders related to a studio and all related data, for debug purposes
 * @param studioId
 */
function createDebugSnapshot (studioId: string): DebugSnapshot {
	let snapshotId = Random.id()
	logger.info(`Generating Debug snapshot "${snapshotId}" for studio "${studioId}"`)

	const studio = StudioInstallations.findOne(studioId)
	if (!studio) throw new Meteor.Error(404,`StudioInstallation ${studioId} not found`)

	let systemSnapshot = createSystemSnapshot(studioId)

	let activeROs = RunningOrders.find({
		studioInstallationId: studio._id,
		active: true,
	}).fetch()

	let activeRoSnapshots = _.map(activeROs, (ro) => {
		return createRunningOrderSnapshot(ro._id)
	})

	let timeline = Timeline.find().fetch()
	let userActionLogLatest = UserActionsLog.find({
		timestamp: {
			$gt: getCurrentTime() - 1000 * 3600 * 3  // latest 3 hours
		}
	}).fetch()

	// Also fetch debugInfo from devices:
	let deviceSnaphots: Array<DeviceSnapshot> = []
	_.each(systemSnapshot.devices, (device) => {
		if (device.connected && device.type !== PeripheralDeviceAPI.DeviceType.OTHER) {
			let startTime = getCurrentTime()
			let deviceSnapshot = ServerPeripheralDeviceAPI.executeFunction(device._id,'getSnapshot')

			deviceSnaphots.push({
				deviceId: device._id,
				created: startTime,
				replyTime: getCurrentTime(),
				content: deviceSnapshot
			})
			logger.info('Got snapshot from device "' + device._id + '"')
		}
	})

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		studioId: studioId,
		snapshot: {
			_id: snapshotId,
			type: SnapshotType.DEBUG,
			created: getCurrentTime(),
			name: `Debug_${studioId}_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION
		},
		system: systemSnapshot,
		activeRunningOrders: activeRoSnapshots,
		timeline: timeline,
		userActionLog: userActionLogLatest,
		deviceSnaphots: deviceSnaphots
	}
}

// Setup endpoints:
function handleResponse (response: ServerResponse, snapshotFcn: (() => {snapshot: SnapshotBase} ) ) {

	try {
		let s: any = snapshotFcn()
		response.setHeader('Content-Type', 'application/json')
		response.setHeader('Content-Disposition', `attachment; filename="${s.snapshot.name}.json"`)

		let content = (
			_.isString(s) ?
			s :
			JSON.stringify(s, null, 4)
		)
		response.statusCode = 200
		response.end(content)
	} catch (e) {
		response.setHeader('Content-Type', 'text/plain')
		response.statusCode = e.errorCode || 500
		response.end('Error: ' + e.toString())

		if ( e.errorCode !== 404) {
			logger.error(e)
		}
	}
}
function storeSnaphot (snapshot: {snapshot: SnapshotBase}, comment: string): string {
	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, `CoreSystem not found!`)
	if (!system.storePath) throw new Meteor.Error(500, `CoreSystem.storePath not set!`)

	let fileName = fixValidPath(snapshot.snapshot.name) + '.json'
	let filePath = Path.join(system.storePath, fileName)

	let str = JSON.stringify(snapshot)

	// Store to the persistant file storage
	logger.info(`Save snapshot file ${filePath}`)
	fsWriteFile(filePath, str)

	let id = Snapshots.insert({
		_id: fileName,
		fileName: fileName,
		type: snapshot.snapshot.type,
		created: snapshot.snapshot.created,
		name: snapshot.snapshot.name,
		description: snapshot.snapshot.description,
		version: CURRENT_SYSTEM_VERSION,
		comment: comment
	})

	return id
}
function retreiveSnapshot (snapshotId: string): AnySnapshot {
	let snapshot = Snapshots.findOne(snapshotId)
	if (!snapshot) throw new Meteor.Error(404, `Snapshot not found!`)

	let system = getCoreSystem()
	if (!system) throw new Meteor.Error(500, `CoreSystem not found!`)
	if (!system.storePath) throw new Meteor.Error(500, `CoreSystem.storePath not set!`)

	let filePath = Path.join(system.storePath, snapshot.fileName)

	let dataStr = fsReadFile(filePath).toString()

	let readSnapshot = JSON.parse(dataStr)

	return readSnapshot
}
function restoreFromSnapshot (snapshot: AnySnapshot) {
	// Determine what kind of snapshot

	if (!_.isObject(snapshot)) throw new Meteor.Error(500, `Restore input data is not an object`)
	if (!snapshot.snapshot) throw new Meteor.Error(500, `Restore input data is not a snapshot`)

	if (snapshot.snapshot.type === SnapshotType.RUNNING_ORDER) {
		return restoreFromRunningOrderSnapshot(snapshot as RunningOrderSnapshot)
	} else if (snapshot.snapshot.type === SnapshotType.SYSTEM) {
		return restoreFromSystemSnapshot(snapshot as SystemSnapshot)
	} else {
		throw new Meteor.Error(402, `Unknown snapshot type "${snapshot.snapshot.type}"`)
	}
}
function restoreFromRunningOrderSnapshot (snapshot: RunningOrderSnapshot) {
	logger.info(`Restoring from runningOrder snapshot "${snapshot.snapshot.name}"`)
	let runningOrderId = snapshot.runningOrderId

	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}

	if (runningOrderId !== snapshot.runningOrder._id) throw new Meteor.Error(500, `Restore snapshot: runningOrderIds don\'t match, "${runningOrderId}", "${snapshot.runningOrder._id}!"`)

	let dbRunningOrder = RunningOrders.findOne(runningOrderId)

	if (dbRunningOrder && !dbRunningOrder.unsynced) throw new Meteor.Error(500, `Not allowed to restore into synked RunningOrder!`)

	if (!snapshot.runningOrder.unsynced) {
		snapshot.runningOrder.unsynced = true
		snapshot.runningOrder.unsyncedTime = getCurrentTime()
	}

	saveIntoDb(RunningOrders, {_id: runningOrderId}, [snapshot.runningOrder])
	saveIntoDb(RunningOrderDataCache, {roId: runningOrderId}, snapshot.mosData)
	// saveIntoDb(UserActionsLog, {}, snapshot.userActions)
	saveIntoDb(Segments, {runningOrderId: runningOrderId}, snapshot.segments)
	saveIntoDb(SegmentLineItems, {runningOrderId: runningOrderId}, snapshot.segmentLineItems)
	saveIntoDb(SegmentLineAdLibItems, {runningOrderId: runningOrderId}, snapshot.segmentLineAdLibItems)
	saveIntoDb(MediaObjects, {_id: {$in: _.pluck(snapshot.mediaObjects, '_id')}}, snapshot.mediaObjects)

	logger.info(`Restore done`)
}
function restoreFromSystemSnapshot (snapshot: SystemSnapshot) {
	logger.info(`Restoring from system snapshot "${snapshot.snapshot.name}"`)
	let studioId = snapshot.studioId

	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}
	let changes = sumChanges(
		saveIntoDb(StudioInstallations, (studioId ? {_id: studioId} : {}), snapshot.studios),
		saveIntoDb(ShowStyleBases, {}, snapshot.showStyleBases),
		saveIntoDb(ShowStyleVariants, {}, snapshot.showStyleVariants),
		(snapshot.blueprints ? saveIntoDb(Blueprints, {}, snapshot.blueprints) : null),
		saveIntoDb(PeripheralDevices, (studioId ? {studioInstallationId: studioId} : {}), snapshot.devices),
		saveIntoDb(CoreSystem, {}, [snapshot.coreSystem])
	)
	// saveIntoDb(PeripheralDeviceCommands, {}, snapshot.deviceCommands) // ignored

	logger.info(`Restore done (added ${changes.added}, updated ${changes.updated}, removed ${changes.removed} documents)`)
}

export function storeSystemSnapshot (studioId: string | null, reason: string) {
	if (!_.isNull(studioId)) check(studioId, String)
	let s = createSystemSnapshot(studioId)
	return storeSnaphot(s, reason)
}
export function storeRunningOrderSnapshot (runningOrderId: string, reason: string) {
	check(runningOrderId, String)
	let s = createRunningOrderSnapshot(runningOrderId)
	return storeSnaphot(s, reason)
}
export function storeDebugSnapshot (studioId: string, reason: string) {
	check(studioId, String)
	let s = createDebugSnapshot(studioId)
	return storeSnaphot(s, reason)
}
export function restoreSnapshot (snapshotId: string) {
	check(snapshotId, String)
	let snapshot = retreiveSnapshot(snapshotId)
	return restoreFromSnapshot(snapshot)
}
export function removeSnapshot (snapshotId: string) {
	check(snapshotId, String)

	logger.info(`Removing snapshot ${snapshotId}`)

	let snapshot = Snapshots.findOne(snapshotId)
	if (!snapshot) throw new Meteor.Error(404, `Snapshot not found!`)

	if (snapshot.fileName) {
		// remove from disk
		let system = getCoreSystem()
		if (!system) throw new Meteor.Error(500, `CoreSystem not found!`)
		if (!system.storePath) throw new Meteor.Error(500, `CoreSystem.storePath not set!`)

		let filePath = Path.join(system.storePath, snapshot.fileName)
		try {
			logger.info(`Removing snapshot file ${filePath}`)

			fsUnlinkFile(filePath)
		} catch (e) {
			// Log the error, but continue
			logger.error('Error in removeSnapshot')
			logger.error(e)
		}
	}
	Snapshots.remove(snapshot._id)
}

Picker.route('/snapshot/system/:studioId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	return handleResponse(response, () => {
		check(params.studioId, Match.Optional(String))
		return createSystemSnapshot(params.studioId)
	})
})
Picker.route('/snapshot/runningOrder/:runningOrderId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	return handleResponse(response, () => {
		check(params.runningOrderId, String)
		return createRunningOrderSnapshot(params.runningOrderId)
	})
})
Picker.route('/snapshot/debug/:studioId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	return handleResponse(response, () => {
		check(params.studioId, String)
		return createDebugSnapshot(params.studioId)
	})
})
const postRoute = Picker.filter((req, res) => req.method === 'POST')
postRoute.middleware(bodyParser.json({
	limit: '1mb' // Arbitrary limit
}))
postRoute.route('/backup/restore', (params, req: IncomingMessage, response: ServerResponse, next) => {
	response.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		const snapshot = (req as any).body

		if (snapshot.type === 'runningOrderCache' && snapshot.data) {
			// special case (to be deprecated): runningOrder cached data
			restoreRunningOrder(snapshot)

		} else {
			restoreFromSnapshot(snapshot)
		}

		response.statusCode = 200
		response.end(content)
	} catch (e) {
		response.setHeader('Content-Type', 'text/plain')
		response.statusCode = e.errorCode || 500
		response.end('Error: ' + e.toString())

		if ( e.errorCode !== 404) {
			logger.error(e)
		}
	}
})
// Retrieve snapshot:
Picker.route('/snapshot/retrieve/:snapshotId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	return handleResponse(response, () => {
		check(params.snapshotId, String)
		return retreiveSnapshot(params.snapshotId)
	})
})

// Setup methods:
let methods: Methods = {}
methods[SnapshotFunctionsAPI.STORE_SYSTEM_SNAPSHOT] = (studioId: string | null, reason: string) => {
	return storeSystemSnapshot(studioId, reason)
}
methods[SnapshotFunctionsAPI.STORE_RUNNING_ORDER_SNAPSHOT] = (runningOrderId: string, reason: string) => {
	return storeRunningOrderSnapshot(runningOrderId, reason)
}
methods[SnapshotFunctionsAPI.STORE_DEBUG_SNAPSHOT] = (studioId: string, reason: string) => {
	return storeDebugSnapshot(studioId, reason)
}
methods[SnapshotFunctionsAPI.RESTORE_SNAPSHOT] = (snapshotId: string) => {
	return restoreSnapshot(snapshotId)
}
methods[SnapshotFunctionsAPI.REMOVE_SNAPSHOT] = (snapshotId: string) => {
	return removeSnapshot(snapshotId)
}
// Apply methods:
setMeteorMethods(wrapMethods(methods))
