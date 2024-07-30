import * as Path from 'path'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { check } from '../../lib/check'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	SnapshotType,
	SnapshotSystem,
	SnapshotDebug,
	SnapshotBase,
	SnapshotRundownPlaylist,
} from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import {
	getCurrentTime,
	Time,
	formatDateTime,
	fixValidPath,
	protectString,
	getRandomId,
	omit,
	unprotectStringArray,
	unprotectString,
} from '../../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { PeripheralDevice, PERIPHERAL_SUBTYPE_PROCESS } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { logger } from '../logging'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
import { registerClassToMeteorMethods } from '../methods'
import { NewSnapshotAPI, SnapshotAPIMethods } from '@sofie-automation/meteor-lib/dist/api/shapshot'
import { ICoreSystem, parseVersion } from '../../lib/collections/CoreSystem'
import { CURRENT_SYSTEM_VERSION } from '../migration/currentSystemVersion'
import { isVersionSupported } from '../migration/databaseMigration'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { IngestRundown, VTContent } from '@sofie-automation/blueprints-integration'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { importIngestRundown } from './ingest/http'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { Settings } from '../../lib/Settings'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { Credentials, isResolvedCredentials } from '../security/lib/credentials'
import { OrganizationContentWriteAccess } from '../security/organization'
import { StudioContentWriteAccess } from '../security/studio'
import { SystemWriteAccess } from '../security/system'
import { saveIntoDb, sumChanges } from '../lib/database'
import * as fs from 'fs'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import {
	PackageContainerPackageStatusDB,
	getPackageContainerPackageId,
} from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PackageInfoDB, getPackageInfoId } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
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
	ExpectedPackageId,
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
import { executePeripheralDeviceFunction } from './peripheralDevice/executeFunction'
import { verifyHashedToken } from './singleUseTokens'

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
	studios: Array<DBStudio>
	showStyleBases: Array<DBShowStyleBase>
	showStyleVariants: Array<DBShowStyleVariant>
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

	let queryStudio: MongoQuery<DBStudio> = {}
	let queryShowStyleBases: MongoQuery<DBShowStyleBase> = {}
	let queryShowStyleVariants: MongoQuery<DBShowStyleVariant> = {}
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
					const deviceSnapshot = await executePeripheralDeviceFunction(device._id, 'getSnapshot')

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
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	full = false
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
	const snapshot = await Snapshots.findOneAsync(snapshotId)
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
async function restoreFromSnapshot(
	/** The snapshot data to restore */
	snapshot: AnySnapshot,
	/** Whether to restore debug data (used in debugging) */
	restoreDebugData: boolean
): Promise<void> {
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
		return restoreFromRundownPlaylistSnapshot(snapshot as RundownPlaylistSnapshot, studioId, restoreDebugData)
	} else if (snapshot.snapshot.type === SnapshotType.SYSTEM) {
		// A snapshot of a system
		return restoreFromSystemSnapshot(snapshot as SystemSnapshot)
	} else {
		throw new Meteor.Error(402, `Unknown snapshot type "${snapshot.snapshot.type}"`)
	}
}

