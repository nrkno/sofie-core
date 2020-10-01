import { Meteor } from 'meteor/meteor'
import {
	getHash,
	getCurrentTime,
	protectString,
	unprotectObject,
	isProtectedString,
	waitForPromise,
	waitForPromiseAll,
	asyncCollectionFindOne,
	asyncCollectionFindFetch,
	makePromise,
} from '../../../lib/lib'
import { Studio, Studios, StudioId } from '../../../lib/collections/Studios'
import {
	PeripheralDevice,
	PeripheralDevices,
	getStudioIdFromDevice,
	PeripheralDeviceId,
} from '../../../lib/collections/PeripheralDevices'
import { Rundowns, Rundown, RundownId, DBRundown } from '../../../lib/collections/Rundowns'
import { logger } from '../../logging'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { SegmentId, Segment, Segments } from '../../../lib/collections/Segments'
import { PartId, Part } from '../../../lib/collections/Parts'
import { PeripheralDeviceContentWriteAccess } from '../../security/peripheralDevice'
import { MethodContext } from '../../../lib/api/methods'
import { CacheForIngest, ReadOnlyCache } from '../../cache/DatabaseCaches'
import { Credentials } from '../../security/lib/credentials'
import { IngestRundown, ExtendedIngestRundown, IBlueprintRundown } from 'tv-automation-sofie-blueprints-integration'
import { ShowStyleBase, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { syncFunction } from '../../codeControl'
import { DeepReadonly } from 'utility-types'
import { rundownPlaylistCustomSyncFunction, RundownSyncFunctionPriority } from './rundownInput'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { IngestDataCacheObj, IngestDataCache } from '../../../lib/collections/IngestDataCache'
import { DbCacheWriteCollection } from '../../cache/lib'
import { RundownIngestDataCacheCollection } from './ingestCache'
import { profiler } from '../profiler'

/** Check Access and return PeripheralDevice, throws otherwise */
export function checkAccessAndGetPeripheralDevice(
	deviceId: PeripheralDeviceId,
	token: string | undefined,
	context: Credentials | MethodContext
): PeripheralDevice {
	const span = profiler.startSpan('lib.checkAccessAndGetPeripheralDevice')

	const { device: peripheralDevice } = PeripheralDeviceContentWriteAccess.peripheralDevice(
		{ userId: context.userId, token },
		deviceId
	)
	if (!peripheralDevice) {
		throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)
	}

	span?.end()
	return peripheralDevice
}

export function getRundownId(studio: DeepReadonly<Studio> | StudioId, rundownExternalId: string): RundownId {
	if (!studio) throw new Meteor.Error(500, 'getRundownId: studio not set!')
	if (!rundownExternalId) throw new Meteor.Error(401, 'getRundownId: rundownExternalId must be set!')
	return protectString<RundownId>(getHash(`${isProtectedString(studio) ? studio : studio._id}_${rundownExternalId}`))
}
export function getSegmentId(rundownId: RundownId, segmentExternalId: string): SegmentId {
	if (!rundownId) throw new Meteor.Error(401, 'getSegmentId: rundownId must be set!')
	if (!segmentExternalId) throw new Meteor.Error(401, 'getSegmentId: segmentExternalId must be set!')
	return protectString<SegmentId>(getHash(`${rundownId}_segment_${segmentExternalId}`))
}
export function getPartId(rundownId: RundownId, partExternalId: string): PartId {
	if (!rundownId) throw new Meteor.Error(401, 'getPartId: rundownId must be set!')
	if (!partExternalId) throw new Meteor.Error(401, 'getPartId: partExternalId must be set!')
	return protectString<PartId>(getHash(`${rundownId}_part_${partExternalId}`))
}

