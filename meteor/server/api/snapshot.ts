import * as Path from 'path'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { ServerResponse, IncomingMessage } from 'http'
import { check, Match } from '../../lib/check'
import { Studio } from '../../lib/collections/Studios'
import {
	SnapshotType,
	SnapshotSystem,
	SnapshotDebug,
	SnapshotBase,
	SnapshotRundownPlaylist,
} from '../../lib/collections/Snapshots'
import { UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { PieceGeneric } from '../../lib/collections/Pieces'
import { MediaObject } from '../../lib/collections/MediaObjects'
import {
	getCurrentTime,
	Time,
	formatDateTime,
	fixValidPath,
	protectString,
	getRandomId,
	stringifyError,
	omit,
	unprotectStringArray,
	unprotectString,
} from '../../lib/lib'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PeripheralDevice, PERIPHERAL_SUBTYPE_PROCESS } from '../../lib/collections/PeripheralDevices'
import { logger } from '../logging'
import { TimelineComplete } from '../../lib/collections/Timeline'
import { PeripheralDeviceCommand } from '../../lib/collections/PeripheralDeviceCommands'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { registerClassToMeteorMethods } from '../methods'
import { NewSnapshotAPI, SnapshotAPIMethods } from '../../lib/api/shapshot'
import { ICoreSystem, parseVersion } from '../../lib/collections/CoreSystem'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { isVersionSupported } from '../migration/databaseMigration'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { Blueprint } from '../../lib/collections/Blueprints'
import { IngestRundown, VTContent } from '@sofie-automation/blueprints-integration'
import { MongoQuery } from '../../lib/typings/meteor'
import { importIngestRundown } from './ingest/http'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'
import { Settings } from '../../lib/Settings'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { Credentials, isResolvedCredentials } from '../security/lib/credentials'
import { OrganizationContentWriteAccess } from '../security/organization'
import { StudioContentWriteAccess, StudioReadAccess } from '../security/studio'
import { SystemWriteAccess } from '../security/system'
import { PickerPOST, PickerGET } from './http'
import { saveIntoDb, sumChanges } from '../lib/database'
import * as fs from 'fs'
import { ExpectedPackageWorkStatus } from '../../lib/collections/ExpectedPackageWorkStatuses'
import { PackageContainerPackageStatusDB } from '../../lib/collections/PackageContainerPackageStatus'
import { PackageInfoDB } from '../../lib/collections/PackageInfos'
import { checkStudioExists } from '../optimizations'
import { CoreRundownPlaylistSnapshot } from '@sofie-automation/corelib/dist/snapshots'
import { QueueStudioJob } from '../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { ReadonlyDeep } from 'type-fest'
import { checkAccessToPlaylist, VerifiedRundownPlaylistContentAccess } from './lib'
import { getSystemStorePath, PackageInfo } from '../coreSystem'
import { JSONBlobParse, JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import {
	BlueprintId,
	OrganizationId,
	PeripheralDeviceId,
	RundownPlaylistId,
	ShowStyleBaseId,
	SnapshotId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	Blueprints,
	CoreSystem,
	ExpectedPackageWorkStatuses,
	MediaObjects,
	PackageContainerPackageStatuses,
	PackageInfos,
	PeripheralDeviceCommands,
	PeripheralDevices,
	RundownLayouts,
	RundownPlaylists,
	ShowStyleBases,
	ShowStyleVariants,
	Snapshots,
	Studios,
	Timeline,
	TriggeredActions,
	UserActionsLog,
} from '../collections'
import { getCoreSystemAsync } from '../coreSystem/collection'

interface RundownPlaylistSnapshot extends CoreRundownPlaylistSnapshot {
	versionExtended: string | undefined

	snapshot: SnapshotRundownPlaylist
	userActions: Array<UserActionsLogItem>
	mediaObjects: Array<MediaObject>

	expectedPackageWorkStatuses: Array<ExpectedPackageWorkStatus>
	packageContainerPackageStatuses: Array<PackageContainerPackageStatusDB>
	packageInfos: Array<PackageInfoDB>
}
interface SystemSnapshot {
	version: string
	versionExtended?: string
	studioId: StudioId | null
	snapshot: SnapshotSystem
	studios: Array<Studio>
	showStyleBases: Array<ShowStyleBase>
	showStyleVariants: Array<ShowStyleVariant>
	blueprints?: Array<Blueprint> // optional, to be backwards compatible
	rundownLayouts?: Array<RundownLayoutBase> // optional, to be backwards compatible
	triggeredActions?: Array<DBTriggeredActions> // optional, to be backwards compatible
	devices: Array<PeripheralDevice>
	deviceCommands: Array<PeripheralDeviceCommand>
	coreSystem: ICoreSystem
}
interface DebugSnapshot {
	version: string
	versionExtended?: string
	studioId?: StudioId
	snapshot: SnapshotDebug
	system: SystemSnapshot
	activeRundownPlaylists: Array<RundownPlaylistSnapshot>
	timeline: TimelineComplete[]
	userActionLog: Array<UserActionsLogItem>
	deviceSnaphots: Array<DeviceSnapshot>
}
interface DeviceSnapshot {
	deviceId: PeripheralDeviceId
	created: Time
	replyTime: Time
	content: any
}
type AnySnapshot = RundownPlaylistSnapshot | SystemSnapshot | DebugSnapshot

/**
 * Create a snapshot of all items related to the base system (all settings),
 * that means all studios, showstyles, peripheralDevices etc
 * If studioId is provided, only return items related to that studio
 * @param studioId (Optional) Only generate for a certain studio
 */
async function createSystemSnapshot(
	studioId: StudioId | null,
	organizationId: OrganizationId | null
): Promise<SystemSnapshot> {
	const snapshotId: SnapshotId = getRandomId()
	logger.info(`Generating System snapshot "${snapshotId}"` + (studioId ? `for studio "${studioId}"` : ''))

	const coreSystem = await getCoreSystemAsync()
	if (!coreSystem) throw new Meteor.Error(500, `coreSystem not set up`)

	if (Settings.enableUserAccounts && !organizationId)
		throw new Meteor.Error(500, 'Not able to create a systemSnaphost without organizationId')

	let queryStudio: MongoQuery<Studio> = {}
	let queryShowStyleBases: MongoQuery<ShowStyleBase> = {}
	let queryShowStyleVariants: MongoQuery<ShowStyleVariant> = {}
	let queryRundownLayouts: MongoQuery<RundownLayoutBase> = {}
	let queryTriggeredActions: MongoQuery<DBTriggeredActions> = {}
	let queryDevices: MongoQuery<PeripheralDevice> = {}
	let queryBlueprints: MongoQuery<Blueprint> = {}

	if (studioId) queryStudio = { _id: studioId }
	else if (organizationId) queryStudio = { organizationId: organizationId }
	const studios = await Studios.findFetchAsync(queryStudio)

	if (studioId) {
		const ids: ShowStyleBaseId[] = []
		for (const studio of studios) {
			ids.push(...studio.supportedShowStyleBase)
		}
		queryShowStyleBases = {
			_id: { $in: ids },
		}
	} else if (organizationId) {
		queryShowStyleBases = { organizationId: organizationId }
	}
	const showStyleBases = await ShowStyleBases.findFetchAsync(queryShowStyleBases)

	const showStyleBaseIds = showStyleBases.map((s) => s._id)

	queryShowStyleVariants = { showStyleBaseId: { $in: showStyleBaseIds } }
	queryRundownLayouts = { showStyleBaseId: { $in: showStyleBaseIds } }
	queryTriggeredActions = { showStyleBaseIds: { $in: [null, ...showStyleBaseIds] } }

	if (studioId) queryDevices = { studioId: studioId }
	else if (organizationId) queryDevices = { organizationId: organizationId }

	const [showStyleVariants, rundownLayouts, devices, triggeredActions] = await Promise.all([
		ShowStyleVariants.findFetchAsync(queryShowStyleVariants),
		RundownLayouts.findFetchAsync(queryRundownLayouts),
		PeripheralDevices.findFetchAsync(queryDevices),
		TriggeredActions.findFetchAsync(queryTriggeredActions),
	])

	if (studioId) {
		const blueprintIds: BlueprintId[] = []
		for (const showStyleBase of showStyleBases) {
			blueprintIds.push(showStyleBase.blueprintId)
		}
		queryBlueprints = {
			_id: { $in: blueprintIds },
		}
	} else if (organizationId) {
		queryBlueprints = {
			organizationId: organizationId,
		}
	}
	const blueprints = await Blueprints.findFetchAsync(queryBlueprints)

	const deviceCommands = await PeripheralDeviceCommands.findFetchAsync({
		deviceId: { $in: devices.map((device) => device._id) },
	})

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		versionExtended: PackageInfo.versionExtended || PackageInfo.version || 'UNKNOWN',
		studioId: studioId,
		snapshot: {
			_id: snapshotId,
			organizationId: organizationId,
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
		triggeredActions,
		devices,
		coreSystem,
		deviceCommands: deviceCommands,
	}
}

/**
 * Create a snapshot of active rundowns related to a studio and all related data, for debug purposes
 * @param studioId
 */
async function createDebugSnapshot(studioId: StudioId, organizationId: OrganizationId | null): Promise<DebugSnapshot> {
	const snapshotId: SnapshotId = getRandomId()
	logger.info(`Generating Debug snapshot "${snapshotId}" for studio "${studioId}"`)

	const studio = await Studios.findOneAsync(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio ${studioId} not found`)

	const systemSnapshot = await createSystemSnapshot(studioId, organizationId)

	const activePlaylists = await RundownPlaylists.findFetchAsync({
		studioId: studio._id,
		activationId: { $exists: true },
	})

	const activePlaylistSnapshots = await Promise.all(
		activePlaylists.map(async (playlist) => createRundownPlaylistSnapshot(playlist, true))
	)

	const timeline = await Timeline.findFetchAsync({})
	const userActionLogLatest = await UserActionsLog.findFetchAsync({
		timestamp: {
			$gt: getCurrentTime() - 1000 * 3600 * 3, // latest 3 hours
		},
	})

	// Also fetch debugInfo from devices:
	const deviceSnaphots: Array<DeviceSnapshot> = _.compact(
		await Promise.all(
			systemSnapshot.devices.map(async (device) => {
				if (device.connected && device.subType === PERIPHERAL_SUBTYPE_PROCESS) {
					const startTime = getCurrentTime()

					// defer to another fiber
					const deviceSnapshot = await PeripheralDeviceAPI.executeFunction(device._id, 'getSnapshot')

					logger.info('Got snapshot from device "' + device._id + '"')
					return {
						deviceId: device._id,
						created: startTime,
						replyTime: getCurrentTime(),
						content: deviceSnapshot,
					}
				}
				return null
			})
		)
	)

	logger.info(`Snapshot generation done`)
	return {
		version: CURRENT_SYSTEM_VERSION,
		versionExtended: PackageInfo.versionExtended || PackageInfo.version || 'UNKNOWN',
		studioId: studioId,
		snapshot: {
			_id: snapshotId,
			organizationId: organizationId,
			type: SnapshotType.DEBUG,
			created: getCurrentTime(),
			name: `Debug_${studioId}_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION,
		},
		system: systemSnapshot,
		activeRundownPlaylists: activePlaylistSnapshots,
		timeline: timeline,
		userActionLog: userActionLogLatest,
		deviceSnaphots: deviceSnaphots,
	}
}

