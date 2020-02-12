import * as Path from 'path'
import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
import * as bodyParser from 'body-parser'
import { check, Match } from 'meteor/check'
import { Studio, Studios } from '../../lib/collections/Studios'
import {
	Snapshots,
	SnapshotRundown,
	SnapshotType,
	SnapshotSystem,
	SnapshotDebug,
	SnapshotBase
} from '../../lib/collections/Snapshots'
import { Rundowns, Rundown } from '../../lib/collections/Rundowns'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { Segments, Segment } from '../../lib/collections/Segments'
import { Part, Parts } from '../../lib/collections/Parts'
import { Pieces, Piece } from '../../lib/collections/Pieces'
import { AdLibPieces, AdLibPiece } from '../../lib/collections/AdLibPieces'
import { MediaObjects, MediaObject } from '../../lib/collections/MediaObjects'
import {
	getCurrentTime,
	Time,
	formatDateTime,
	fixValidPath,
	saveIntoDb,
	sumChanges
} from '../../lib/lib'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { logger } from '../logging'
import { Timeline, TimelineObjGeneric } from '../../lib/collections/Timeline'
import { PeripheralDeviceCommands, PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { ServerPeripheralDeviceAPI } from './peripheralDevice'
import { Methods, setMeteorMethods } from '../methods'
import { SnapshotFunctionsAPI } from '../../lib/api/shapshot'
import { getCoreSystem, ICoreSystem, CoreSystem, parseVersion } from '../../lib/collections/CoreSystem'
import { fsWriteFile, fsReadFile, fsUnlinkFile } from '../lib'
import { CURRENT_SYSTEM_VERSION, isVersionSupported } from '../migration/databaseMigration'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { AudioContent } from 'tv-automation-sofie-blueprints-integration'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { MongoSelector } from '../../lib/typings/meteor'
import { ExpectedMediaItem, ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { IngestDataCacheObj, IngestDataCache } from '../../lib/collections/IngestDataCache'
import { ingestMOSRundown } from './ingest/http'
import { RundownBaselineObj, RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { RundownLayouts, RundownLayoutBase } from '../../lib/collections/RundownLayouts'

interface RundownSnapshot {
	version: string
	rundownId: string
	snapshot: SnapshotRundown
	rundown: Rundown
	ingestData: Array<IngestDataCacheObj>
	userActions: Array<UserActionsLogItem>
	baselineObjs: Array<RundownBaselineObj>
	baselineAdlibs: Array<RundownBaselineAdLibItem>
	segments: Array<Segment>
	parts: Array<Part>
	pieces: Array<Piece>
	adLibPieces: Array<AdLibPiece>
	mediaObjects: Array<MediaObject>
	expectedMediaItems: Array<ExpectedMediaItem>
}
interface SystemSnapshot {
	version: string
	studioId: string | null
	snapshot: SnapshotSystem
	studios: Array<Studio>
	showStyleBases: Array<ShowStyleBase>
	showStyleVariants: Array<ShowStyleVariant>
	blueprints?: Array<Blueprint> // optional, to be backwards compatible
	rundownLayouts?: Array<RundownLayoutBase> // optional, to be backwards compatible
	devices: Array<PeripheralDevice>
	deviceCommands: Array<PeripheralDeviceCommand>
	coreSystem: ICoreSystem
}
interface DebugSnapshot {
	version: string
	studioId?: string
	snapshot: SnapshotDebug
	system: SystemSnapshot
	activeRundowns: Array<RundownSnapshot>
	timeline: Array<TimelineObjGeneric>
	userActionLog: Array<UserActionsLogItem>
	deviceSnaphots: Array<DeviceSnapshot>
}
interface DeviceSnapshot {
	deviceId: string
	created: Time
	replyTime: Time
	content: any
}
type AnySnapshot = RundownSnapshot | SystemSnapshot | DebugSnapshot

/**
 * Create a snapshot of all items related to a rundown
 * @param rundownId
 */
function createRundownSnapshot (rundownId: string): RundownSnapshot {
	let snapshotId = Random.id()
	logger.info(`Generating Rundown snapshot "${snapshotId}" for rundown "${rundownId}"`)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404,`Rundown ${rundownId} not found`)
	const ingestData = IngestDataCache.find({ rundownId: rundownId }, { sort: { modified: -1 } }).fetch() // @todo: check sorting order
	const userActions = UserActionsLog.find({ args: { $regex: `.*"${rundownId}".*` } }).fetch()

	const segments = Segments.find({ rundownId }).fetch()
	const parts = Parts.find({ rundownId }).fetch()
	const pieces = Pieces.find({ rundownId }).fetch()
	const adLibPieces = AdLibPieces.find({ rundownId }).fetch()
	const mediaObjectIds: Array<string> = [
		...pieces.filter(piece => piece.content && piece.content.fileName).map((piece) => ((piece.content as AudioContent).fileName)),
		...adLibPieces.filter(adLibPiece => adLibPiece.content && adLibPiece.content.fileName).map((adLibPiece) => ((adLibPiece.content as AudioContent).fileName))
	]
	const mediaObjects = MediaObjects.find({ mediaId: { $in: mediaObjectIds } }).fetch()
	const expectedMediaItems = ExpectedMediaItems.find({ partId: { $in: parts.map(i => i._id) } }).fetch()
	const baselineObjs = RundownBaselineObjs.find({ rundownId: rundownId }).fetch()
	const baselineAdlibs = RundownBaselineAdLibPieces.find({ rundownId: rundownId }).fetch()

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		rundownId: rundownId,
		snapshot: {
			_id: snapshotId,
			created: getCurrentTime(),
			type: SnapshotType.RUNDOWN,
			rundownId: rundownId,
			studioId: rundown.studioId,
			name: `Rundown_${rundown.name}_${rundown._id}_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION
		},
		rundown,
		ingestData,
		userActions,
		baselineObjs,
		baselineAdlibs,
		segments,
		parts,
		pieces,
		adLibPieces,
		mediaObjects,
		expectedMediaItems
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
	const studios 			= Studios.find((studioId ? { _id: studioId } : {})).fetch()

	let queryShowStyleBases: MongoSelector<ShowStyleBase> = {}
	let queryShowStyleVariants: MongoSelector<ShowStyleVariant> = {}
	let queryRundownLayouts: MongoSelector<RundownLayoutBase> = {}
	let queryDevices: MongoSelector<PeripheralDevice> = {}
	let queryBlueprints: MongoSelector<Blueprint> = {}

	if (studioId) {
		let showStyleBaseIds: string[] = []
		_.each(studios, (studio) => {
			showStyleBaseIds = showStyleBaseIds.concat(studio.supportedShowStyleBase)
		})
		queryShowStyleBases._id = ''
		queryShowStyleBases = {
			_id: { $in: showStyleBaseIds }
		}
		queryShowStyleVariants = {
			showStyleBaseId: { $in: showStyleBaseIds }
		}
		queryRundownLayouts = {
			showStyleBaseId: { $in: showStyleBaseIds }
		}
		queryDevices = { studioId: studioId }
	}
	const showStyleBases 	= ShowStyleBases	.find(queryShowStyleBases).fetch()
	const showStyleVariants = ShowStyleVariants	.find(queryShowStyleVariants).fetch()
	const rundownLayouts	= RundownLayouts	.find(queryRundownLayouts).fetch()
	const devices 			= PeripheralDevices	.find(queryDevices).fetch()

	if (studioId) {
		let blueprintIds: string[] = []
		_.each(showStyleBases, (showStyleBase => {
			blueprintIds = blueprintIds.concat(showStyleBase.blueprintId)
		}))
		queryBlueprints = {
			_id: { $in: blueprintIds }
		}
	}
	const blueprints 		= Blueprints		.find(queryBlueprints).fetch()

	const deviceCommands = PeripheralDeviceCommands.find({
		deviceId: { $in: _.map(devices, device => device._id) }
	}).fetch()

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		studioId: studioId,
		snapshot: {
			_id: snapshotId,
			type: SnapshotType.SYSTEM,
			created: getCurrentTime(),
			name: `System` + (studioId ? `_${studioId}` : '') + `_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION,
		},
		studios,
		showStyleBases,
		showStyleVariants,
		blueprints,
		rundownLayouts,
		devices,
		coreSystem,
		deviceCommands: deviceCommands,
	}
}

/**
 * Create a snapshot of active rundowns related to a studio and all related data, for debug purposes
 * @param studioId
 */
function createDebugSnapshot (studioId: string): DebugSnapshot {
	let snapshotId = Random.id()
	logger.info(`Generating Debug snapshot "${snapshotId}" for studio "${studioId}"`)

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404,`Studio ${studioId} not found`)

	let systemSnapshot = createSystemSnapshot(studioId)

	let activeROs = Rundowns.find({
		studioId: studio._id,
		active: true,
	}).fetch()

	let activeRundownSnapshots = _.map(activeROs, (rundown) => {
		return createRundownSnapshot(rundown._id)
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
		if (
			device.connected &&
			device.subType === PeripheralDeviceAPI.SUBTYPE_PROCESS
		) {
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
		activeRundowns: activeRundownSnapshots,
		timeline: timeline,
		userActionLog: userActionLogLatest,
		deviceSnaphots: deviceSnaphots
	}
}

// Setup endpoints:
function handleResponse (response: ServerResponse, snapshotFcn: (() => {snapshot: SnapshotBase})) {

	try {
		let s: any = snapshotFcn()
		response.setHeader('Content-Type', 'application/json')
		response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(s.snapshot.name)}.json`)

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

		if (e.errorCode !== 404) {
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
	// First, some special (debugging) cases:
	// @ts-ignore is's not really a snapshot here:
	if (snapshot.externalId && snapshot.segments && snapshot.type === 'mos') { // Special: Not a snapshot, but a datadump of a MOS rundown
		const studio = Studios.findOne(Meteor.settings.manualSnapshotIngestStudioId || undefined)
		if (studio) {
			ingestMOSRundown(studio._id, snapshot)
			return
		} throw new Meteor.Error(500, `No Studio found`)
	}

	// Then, continue as if it's a normal snapshot:

	if (!snapshot.snapshot) throw new Meteor.Error(500, `Restore input data is not a snapshot`)

	if (snapshot.snapshot.type === SnapshotType.RUNDOWN) { // A snapshot of a rundown
		return restoreFromRundownSnapshot(snapshot as RundownSnapshot)
	} else if (snapshot.snapshot.type === SnapshotType.SYSTEM) { // A snapshot of a system
		return restoreFromSystemSnapshot(snapshot as SystemSnapshot)
	} else {
		throw new Meteor.Error(402, `Unknown snapshot type "${snapshot.snapshot.type}"`)
	}
}

function restoreFromRundownSnapshot (snapshot: RundownSnapshot) {
	logger.info(`Restoring from rundown snapshot "${snapshot.snapshot.name}"`)
	let rundownId = snapshot.rundownId

	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}

	if (rundownId !== snapshot.rundown._id) throw new Meteor.Error(500, `Restore snapshot: rundownIds don\'t match, "${rundownId}", "${snapshot.rundown._id}!"`)

	let dbRundown = Rundowns.findOne(rundownId)

	if (dbRundown && !dbRundown.unsynced) throw new Meteor.Error(500, `Not allowed to restore into synked Rundown!`)

	if (!snapshot.rundown.unsynced) {
		snapshot.rundown.unsynced = true
		snapshot.rundown.unsyncedTime = getCurrentTime()
	}

	snapshot.rundown.active					= (dbRundown ? dbRundown.active : false)
	snapshot.rundown.currentPartId		= (dbRundown ? dbRundown.currentPartId : null)
	snapshot.rundown.nextPartId			= (dbRundown ? dbRundown.nextPartId : null)
	snapshot.rundown.notifiedCurrentPlayingPartExternalId = (dbRundown ? dbRundown.notifiedCurrentPlayingPartExternalId : undefined)

	const studios = Studios.find().fetch()
	if (studios.length === 1) snapshot.rundown.studioId = studios[0]._id

	const showStyleVariants = ShowStyleVariants.find().fetch()
	if (showStyleVariants.length === 1) {
		snapshot.rundown.showStyleBaseId = showStyleVariants[0].showStyleBaseId
		snapshot.rundown.showStyleVariantId = showStyleVariants[0]._id
	}

	saveIntoDb(Rundowns, { _id: rundownId }, [snapshot.rundown])
	saveIntoDb(IngestDataCache, { rundownId: rundownId }, snapshot.ingestData)
	// saveIntoDb(UserActionsLog, {}, snapshot.userActions)
	saveIntoDb(RundownBaselineObjs, { rundownId: rundownId }, snapshot.baselineObjs)
	saveIntoDb(RundownBaselineAdLibPieces, { rundownId: rundownId }, snapshot.baselineAdlibs)
	saveIntoDb(Segments, { rundownId: rundownId }, snapshot.segments)
	saveIntoDb(Parts, { rundownId: rundownId }, snapshot.parts)
	saveIntoDb(Pieces, { rundownId: rundownId }, snapshot.pieces)
	saveIntoDb(AdLibPieces, { rundownId: rundownId }, snapshot.adLibPieces)
	saveIntoDb(MediaObjects, { _id: { $in: _.map(snapshot.mediaObjects, mediaObject => mediaObject._id) } }, snapshot.mediaObjects)
	saveIntoDb(ExpectedMediaItems, { partId: { $in: snapshot.parts.map(i => i._id) } }, snapshot.expectedMediaItems)

	logger.info(`Restore done`)
}
function restoreFromSystemSnapshot (snapshot: SystemSnapshot) {
	logger.info(`Restoring from system snapshot "${snapshot.snapshot.name}"`)
	let studioId = snapshot.studioId

	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}
	let changes = sumChanges(
		saveIntoDb(Studios, (studioId ? { _id: studioId } : {}), snapshot.studios),
		saveIntoDb(ShowStyleBases, {}, snapshot.showStyleBases),
		saveIntoDb(ShowStyleVariants, {}, snapshot.showStyleVariants),
		(snapshot.blueprints ? saveIntoDb(Blueprints, {}, snapshot.blueprints) : null),
		(snapshot.rundownLayouts ? saveIntoDb(RundownLayouts, {}, snapshot.rundownLayouts) : null),
		saveIntoDb(PeripheralDevices, (studioId ? { studioId: studioId } : {}), snapshot.devices),
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
export function storeRundownSnapshot (rundownId: string, reason: string) {
	check(rundownId, String)
	let s = createRundownSnapshot(rundownId)
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
Picker.route('/snapshot/rundown/:rundownId', (params, req: IncomingMessage, response: ServerResponse, next) => {
	return handleResponse(response, () => {
		check(params.rundownId, String)
		return createRundownSnapshot(params.rundownId)
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
	limit: '15mb' // Arbitrary limit
}))
postRoute.route('/snapshot/restore', (params, req: IncomingMessage, response: ServerResponse, next) => {
	response.setHeader('Content-Type', 'text/plain')

	let content = ''
	try {
		let snapshot = (req as any).body
		if (typeof snapshot !== 'object') { // sometimes, the browser can send the JSON with wrong mimetype, resulting in it not being parsed
			snapshot = JSON.parse(snapshot)
		}

		restoreFromSnapshot(snapshot)

		response.statusCode = 200
		response.end(content)
	} catch (e) {
		response.setHeader('Content-Type', 'text/plain')
		response.statusCode = e.errorCode || 500
		response.end('Error: ' + e.toString())

		if (e.errorCode !== 404) {
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
methods[SnapshotFunctionsAPI.STORE_RUNDOWN_SNAPSHOT] = (rundownId: string, reason: string) => {
	return storeRundownSnapshot(rundownId, reason)
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
setMeteorMethods(methods)