export function getStudioFromDevice(peripheralDevice: PeripheralDevice): Studio {
	const span = profiler.startSpan('mosDevice.lib.getStudioFromDevice')

	const studioId = getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	const studio = Studios.findOne(studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" of device "${peripheralDevice._id}" not found`)

	span?.end()
	return studio
}
export function getRundownPlaylist(rundown: Rundown): RundownPlaylist {
	const span = profiler.startSpan('mosDevice.lib.getRundownPlaylist')

	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist)
		throw new Meteor.Error(500, `Rundown playlist "${rundown.playlistId}" of rundown "${rundown._id}" not found!`)
	playlist.touch()

	span?.end()
	return playlist
}
export function getRundown(rundownId: RundownId, externalRundownId: string): Rundown {
	const span = profiler.startSpan('mosDevice.lib.getRundown')

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" ("${externalRundownId}") not found`)
	rundown.touch()

	span?.end()
	return rundown
}
export function getRundown2(cache: ReadOnlyCache<CacheForIngest> | CacheForIngest): DeepReadonly<Rundown> {
	const rundown = cache.Rundown.doc
	if (!rundown) {
		const rundownId = getRundownId(cache.Studio.doc, cache.RundownExternalId)
		throw new Meteor.Error(404, `Rundown "${rundownId}" ("${cache.RundownExternalId}") not found`)
	}
	rundown.touch()
	return rundown
}
export function getSegment(segmentId: SegmentId): Segment {
	const segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)
	return segment
}
export function getSegment2(cache: ReadOnlyCache<CacheForIngest> | CacheForIngest, segmentId: SegmentId): Segment {
	const segment = cache.Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)
	return segment
}
export function getPeripheralDeviceFromRundown(rundown: Rundown): PeripheralDevice {
	if (!rundown.peripheralDeviceId)
		throw new Meteor.Error(500, `Rundown "${rundown._id}" does not have a peripheralDeviceId`)

	const device = PeripheralDevices.findOne(rundown.peripheralDeviceId)
	if (!device)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" not found`
		)
	if (device.category !== PeripheralDeviceAPI.DeviceCategory.INGEST)
		throw new Meteor.Error(
			404,
			`PeripheralDevice "${rundown.peripheralDeviceId}" of rundown "${rundown._id}" is not an INGEST device!`
		)
	return device
}

export interface IngestPlayoutInfo {
	readonly playlist: DeepReadonly<RundownPlaylist>
	readonly rundowns: DeepReadonly<Array<Rundown>>
	readonly currentPartInstance: DeepReadonly<PartInstance> | undefined
	readonly nextPartInstance: DeepReadonly<PartInstance> | undefined
}