function getPiecesMediaObjects(pieces: PieceGeneric[]): string[] {
	return _.compact(pieces.map((piece) => (piece.content as VTContent | undefined)?.fileName))
}

async function createRundownPlaylistSnapshot(
	playlist: ReadonlyDeep<RundownPlaylist>,
	full: boolean = false
): Promise<RundownPlaylistSnapshot> {
	/** Max count of one type of items to include in the snapshot */
	const LIMIT_COUNT = 500

	const snapshotId: SnapshotId = getRandomId()
	logger.info(
		`Generating ${full ? 'full ' : ''}RundownPlaylist snapshot "${snapshotId}" for RundownPlaylist "${
			playlist._id
		}"`
	)

	const queuedJob = await QueueStudioJob(StudioJobs.GeneratePlaylistSnapshot, playlist.studioId, {
		playlistId: playlist._id,
		full,
	})
	const coreResult = await queuedJob.complete
	const coreSnapshot: CoreRundownPlaylistSnapshot = JSONBlobParse(coreResult.snapshotJson)

	const mediaObjectIds: Array<string> = [
		...getPiecesMediaObjects(coreSnapshot.pieces),
		...getPiecesMediaObjects(coreSnapshot.adLibPieces),
		...getPiecesMediaObjects(coreSnapshot.baselineAdlibs),
	]
	const pMediaObjects = MediaObjects.findFetchAsync({
		studioId: playlist.studioId,
		mediaId: { $in: mediaObjectIds },
	})

	const rundownIds = unprotectStringArray(coreSnapshot.rundowns.map((i) => i._id))
	const pUserActions = UserActionsLog.findFetchAsync({
		args: {
			$regex:
				`.*(` +
				rundownIds
					.concat(unprotectString(playlist._id))
					.map((i) => `"${i}"`)
					.join('|') +
				`).*`,
		},
	})

	const pExpectedPackageWorkStatuses = ExpectedPackageWorkStatuses.findFetchAsync(
		{
			studioId: playlist.studioId,
		},
		{
			limit: LIMIT_COUNT,
		}
	)
	const pPackageContainerPackageStatuses = PackageContainerPackageStatuses.findFetchAsync(
		{
			studioId: playlist.studioId,
		},
		{
			limit: LIMIT_COUNT,
		}
	)
	const pPackageInfos = PackageInfos.findFetchAsync(
		{
			studioId: playlist.studioId,
		},
		{
			limit: LIMIT_COUNT,
		}
	)

	const [mediaObjects, userActions, expectedPackageWorkStatuses, packageContainerPackageStatuses, packageInfos] =
		await Promise.all([
			pMediaObjects,
			pUserActions,
			pExpectedPackageWorkStatuses,
			pPackageContainerPackageStatuses,
			pPackageInfos,
		])

	return {
		...coreSnapshot,
		versionExtended: PackageInfo.versionExtended || PackageInfo.version || 'UNKNOWN',
		snapshot: {
			_id: snapshotId,
			organizationId: playlist.organizationId ?? null,
			created: getCurrentTime(),
			type: SnapshotType.RUNDOWNPLAYLIST,
			playlistId: playlist._id,
			studioId: playlist.studioId,
			name: `Rundown_${playlist.name}_${playlist._id}_${formatDateTime(getCurrentTime())}`,
			version: CURRENT_SYSTEM_VERSION,
		},

		// Add on some collections that the worker is unaware of
		mediaObjects,
		userActions,
		expectedPackageWorkStatuses,
		packageContainerPackageStatuses,
		packageInfos,
	}
}