async function restoreFromRundownPlaylistSnapshot(
	snapshot: RundownPlaylistSnapshot,
	studioId: StudioId,
	/** Whether to restore debug data (PackageInfo, PackageOnPackageContainer etc, used in debugging) */
	restoreDebugData: boolean
): Promise<void> {
	if (!isVersionSupported(parseVersion(snapshot.version || '0.18.0'))) {
		throw new Meteor.Error(400, `Cannot restore, the snapshot comes from an older, unsupported version of Sofie`)
	}

	const queuedJob = await QueueStudioJob(StudioJobs.RestorePlaylistSnapshot, studioId, {
		snapshotJson: JSONBlobStringify(omit(snapshot, 'mediaObjects', 'userActions')),
	})
	const restoreResult = await queuedJob.complete

	if (restoreDebugData) {
		const expectedPackageIdMap = new Map<ExpectedPackageId, ExpectedPackageId>(
			restoreResult.remappedIds.expectedPackageId
		)

		const mediaObjects = snapshot.mediaObjects.map((o) => {
			return {
				...o,
				studioId,
			}
		})
		const expectedPackageWorkStatuses = snapshot.expectedPackageWorkStatuses.map((o) => {
			return {
				...o,
				studioId,
				fromPackages: o.fromPackages.map((p) => ({
					...p,
					id: expectedPackageIdMap.get(p.id) || p.id,
				})),
			}
		})
		const packageContainerPackageStatuses = snapshot.packageContainerPackageStatuses.map((o) => {
			const packageId = expectedPackageIdMap.get(o.packageId) || o.packageId

			const id = getPackageContainerPackageId(studioId, o.containerId, packageId)
			return {
				...o,
				_id: id,
				studioId,
				packageId: packageId,
			}
		})
		const packageInfos = snapshot.packageInfos.map((o) => {
			const packageId = expectedPackageIdMap.get(o.packageId) || o.packageId
			const id = getPackageInfoId(packageId, o.type)
			return {
				...o,
				_id: id,
				studioId,
				packageId,
			}
		})

		// Restore the collections that the worker is unaware of
		await Promise.all([
			saveIntoDb(MediaObjects, { _id: { $in: mediaObjects.map((o) => o._id) } }, mediaObjects),
			// userActions
			saveIntoDb(
				ExpectedPackageWorkStatuses,
				{
					_id: {
						$in: _.map(expectedPackageWorkStatuses, (o) => o._id),
					},
				},
				expectedPackageWorkStatuses
			),
			saveIntoDb(
				PackageContainerPackageStatuses,
				{
					_id: {
						$in: _.map(packageContainerPackageStatuses, (o) => o._id),
					},
				},
				packageContainerPackageStatuses
			),
			saveIntoDb(PackageInfos, { _id: { $in: _.map(snapshot.packageInfos, (o) => o._id) } }, packageInfos),
		])
	}
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
	hashedToken: string,
	studioId: StudioId | null,
	reason: string
): Promise<SnapshotId> {
	check(hashedToken, String)
	if (!_.isNull(studioId)) check(studioId, String)
	if (!verifyHashedToken(hashedToken)) {
		throw new Meteor.Error(401, `Restart token is invalid or has expired`)
	}

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
	hashedToken: string,
	reason: string,
	full?: boolean
): Promise<SnapshotId> {
	check(hashedToken, String)
	if (!verifyHashedToken(hashedToken)) {
		throw new Meteor.Error(401, `Restart token is invalid or has expired`)
	}

	const s = await createRundownPlaylistSnapshot(access.playlist, full)
	return storeSnaphot(s, access.organizationId, reason)
}
export async function internalStoreRundownPlaylistSnapshot(
	playlist: DBRundownPlaylist,
	reason: string,
	full?: boolean
): Promise<SnapshotId> {
	const s = await createRundownPlaylistSnapshot(playlist, full)
	return storeSnaphot(s, playlist.organizationId || null, reason)
}
export async function storeDebugSnapshot(
	context: MethodContext,
	hashedToken: string,
	studioId: StudioId,
	reason: string
): Promise<SnapshotId> {
	check(studioId, String)
	check(hashedToken, String)
	if (!verifyHashedToken(hashedToken)) {
		throw new Meteor.Error(401, `Restart token is invalid or has expired`)
	}

	const { organizationId, cred } = await OrganizationContentWriteAccess.snapshot(context)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (cred.user && !cred.user.superAdmin) throw new Meteor.Error(401, 'Only Super Admins can store Snapshots')
	}
	const s = await createDebugSnapshot(studioId, organizationId)
	return storeSnaphot(s, organizationId, reason)
}
export async function restoreSnapshot(
	context: MethodContext,
	snapshotId: SnapshotId,
	restoreDebugData: boolean
): Promise<void> {
	check(snapshotId, String)
	const { cred } = await OrganizationContentWriteAccess.snapshot(context)
	if (Settings.enableUserAccounts && isResolvedCredentials(cred)) {
		if (cred.user && !cred.user.superAdmin) throw new Meteor.Error(401, 'Only Super Admins can store Snapshots')
	}
	const snapshot = await retreiveSnapshot(snapshotId, context)
	return restoreFromSnapshot(snapshot, restoreDebugData)
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

export const snapshotPrivateApiRouter = new KoaRouter()

// Setup endpoints:
async function handleKoaResponse(
	ctx: Koa.ParameterizedContext,
	snapshotFcn: () => Promise<{ snapshot: SnapshotBase }>
) {
	try {
		const snapshot = await snapshotFcn()

		ctx.response.type = 'application/json'
		ctx.response.attachment(`${snapshot.snapshot.name}.json`)
		ctx.response.status = 200
		ctx.response.body = JSON.stringify(snapshot, null, 4)
	} catch (e) {
		ctx.response.type = 'text/plain'
		ctx.response.status = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
		ctx.response.body = 'Error: ' + stringifyError(e)

		if (ctx.response.status !== 404) {
			logger.error(stringifyError(e))
		}
	}
}

// For backwards compatibility:
if (!Settings.enableUserAccounts) {
	snapshotPrivateApiRouter.post(
		'/restore',
		bodyParser({
			jsonLimit: '200mb', // Arbitrary limit
		}),
		async (ctx) => {
			const content = 'ok'
			try {
				ctx.response.type = 'text/plain'

				if (ctx.request.type !== 'application/json')
					throw new Meteor.Error(400, 'Restore Snapshot: Invalid content-type')

				const snapshot = ctx.request.body as any
				if (!snapshot) throw new Meteor.Error(400, 'Restore Snapshot: Missing request body')

				const restoreDebugData = ctx.headers['restore-debug-data'] === '1'

				await restoreFromSnapshot(snapshot, restoreDebugData)

				ctx.response.status = 200
				ctx.response.body = content
			} catch (e) {
				ctx.response.type = 'text/plain'
				ctx.response.status = e instanceof Meteor.Error && typeof e.error === 'number' ? e.error : 500
				ctx.response.body = 'Error: ' + stringifyError(e)

				if (ctx.response.status !== 404) {
					logger.error(stringifyError(e))
				}
			}
		}
	)

	// Retrieve snapshot:
	snapshotPrivateApiRouter.get('/retrieve/:snapshotId', async (ctx) => {
		return handleKoaResponse(ctx, async () => {
			const snapshotId = ctx.params.snapshotId
			check(snapshotId, String)
			return retreiveSnapshot(protectString(snapshotId), { userId: null })
		})
	})
}

// Retrieve snapshot:
snapshotPrivateApiRouter.get('/:token/retrieve/:snapshotId', async (ctx) => {
	return handleKoaResponse(ctx, async () => {
		const snapshotId = ctx.params.snapshotId
		check(snapshotId, String)
		return retreiveSnapshot(protectString(snapshotId), { userId: null, token: ctx.params.token })
	})
})

class ServerSnapshotAPI extends MethodContextAPI implements NewSnapshotAPI {
	async storeSystemSnapshot(hashedToken: string, studioId: StudioId | null, reason: string) {
		return storeSystemSnapshot(this, hashedToken, studioId, reason)
	}
	async storeRundownPlaylist(hashedToken: string, playlistId: RundownPlaylistId, reason: string) {
		check(playlistId, String)
		const access = await checkAccessToPlaylist(this, playlistId)
		return storeRundownPlaylistSnapshot(access, hashedToken, reason)
	}
	async storeDebugSnapshot(hashedToken: string, studioId: StudioId, reason: string) {
		return storeDebugSnapshot(this, hashedToken, studioId, reason)
	}
	async restoreSnapshot(snapshotId: SnapshotId, restoreDebugData: boolean) {
		return restoreSnapshot(this, snapshotId, restoreDebugData)
	}
	async removeSnapshot(snapshotId: SnapshotId) {
		return removeSnapshot(this, snapshotId)
	}
}
registerClassToMeteorMethods(SnapshotAPIMethods, ServerSnapshotAPI, false)