export function rundownIngestSyncFunction<T>(
	context: string,
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	calcFcn: (cache: ReadOnlyCache<CacheForIngest>, ingestCache: RundownIngestDataCacheCollection) => T,
	saveFcn: ((cache: CacheForIngest, playoutInfo: IngestPlayoutInfo, data: T) => void) | null
): void {
	const studioId = getStudioIdFromDevice(peripheralDevice)
	if (!studioId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no Studio')

	updateDeviceLastDataReceived(peripheralDevice._id)

	return rundownIngestSyncFromStudioFunction(
		context,
		studioId,
		rundownExternalId,
		(cache, ingestCache) => calcFcn(cache, ingestCache),
		saveFcn
	)
}

export function getIngestPlaylistInfoFromDb(rundown: DeepReadonly<Rundown>) {
	const [playlist, rundowns] = waitForPromiseAll([
		asyncCollectionFindOne(RundownPlaylists, { _id: rundown.playlistId }),
		asyncCollectionFindFetch(
			Rundowns,
			{
				playlistId: rundown.playlistId,
			},
			{
				sort: {
					_rank: 1,
					_id: 1,
				},
			}
		),
	])

	if (!playlist)
		throw new Meteor.Error(404, `RundownPlaylist "${rundown.playlistId}"  (for Rundown "${rundown._id}") not found`)

	const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances(rundowns.map((r) => r._id))

	const playoutInfo: IngestPlayoutInfo = {
		playlist,
		rundowns,
		currentPartInstance,
		nextPartInstance,
	}
	return playoutInfo
}

export function rundownIngestSyncFromStudioFunction<T>(
	context: string,
	studioId: StudioId,
	rundownExternalId: string,
	calcFcn: (cache: ReadOnlyCache<CacheForIngest>, ingestCache: RundownIngestDataCacheCollection) => T,
	saveFcn: ((cache: CacheForIngest, playoutInfo: IngestPlayoutInfo, data: T) => void) | null,
	options?: { skipPlaylistLock?: boolean }
): void {
	return syncFunction(
		() => {
			const ingestObjCache = new DbCacheWriteCollection<IngestDataCacheObj, IngestDataCacheObj>(IngestDataCache)
			const [cache] = waitForPromiseAll([
				CacheForIngest.create(studioId, rundownExternalId),
				makePromise(() =>
					ingestObjCache.prepareInit({ rundownId: getRundownId(studioId, rundownExternalId) }, true)
				),
			])

			let saveIngestChanges: Promise<any> | undefined

			try {
				const val = calcFcn(cache, ingestObjCache)

				// Start saving the ingest data
				saveIngestChanges = ingestObjCache.updateDatabaseWithData()

				const rundown = getRundown2(cache)

				function doPlaylistInner() {
					if (saveFcn) {
						const playoutInfo = getIngestPlaylistInfoFromDb(rundown)

						saveFcn(cache, playoutInfo, val)
					}

					// TODO-CACHE - does this need to be inside the sync-function if there was no save step, as it cant touch anything playlisty?
					waitForPromise(cache.saveAllToDatabase())
				}

				if (options?.skipPlaylistLock) {
					doPlaylistInner()
				} else {
					rundownPlaylistCustomSyncFunction(
						context,
						rundown.playlistId,
						RundownSyncFunctionPriority.INGEST,
						doPlaylistInner
					)
				}
			} finally {
				// Ensure we save the ingest data
				waitForPromise(saveIngestChanges ?? ingestObjCache.updateDatabaseWithData())
			}
		},
		context,
		`rundown_ingest_${rundownExternalId}`
	)()
}

// export function rundownPlaylistIngestSaveSyncFunction<T>(
// 	ingestCache: CacheForIngest,
// 	fcn: (cache: CacheForIngest) => T
// ): T {
// 	return const rundown = getRundown2(cache)
// 	rundownPlaylistCustomSyncFunction(rundown.playlistId, RundownSyncFunctionPriority.INGEST, () => {
// 		if (saveFcn) {
// 			saveFcn(cache, cache)
// 		}

// 		waitForPromise(cache.saveAllToDatabase())
// 	})
// }

function updateDeviceLastDataReceived(deviceId: PeripheralDeviceId) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime(),
		},
	})
}

export function canBeUpdated(rundown: DeepReadonly<Rundown> | undefined, segment?: Segment, _partId?: PartId) {
	if (!rundown) return true
	if (rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	if (!segment) return true
	if (segment.unsynced) {
		logger.info(`Segment "${segment._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	// TODO
	return true
}
export function extendIngestRundownCore(
	ingestRundown: IngestRundown,
	existingDbRundown: DeepReadonly<DBRundown> | undefined
): ExtendedIngestRundown {
	const extendedIngestRundown: ExtendedIngestRundown = {
		...ingestRundown,
		coreData: unprotectObject(existingDbRundown),
	}
	return extendedIngestRundown
}
export function modifyPlaylistExternalId(playlistExternalId: string | undefined, showStyleBase: ShowStyleBase) {
	if (playlistExternalId) return `${showStyleBase._id}_${playlistExternalId}`
	else return undefined
}

export function getRundownSegmentsAndPartsFromIngestCache(
	cache: ReadOnlyCache<CacheForIngest>
): { segments: Segment[]; parts: Part[] } {
	const rundown = getRundown2(cache)

	const segments = RundownPlaylist._sortSegments(
		cache.Segments.findFetch(
			{},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		[rundown]
	)

	const parts = RundownPlaylist._sortPartsInner(
		cache.Parts.findFetch(
			{},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		segments
	)

	return {
		segments: segments,
		parts: parts,
	}
}