// Setup endpoints:
async function handleResponse(response: ServerResponse, snapshotFcn: () => Promise<{ snapshot: SnapshotBase }>) {
	try {
		const s: any = await snapshotFcn()
		response.setHeader('Content-Type', 'application/json')
		response.setHeader(
			'Content-Disposition',
			`attachment; filename*=UTF-8''${encodeURIComponent(s.snapshot.name)}.json`
		)

		const content = _.isString(s) ? s : JSON.stringify(s, null, 4)
		response.statusCode = 200
		response.end(content)
	} catch (e) {
		response.setHeader('Content-Type', 'text/plain')
		response.statusCode = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
		response.end('Error: ' + stringifyError(e))

		if (response.statusCode !== 404) {
			logger.error(stringifyError(e))
		}
	}
}
async function storeSnaphot(
	snapshot: { snapshot: SnapshotBase },
	organizationId: OrganizationId | null,
	comment: string
): Promise<SnapshotId> {
	const storePath = getSystemStorePath()
	const fileName = fixValidPath(snapshot.snapshot.name) + '.json'
	const filePath = Path.join(storePath, fileName)

	const str = JSON.stringify(snapshot)

	// Store to the persistant file storage
	logger.info(`Save snapshot file ${filePath}`)
	if (!Meteor.isTest) {
		// If we're running in a unit-test, don't write to disk
		await fs.promises.writeFile(filePath, str)
	}

	const id = await Snapshots.insertAsync({
		_id: protectString(fileName),
		organizationId: organizationId,
		fileName: fileName,
		type: snapshot.snapshot.type,
		created: snapshot.snapshot.created,
		name: snapshot.snapshot.name,
		description: snapshot.snapshot.description,
		version: CURRENT_SYSTEM_VERSION,
		comment: comment,
	})

	return id
}
async function retreiveSnapshot(snapshotId: SnapshotId, cred0: Credentials): Promise<AnySnapshot> {
	const snapshot = Snapshots.findOne(snapshotId)
	if (!snapshot) throw new Meteor.Error(404, `Snapshot not found!`)

	if (Settings.enableUserAccounts) {
		if (snapshot.type === SnapshotType.RUNDOWNPLAYLIST) {
			if (!snapshot.studioId)
				throw new Meteor.Error(500, `Snapshot is of type "${snapshot.type}" but hase no studioId`)
			await StudioContentWriteAccess.dataFromSnapshot(cred0, snapshot.studioId)
		} else if (snapshot.type === SnapshotType.SYSTEM) {
			if (!snapshot.organizationId)
				throw new Meteor.Error(500, `Snapshot is of type "${snapshot.type}" but has no organizationId`)
			await OrganizationContentWriteAccess.dataFromSnapshot(cred0, snapshot.organizationId)
		} else {
			await SystemWriteAccess.coreSystem(cred0)
		}
	}

	const storePath = getSystemStorePath()
	const filePath = Path.join(storePath, snapshot.fileName)

	const dataStr = !Meteor.isTest // If we're running in a unit-test, don't access files
		? await fs.promises.readFile(filePath, { encoding: 'utf8' })
		: ''

	const readSnapshot = JSON.parse(dataStr)

	return readSnapshot
}
async function restoreFromSnapshot(snapshot: AnySnapshot): Promise<void> {
	// Determine what kind of snapshot

	if (!_.isObject(snapshot)) throw new Meteor.Error(500, `Restore input data is not an object`)
	// First, some special (debugging) cases:
	// @ts-expect-error is's not really a snapshot here:
	if (snapshot.externalId && snapshot.segments && snapshot.type === 'mos') {
		// Special: Not a snapshot, but a datadump of a MOS rundown
		const studioId: StudioId = Meteor.settings.manualSnapshotIngestStudioId || 'studio0'
		const studioExists = await checkStudioExists(studioId)
		if (studioExists) {
			await importIngestRundown(studioId, snapshot as unknown as IngestRundown)
			return
		}
		throw new Meteor.Error(500, `No Studio found`)
	}

	// Then, continue as if it's a normal snapshot:

	if (!snapshot.snapshot) throw new Meteor.Error(500, `Restore input data is not a snapshot (${_.keys(snapshot)})`)

	if (snapshot.snapshot.type === SnapshotType.RUNDOWNPLAYLIST) {
		const playlistSnapshot = snapshot as RundownPlaylistSnapshot

		if (!isVersionSupported(parseVersion(playlistSnapshot.version || '0.18.0'))) {
			throw new Meteor.Error(
				400,
				`Cannot restore, the snapshot comes from an older, unsupported version of Sofie`
			)
		}

		// TODO: Improve this. This matches the 'old' behaviour
		const studios = await Studios.findFetchAsync({})
		const snapshotStudioExists = studios.find((studio) => studio._id === playlistSnapshot.playlist.studioId)
		const studioId = snapshotStudioExists ? playlistSnapshot.playlist.studioId : studios[0]?._id
		if (!studioId) throw new Meteor.Error(500, `No Studio found`)

		// A snapshot of a rundownPlaylist
		return restoreFromRundownPlaylistSnapshot(snapshot as RundownPlaylistSnapshot, studioId)
	} else if (snapshot.snapshot.type === SnapshotType.SYSTEM) {
		// A snapshot of a system
		return restoreFromSystemSnapshot(snapshot as SystemSnapshot)
	} else {
		throw new Meteor.Error(402, `Unknown snapshot type "${snapshot.snapshot.type}"`)
	}
}

async function restoreFromRundownPlaylistSnapshot(
	snapshot: RundownPlaylistSnapshot,
	studioId: StudioId
): Promise<void> {
	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}

	const queuedJob = await QueueStudioJob(StudioJobs.RestorePlaylistSnapshot, studioId, {
		snapshotJson: JSONBlobStringify(omit(snapshot, 'mediaObjects', 'userActions')),
	})
	await queuedJob.complete

	// Restore the collections that the worker is unaware of
	await Promise.all([
		// saveIntoDb(UserActionsLog, {}, snapshot.userActions),
		saveIntoDb(
			MediaObjects,
			{ _id: { $in: _.map(snapshot.mediaObjects, (mediaObject) => mediaObject._id) } },
			snapshot.mediaObjects
		),
	])
}

async function restoreFromSystemSnapshot(snapshot: SystemSnapshot): Promise<void> {
	logger.info(`Restoring from system snapshot "${snapshot.snapshot.name}"`)
	const studioId = snapshot.studioId

	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}
	if (snapshot.blueprints) {
		snapshot.blueprints = _.map(snapshot.blueprints, (bp) => {
			bp.hasCode = !!bp.code
			return bp
		})
	}

	const changes = sumChanges(
		...(await Promise.all([
			saveIntoDb(Studios, studioId ? { _id: studioId } : {}, snapshot.studios),
			saveIntoDb(ShowStyleBases, {}, snapshot.showStyleBases),
			saveIntoDb(ShowStyleVariants, {}, snapshot.showStyleVariants),
			snapshot.blueprints ? saveIntoDb(Blueprints, {}, snapshot.blueprints) : null,
			snapshot.rundownLayouts ? saveIntoDb(RundownLayouts, {}, snapshot.rundownLayouts) : null,
			snapshot.triggeredActions ? saveIntoDb(TriggeredActions, {}, snapshot.triggeredActions) : null,
			saveIntoDb(PeripheralDevices, studioId ? { studioId: studioId } : {}, snapshot.devices),
			saveIntoDb(CoreSystem, {}, [snapshot.coreSystem]),
		]))
	)
	// saveIntoDb(PeripheralDeviceCommands, {}, snapshot.deviceCommands) // ignored

	logger.info(
		`Restore done (added ${changes.added}, updated ${changes.updated}, removed ${changes.removed} documents)`
	)
}
/** Take and store a system snapshot */
export async function storeSystemSnapshot(
	context: MethodContext,
	studioId: StudioId | null,
	reason: string
): Promise<SnapshotId> {
	if (!_.isNull(studioId)) check(studioId, String)
	const { organizationId, cred } = await OrganizationContentWriteAccess.snapshot(context)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (cred.user && !cred.user.superAdmin) throw new Meteor.Error(401, 'Only Super Admins can store Snapshots')
	}
	return internalStoreSystemSnapshot(organizationId, studioId, reason)
}
/** Take and store a system snapshot. For internal use only, performs no access control. */
export async function internalStoreSystemSnapshot(
	organizationId: OrganizationId | null,
	studioId: StudioId | null,
	reason: string
): Promise<SnapshotId> {
	if (!_.isNull(studioId)) check(studioId, String)

	const s = await createSystemSnapshot(studioId, organizationId)
	return storeSnaphot(s, organizationId, reason)
}
export async function storeRundownPlaylistSnapshot(
	access: VerifiedRundownPlaylistContentAccess,
	reason: string,
	full?: boolean
): Promise<SnapshotId> {
	const s = await createRundownPlaylistSnapshot(access.playlist, full)
	return storeSnaphot(s, access.organizationId, reason)
}
export async function internalStoreRundownPlaylistSnapshot(
	playlist: RundownPlaylist,
	reason: string,
	full?: boolean
): Promise<SnapshotId> {
	const s = await createRundownPlaylistSnapshot(playlist, full)
	return storeSnaphot(s, playlist.organizationId || null, reason)
}
export async function storeDebugSnapshot(
	context: MethodContext,
	studioId: StudioId,
	reason: string
): Promise<SnapshotId> {
	check(studioId, String)
	const { organizationId, cred } = await OrganizationContentWriteAccess.snapshot(context)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (cred.user && !cred.user.superAdmin) throw new Meteor.Error(401, 'Only Super Admins can store Snapshots')
	}
	const s = await createDebugSnapshot(studioId, organizationId)
	return storeSnaphot(s, organizationId, reason)
}
export async function restoreSnapshot(context: MethodContext, snapshotId: SnapshotId): Promise<void> {
	check(snapshotId, String)
	const { cred } = await OrganizationContentWriteAccess.snapshot(context)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (cred.user && !cred.user.superAdmin) throw new Meteor.Error(401, 'Only Super Admins can store Snapshots')
	}
	const snapshot = await retreiveSnapshot(snapshotId, context)
	return restoreFromSnapshot(snapshot)
}
export async function removeSnapshot(context: MethodContext, snapshotId: SnapshotId): Promise<void> {
	check(snapshotId, String)
	const { snapshot, cred } = await OrganizationContentWriteAccess.snapshot(context, snapshotId)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (cred.user && !cred.user.superAdmin) throw new Meteor.Error(401, 'Only Super Admins can store Snapshots')
	}
	logger.info(`Removing snapshot ${snapshotId}`)

	if (!snapshot) throw new Meteor.Error(404, `Snapshot "${snapshotId}" not found!`)

	if (snapshot.fileName) {
		// remove from disk
		const storePath = getSystemStorePath()
		const filePath = Path.join(storePath, snapshot.fileName)
		try {
			logger.info(`Removing snapshot file ${filePath}`)

			if (!Meteor.isTest) {
				// If we're running in a unit-test, don't access files
				await fs.promises.unlink(filePath)
			}
		} catch (e) {
			// Log the error, but continue
			logger.error('Error in removeSnapshot')
			logger.error(e)
		}
	}
	await Snapshots.removeAsync(snapshot._id)
}
if (!Settings.enableUserAccounts) {
	// For backwards compatibility:

	PickerGET.route('/snapshot/system/:studioId', async (params, _req: IncomingMessage, response: ServerResponse) => {
		return handleResponse(response, async () => {
			check(params.studioId, Match.Optional(String))

			const cred0: Credentials = { userId: null, token: params.token }
			const { organizationId, cred } = await OrganizationContentWriteAccess.snapshot(cred0)
			await StudioReadAccess.studio(protectString(params.studioId), cred)

			return createSystemSnapshot(protectString(params.studioId), organizationId)
		})
	})
	async function createRundownSnapshot(response: ServerResponse, params) {
		return handleResponse(response, async () => {
			check(params.playlistId, String)
			check(params.full, Match.Optional(String))

			const cred0: Credentials = { userId: null, token: params.token }
			const { cred } = await OrganizationContentWriteAccess.snapshot(cred0)
			const playlist = RundownPlaylists.findOne(protectString(params.playlistId))
			if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${params.playlistId}" not found`)
			await StudioReadAccess.studioContent(playlist.studioId, cred)

			return createRundownPlaylistSnapshot(playlist, params.full === 'true')
		})
	}
	PickerGET.route('/snapshot/rundown/:playlistId', async (params, _req: IncomingMessage, response: ServerResponse) =>
		createRundownSnapshot(response, params)
	)
	PickerGET.route(
		'/snapshot/rundown/:playlistId/:full',
		async (params, _req: IncomingMessage, response: ServerResponse) => createRundownSnapshot(response, params)
	)
	PickerGET.route('/snapshot/debug/:studioId', async (params, _req: IncomingMessage, response: ServerResponse) => {
		return handleResponse(response, async () => {
			check(params.studioId, String)

			const cred0: Credentials = { userId: null, token: params.token }
			const { organizationId, cred } = await OrganizationContentWriteAccess.snapshot(cred0)
			await StudioReadAccess.studio(protectString(params.studioId), cred)

			return createDebugSnapshot(protectString(params.studioId), organizationId)
		})
	})
}
PickerPOST.route('/snapshot/restore', async (_params, req: IncomingMessage, response: ServerResponse) => {
	const content = 'ok'
	try {
		response.setHeader('Content-Type', 'text/plain')
		let snapshot = req.body as any
		if (!snapshot) throw new Meteor.Error(400, 'Restore Snapshot: Missing request body')

		if (typeof snapshot !== 'object') {
			// sometimes, the browser can send the JSON with wrong mimetype, resulting in it not being parsed
			snapshot = JSON.parse(snapshot)
		}

		await restoreFromSnapshot(snapshot)

		response.statusCode = 200
		response.end(content)
	} catch (e) {
		response.setHeader('Content-Type', 'text/plain')
		response.statusCode = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
		response.end('Error: ' + stringifyError(e))

		if (response.statusCode !== 404) {
			logger.error(stringifyError(e))
		}
	}
})
if (!Settings.enableUserAccounts) {
	// For backwards compatibility:

	// Retrieve snapshot:
	PickerGET.route(
		'/snapshot/retrieve/:snapshotId',
		async (params, _req: IncomingMessage, response: ServerResponse) => {
			return handleResponse(response, async () => {
				check(params.snapshotId, String)
				return retreiveSnapshot(protectString(params.snapshotId), { userId: null })
			})
		}
	)
}
// Retrieve snapshot:
PickerGET.route(
	'/snapshot/:token/retrieve/:snapshotId',
	async (params, _req: IncomingMessage, response: ServerResponse) => {
		return handleResponse(response, async () => {
			check(params.snapshotId, String)
			return retreiveSnapshot(protectString(params.snapshotId), { userId: null, token: params.token })
		})
	}
)

class ServerSnapshotAPI extends MethodContextAPI implements NewSnapshotAPI {
	async storeSystemSnapshot(studioId: StudioId | null, reason: string) {
		return storeSystemSnapshot(this, studioId, reason)
	}
	async storeRundownPlaylist(playlistId: RundownPlaylistId, reason: string) {
		check(playlistId, String)
		const access = await checkAccessToPlaylist(this, playlistId)
		return storeRundownPlaylistSnapshot(access, reason)
	}
	async storeDebugSnapshot(studioId: StudioId, reason: string) {
		return storeDebugSnapshot(this, studioId, reason)
	}
	async restoreSnapshot(snapshotId: SnapshotId) {
		return restoreSnapshot(this, snapshotId)
	}
	async removeSnapshot(snapshotId: SnapshotId) {
		return removeSnapshot(this, snapshotId)
	}
}
registerClassToMeteorMethods(SnapshotAPIMethods, ServerSnapshotAPI, false)
