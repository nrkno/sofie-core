import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import * as _ from 'underscore'
import { PeripheralDevice, PeripheralDeviceId, getExternalNRCSName } from '../../../lib/collections/PeripheralDevices'
import { Rundown, Rundowns, DBRundown } from '../../../lib/collections/Rundowns'
import { Part, DBPart, PartId } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import {
	saveIntoDb,
	getCurrentTime,
	literal,
	sumChanges,
	anythingChanged,
	waitForPromise,
	unprotectString,
	protectString,
	ProtectedString,
	getRandomId,
	PreparedChanges,
	unprotectObject,
	unprotectObjectArray,
	clone,
	normalizeArrayToMap,
} from '../../../lib/lib'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	BlueprintResultOrderedRundowns,
	BlueprintSyncIngestPartInstance,
	ShowStyleBlueprintManifest,
	BlueprintSyncIngestNewData,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { StudioId } from '../../../lib/collections/Studios'
import {
	selectShowStyleVariant,
	afterRemoveParts,
	ServerRundownAPI,
	removeSegments,
	updatePartInstanceRanks,
	RundownPlaylistAndOrder,
	allowedToMoveRundownOutOfPlaylist,
	produceRundownPlaylistInfoFromRundown,
	getAllRundownsInPlaylist,
	sortDefaultRundownInPlaylistOrder,
	ChangedSegmentsRankInfo,
	updatePartInstancesBasicProperties,
} from '../rundown'
import { loadShowStyleBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import {
	SyncIngestUpdateToPartInstanceContext,
	StudioUserContext,
	ShowStyleUserContext,
	CommonContext,
	SegmentUserContext,
	ShowStyleContext,
} from '../blueprints/context'
import { BlueprintId } from '../../../lib/collections/Blueprints'
import { RundownBaselineObj, RundownBaselineObjId } from '../../../lib/collections/RundownBaselineObjs'
import { Random } from 'meteor/random'
import {
	postProcessRundownBaselineItems,
	postProcessAdLibPieces,
	postProcessPieces,
	postProcessAdLibActions,
	postProcessGlobalAdLibActions,
} from '../blueprints/postProcess'
import { RundownBaselineAdLibItem } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { DBSegment, SegmentId } from '../../../lib/collections/Segments'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import {
	saveRundownCache,
	saveSegmentCache,
	loadCachedIngestSegment,
	loadCachedRundownData,
	LocalIngestRundown,
	LocalIngestSegment,
	makeNewIngestSegment,
	makeNewIngestPart,
	makeNewIngestRundown,
	isLocalIngestRundown,
	RundownIngestDataCacheCollection,
} from './ingestCache'
import {
	getRundownId,
	getSegmentId,
	getPartId,
	canBeUpdated,
	checkAccessAndGetPeripheralDevice,
	extendIngestRundownCore,
	modifyPlaylistExternalId,
	rundownIngestSyncFunction,
	getRundown2,
	IngestPlayoutInfo,
	getRundownSegmentsAndPartsFromIngestCache,
	getSegment2,
	getReadonlyIngestObjectCache,
} from './lib'
import { PackageInfo } from '../../coreSystem'
import { updateExpectedMediaItemsOnRundown } from '../expectedMediaItems'
import {
	rundownPlaylistPlayoutSyncFunction,
	rundownPlaylistPlayoutSyncFunctionInner,
	triggerUpdateTimelineAfterIngestData,
} from '../playout/playout'
import { PartNote, NoteType, SegmentNote, RundownNote } from '../../../lib/api/notes'
import { syncFunction } from '../../codeControl'
import { UpdateNext } from './updateNext'
import { updateExpectedPlayoutItemsOnRundown } from './expectedPlayoutItems'
import {
	RundownPlaylists,
	DBRundownPlaylist,
	RundownPlaylist,
	RundownPlaylistId,
} from '../../../lib/collections/RundownPlaylists'
import { getSelectedPartInstancesFromCache, isTooCloseToAutonext } from '../playout/lib'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { MethodContext } from '../../../lib/api/methods'
import { CacheForStudio, CacheForIngest, ReadOnlyCache, CacheForPlayout } from '../../cache/DatabaseCaches'
import { prepareSaveIntoCache, savePreparedChangesIntoCache, saveIntoCache } from '../../cache/lib'
import { reportRundownDataHasChanged } from '../asRunLog'
import { Settings } from '../../../lib/Settings'
import { AdLibAction } from '../../../lib/collections/AdLibActions'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { removeEmptyPlaylists } from '../rundownPlaylist'
import { ReadonlyDeep } from 'type-fest'
import { ShowStyleCompound, getShowStyleCompound2 } from '../../../lib/collections/ShowStyleVariants'
import { profiler } from '../profiler'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites'
import { IngestDataCache } from '../../../lib/collections/IngestDataCache'

/** Priority for handling of synchronous events. Higher value means higher priority */
export enum RundownSyncFunctionPriority {
	/** Events initiated from external (ingest) devices */
	INGEST = 0,
	/** */
	AS_RUN_EVENT = 5,
	/** Events initiated from user, for triggering ingest actions */
	USER_INGEST = 9,
	/** Events initiated from user, for playout */
	USER_PLAYOUT = 10,
	/** Events initiated from playout-gateway callbacks */
	CALLBACK_PLAYOUT = 20,
}

export function rundownPlaylistNoCacheSyncFunction<T>(
	context: string,
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	fcn: () => T
): T {
	return syncFunction(fcn, context, `rundown_playlist_${rundownPlaylistId}`, undefined, priority)()
}

export function studioSyncFunction<T>(context: string, studioId: StudioId, fcn: (cache: CacheForStudio) => T): T {
	return syncFunction(
		() => {
			const cache = waitForPromise(CacheForStudio.create(studioId))

			const res = fcn(cache)

			waitForPromise(cache.saveAllToDatabase())

			return res
		},
		context,
		`studio_${studioId}`
	)()
}

interface SegmentChanges {
	segmentId: SegmentId
	segment: PreparedChanges<DBSegment>
	parts: PreparedChanges<DBPart>
	pieces: PreparedChanges<Piece>
	adlibPieces: PreparedChanges<AdLibPiece>
	adlibActions: PreparedChanges<AdLibAction>
}

export namespace RundownInput {
	// Get info on the current rundowns from this device:
	export function dataRundownList(context: MethodContext, deviceId: PeripheralDeviceId, deviceToken: string) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownList')
		const rundowns = Rundowns.find({
			peripheralDeviceId: peripheralDevice._id,
		}).fetch()

		return rundowns.map((r) => r.externalId)
	}
	export function dataRundownGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownGet', rundownExternalId)
		check(rundownExternalId, String)

		const rundown = Rundowns.findOne({
			peripheralDeviceId: peripheralDevice._id,
			externalId: rundownExternalId,
		})
		if (!rundown) {
			throw new Meteor.Error(404, `Rundown ${rundownExternalId} does not exist`)
		}

		const ingestDataCache = waitForPromise(getReadonlyIngestObjectCache(rundown._id))
		return loadCachedRundownData(ingestDataCache, rundown._id, rundown.externalId)
	}
	// Delete, Create & Update Rundown (and it's contents):
	export function dataRundownDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownDelete', rundownExternalId)
		check(rundownExternalId, String)
		handleRemovedRundown(peripheralDevice, rundownExternalId)
	}
	export function dataRundownCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: IngestRundown
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownCreate', ingestRundown)
		check(ingestRundown, Object)
		handleUpdatedRundown(peripheralDevice, ingestRundown, 'dataRundownCreate')
	}
	export function dataRundownUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: IngestRundown
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownUpdate', ingestRundown)
		check(ingestRundown, Object)
		handleUpdatedRundown(peripheralDevice, ingestRundown, 'dataRundownUpdate')
	}
	export function dataSegmentGet(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentGet', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)

		const rundown = Rundowns.findOne({
			peripheralDeviceId: peripheralDevice._id,
			externalId: rundownExternalId,
		})
		if (!rundown) {
			throw new Meteor.Error(404, `Rundown ${rundownExternalId} does not exist`)
		}

		const segmentId = getSegmentId(rundown._id, segmentExternalId)

		const ingestDataCache = waitForPromise(getReadonlyIngestObjectCache(rundown._id))
		return loadCachedIngestSegment(ingestDataCache, rundown.externalId, segmentId, segmentExternalId)
	}
	// Delete, Create & Update Segment (and it's contents):
	export function dataSegmentDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentDelete', rundownExternalId, segmentExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		handleRemovedSegment(peripheralDevice, rundownExternalId, segmentExternalId)
	}
	export function dataSegmentCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentCreate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment)
	}
	export function dataSegmentUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataSegmentUpdate', rundownExternalId, ingestSegment)
		check(rundownExternalId, String)
		check(ingestSegment, Object)
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment)
	}
	// Delete, Create & Update Part:
	export function dataPartDelete(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartDelete', rundownExternalId, segmentExternalId, partExternalId)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(partExternalId, String)
		handleRemovedPart(peripheralDevice, rundownExternalId, segmentExternalId, partExternalId)
	}
	export function dataPartCreate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartCreate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
	export function dataPartUpdate(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataPartUpdate', rundownExternalId, segmentExternalId, ingestPart)
		check(rundownExternalId, String)
		check(segmentExternalId, String)
		check(ingestPart, Object)
		handleUpdatedPart(peripheralDevice, rundownExternalId, segmentExternalId, ingestPart)
	}
}

export function handleRemovedRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string) {
	const span = profiler.startSpan('rundownInput.handleRemovedRundown')
	rundownIngestSyncFunction(
		'handleRemovedRundown',
		peripheralDevice,
		rundownExternalId,
		() => {
			// Nothing to verify/pre-computs
		},
		(cache, playoutInfo) => {
			const rundown = getRundown2(cache)

			if (canBeUpdated(rundown)) {
				let okToRemove: boolean = true
				if (!isUpdateAllowed(playoutInfo, rundown, { removed: [rundown] }, {}, {})) {
					const { currentPartInstance, nextPartInstance } = playoutInfo

					if (
						(currentPartInstance && currentPartInstance.rundownId === rundown._id) ||
						(isTooCloseToAutonext(currentPartInstance) &&
							nextPartInstance &&
							nextPartInstance.rundownId === rundown._id)
					) {
						okToRemove = false
					}
					if (!currentPartInstance && nextPartInstance) {
						// The playlist is active, but hasn't started playing yet
						if (nextPartInstance.rundownId === rundown._id) {
							okToRemove = false
						}
					}
				}
				if (okToRemove) {
					logger.info(`Removing rundown "${rundown._id}"`)
					cache.removeRundown()
				} else {
					// Don't allow removing currently playing rundown playlists:
					logger.warn(
						`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
					)
					ServerRundownAPI.unsyncRundownInner(cache)
				}
			} else {
				logger.info(`Rundown "${rundown._id}" cannot be updated`)
				if (!rundown.unsynced) {
					ServerRundownAPI.unsyncRundownInner(cache)
				}
			}
		}
	)
	span?.end()
}
/** Handle an updated (or inserted) Rundown */
export function handleUpdatedRundown(
	peripheralDevice: PeripheralDevice,
	ingestRundown: IngestRundown,
	dataSource: string
) {
	return rundownIngestSyncFunction(
		'handleUpdatedRundown',
		peripheralDevice,
		ingestRundown.externalId,
		(cache, ingestDataCache) => {
			return prepareUpdateRundownInner(
				cache,
				ingestDataCache,
				makeNewIngestRundown(ingestRundown),
				undefined,
				dataSource,
				peripheralDevice
			)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				savePreparedRundownChanges(cache, playoutInfo, preparedChanges)
			}
		}
	)
}
export function prepareUpdateRundownInner(
	cache: ReadOnlyCache<CacheForIngest>,
	ingestDataCache: RundownIngestDataCacheCollection,
	ingestRundown: IngestRundown | LocalIngestRundown,
	pendingRundownChanges: Partial<DBRundown> | undefined,
	dataSource?: string,
	peripheralDevice?: PeripheralDevice
): PreparedRundownChanges | undefined {
	const existingDbRundown = cache.Rundown.doc
	if (!canBeUpdated(existingDbRundown)) return undefined

	const rundownId = cache.Rundown.doc?._id ?? getRundownId(cache.Studio.doc, ingestRundown.externalId)

	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	const newIngestRundown = isLocalIngestRundown(ingestRundown) ? ingestRundown : makeNewIngestRundown(ingestRundown)

	saveRundownCache(ingestDataCache, rundownId, newIngestRundown)

	return updateRundownFromIngestData(cache, newIngestRundown, pendingRundownChanges, dataSource, peripheralDevice)
}
function updateRundownFromIngestData(
	cache: ReadOnlyCache<CacheForIngest>,
	ingestRundown: IngestRundown,
	pendingRundownChanges: Partial<DBRundown> | undefined,
	dataSource?: string,
	peripheralDevice?: PeripheralDevice
): PreparedRundownChanges {
	const span = profiler.startSpan('ingest.rundownInput.updateRundownFromIngestData')

	const studio = cache.Studio.doc
	const extendedIngestRundown = extendIngestRundownCore(
		ingestRundown,
		cache.Rundown.doc
			? {
					...cache.Rundown.doc,
					...pendingRundownChanges,
			  }
			: undefined
	)
	const rundownId = getRundownId(studio, ingestRundown.externalId)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${studio._id},rundownId=${rundownId},ingestRundownId=${ingestRundown.externalId}`,
			tempSendUserNotesIntoBlackHole: true,
		},
		studio
	)
	// TODO-CONTEXT save any user notes from selectShowStyleContext
	const showStyle = selectShowStyleVariant(selectShowStyleContext, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		span?.end()
		throw new Meteor.Error(501, 'Blueprint rejected the rundown')
	}

	// We will be updating the baseline, so start it loading
	const pBaseline = cache.loadBaselineCollections()

	const showStyleBlueprint = loadShowStyleBlueprint(showStyle.base)
	const blueprintContext = new ShowStyleUserContext(
		{
			name: `${showStyle.base.name}-${showStyle.variant.name}`,
			identifier: `showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		},
		studio,
		showStyle.compound
	)
	const rundownRes = showStyleBlueprint.blueprint.getRundown(blueprintContext, extendedIngestRundown)

	const translationNamespaces: string[] = []
	if (showStyleBlueprint.blueprint.blueprintId) {
		translationNamespaces.push(showStyleBlueprint.blueprint.blueprintId)
	}
	if (studio.blueprintId) {
		translationNamespaces.push(unprotectString(studio.blueprintId))
	}

	// Ensure the ids in the notes are clean
	const rundownNotes = _.map(blueprintContext.notes, (note) =>
		literal<RundownNote>({
			type: note.type,
			message: {
				...note.message,
				namespaces: translationNamespaces,
			},
			origin: {
				name: `${showStyle.base.name}-${showStyle.variant.name}`,
			},
		})
	)
	rundownRes.rundown.playlistExternalId = modifyPlaylistExternalId(
		rundownRes.rundown.playlistExternalId,
		showStyle.base
	)

	const dbRundown: DBRundown = {
		// Some defaults to be overridden
		peripheralDeviceId: protectString(''),
		externalNRCSName: getExternalNRCSName(undefined),
		created: getCurrentTime(),
		_rank: 0, // set later, in produceRundownPlaylistInfo
		playlistId: protectString(''), // set later, in produceRundownPlaylistInfo

		// Persist old values in some old bits
		...clone(cache.Rundown.doc),

		...pendingRundownChanges,

		// All the new stuff
		...rundownRes.rundown,
		notes: rundownNotes,
		_id: rundownId,
		externalId: ingestRundown.externalId,
		organizationId: studio.organizationId,
		studioId: studio._id,
		showStyleVariantId: showStyle.variant._id,
		showStyleBaseId: showStyle.base._id,
		unsynced: false,

		importVersions: {
			studio: studio._rundownVersionHash,
			showStyleBase: showStyle.base._rundownVersionHash,
			showStyleVariant: showStyle.variant._rundownVersionHash,
			blueprint: showStyleBlueprint.blueprint.blueprintVersion,
			core: PackageInfo.versionExtended || PackageInfo.version,
		},

		dataSource: dataSource ?? cache.Rundown.doc?.dataSource ?? '',
		modified: getCurrentTime(),
	}
	if (peripheralDevice) {
		dbRundown.peripheralDeviceId = peripheralDevice._id
		dbRundown.externalNRCSName = getExternalNRCSName(peripheralDevice)
	}

	// Do a check if we're allowed to move out of currently playing playlist:
	if (cache.Rundown.doc && cache.Rundown.doc.playlistExternalId !== dbRundown.playlistExternalId) {
		// The rundown is going to change playlist
		const existingPlaylist = RundownPlaylists.findOne(cache.Rundown.doc.playlistId)
		if (existingPlaylist) {
			if (!allowedToMoveRundownOutOfPlaylist(existingPlaylist, cache.Rundown.doc)) {
				// The rundown contains a PartInstance that is currently on air.
				// We're trying for a "soft approach" here, instead of rejecting the change altogether,
				// and will just revert the playlist change:

				dbRundown.playlistExternalId = cache.Rundown.doc.playlistExternalId
				dbRundown.playlistId = cache.Rundown.doc.playlistId

				if (!dbRundown.notes) dbRundown.notes = []
				dbRundown.notes.push({
					type: NoteType.WARNING,
					message: {
						key:
							'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.',
					},
					origin: {
						name: 'Data update',
					},
				})

				logger.warn(
					`Blocking moving rundown "${cache.Rundown.doc._id}" out of playlist "${cache.Rundown.doc.playlistId}"`
				)
			}
		} else {
			logger.warn(`Existing playlist "${cache.Rundown.doc.playlistId}" not found`)
		}
	}

	const rundownPlaylistInfo = produceRundownPlaylistInfoFromRundown(cache.Studio.doc, dbRundown, peripheralDevice)
	dbRundown.playlistId = rundownPlaylistInfo.rundownPlaylist._id

	// Save the baseline
	const blueprintRundownContext = new CommonContext({
		name: dbRundown.name,
		identifier: `rundownId=${dbRundown._id}`,
	})
	logger.info(`Building baseline objects for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.length} objects from baseline.`)

	const baselineObj: RundownBaselineObj = {
		_id: protectString<RundownBaselineObjId>(Random.id(7)),
		rundownId: dbRundown._id,
		objects: postProcessRundownBaselineItems(
			blueprintRundownContext,
			showStyle.base.blueprintId,
			rundownRes.baseline
		),
	}
	// Save the global adlibs
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib objects from baseline.`)
	const baselineAdlibPieces = postProcessAdLibPieces(
		blueprintRundownContext,
		showStyle.base.blueprintId,
		rundownId,
		undefined,
		rundownRes.globalAdLibPieces
	)
	logger.info(`... got ${(rundownRes.globalActions || []).length} adLib actions from baseline.`)
	const baselineAdlibActions = postProcessGlobalAdLibActions(
		blueprintRundownContext,
		showStyle.base.blueprintId,
		rundownId,
		rundownRes.globalActions || []
	)

	// TODO - store notes from rundownNotesContext

	const segmentsAndParts = getRundownSegmentsAndPartsFromIngestCache(cache)
	const existingRundownParts = _.groupBy(segmentsAndParts.parts, (part) => part.segmentId)
	const existingSegments = normalizeArrayToMap(segmentsAndParts.segments, '_id')

	const segments: DBSegment[] = []
	const parts: DBPart[] = []
	const segmentPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []
	const adlibActions: AdLibAction[] = []

	_.each(ingestRundown.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = existingSegments.get(segmentId)
		const existingParts = existingRundownParts[unprotectString(segmentId)] || []

		ingestSegment.parts = _.sortBy(ingestSegment.parts, (part) => part.rank)

		const segmentContents = generateSegmentContents(
			cache,
			showStyle.compound,
			showStyleBlueprint,
			dbRundown,
			ingestSegment,
			existingSegment,
			existingParts
		)

		segments.push(segmentContents.newSegment)
		parts.push(...segmentContents.parts)
		segmentPieces.push(...segmentContents.segmentPieces)
		adlibPieces.push(...segmentContents.adlibPieces)
		adlibActions.push(...segmentContents.adlibActions)
	})

	// Prepare updates:
	const res = literal<PreparedRundownChanges>({
		rundownPlaylistInfo,
		dbRundown,

		segments: prepareSaveIntoCache(cache.Segments, {}, segments),
		parts: prepareSaveIntoCache(cache.Parts, {}, parts),
		pieces: prepareSaveIntoCache(cache.Pieces, {}, segmentPieces),
		adlibPieces: prepareSaveIntoCache(cache.AdLibPieces, {}, adlibPieces),
		adlibActions: prepareSaveIntoCache(cache.AdLibActions, {}, adlibActions),

		baselineObj,
		baselineAdlibPieces,
		baselineAdlibActions,
	})

	waitForPromise(pBaseline)

	span?.end()
	return res
}

export interface PreparedRundownChanges {
	rundownPlaylistInfo: RundownPlaylistAndOrder
	dbRundown: DBRundown

	segments: PreparedChanges<DBSegment>
	parts: PreparedChanges<DBPart>
	pieces: PreparedChanges<Piece>
	adlibPieces: PreparedChanges<AdLibPiece>
	adlibActions: PreparedChanges<AdLibAction>

	baselineObj: RundownBaselineObj
	baselineAdlibPieces: RundownBaselineAdLibItem[]
	baselineAdlibActions: RundownBaselineAdLibAction[]
}

export function savePreparedRundownChanges(
	cache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo,
	preparedChanges: PreparedRundownChanges
): boolean {
	const span = profiler.startSpan('ingest.rundownInput.savePreparedRundownChanges')

	// TODO-CACHE - is thhis playlist update safe? Note: new/updated Rundown is not in the db yet
	const playlistChanges = saveIntoDb(
		RundownPlaylists,
		{
			_id: preparedChanges.rundownPlaylistInfo.rundownPlaylist._id,
		},
		[preparedChanges.rundownPlaylistInfo.rundownPlaylist],
		{
			beforeInsert: (o) => {
				o.created = getCurrentTime()
				o.modified = getCurrentTime()
				o.previousPartInstanceId = null
				o.currentPartInstanceId = null
				o.nextPartInstanceId = null
				return o
			},
			beforeUpdate: (o) => {
				o.modified = getCurrentTime()
				return o
			},
		}
	)

	handleUpdatedRundownPlaylist(
		preparedChanges.dbRundown,
		preparedChanges.rundownPlaylistInfo.rundownPlaylist,
		preparedChanges.rundownPlaylistInfo.order
	)

	cache.deferAfterSave(() => {
		const studioId = cache.Studio.doc._id
		Meteor.defer(() => {
			// It needs to lock every playlist, and we are already inside one of the locks it needs
			removeEmptyPlaylists(studioId)
		})
	})

	const dbRundown = cache.Rundown.replace(preparedChanges.dbRundown)

	const dbPlaylist = dbRundown.getRundownPlaylist()
	if (!dbPlaylist) {
		span?.end()
		throw new Meteor.Error(500, 'RundownPlaylist not found (it should have been)')
	}

	const rundownChanges = {
		added: cache.Rundown.doc ? 0 : 1,
		updated: cache.Rundown.doc ? 1 : 0,
		removed: 0,
	}

	if (Settings.allowUnsyncedSegments) {
		if (!isUpdateAllowed(playoutInfo, dbRundown, { changed: [dbRundown] })) {
			ServerRundownAPI.unsyncRundownInner(cache)
			waitForPromise(cache.saveAllToDatabase())

			span?.end()
			return false
		} else {
			const segmentChanges: SegmentChanges[] = splitIntoSegments(
				preparedChanges.segments,
				preparedChanges.parts,
				preparedChanges.pieces,
				preparedChanges.adlibPieces,
				preparedChanges.adlibActions
			)
			const approvedSegmentChanges: SegmentChanges[] = []
			_.each(segmentChanges, (segmentChange) => {
				if (
					isUpdateAllowed(
						playoutInfo,
						dbRundown,
						{ changed: [dbRundown] },
						segmentChange.segment,
						segmentChange.parts
					)
				) {
					approvedSegmentChanges.push(segmentChange)
				} else {
					ServerRundownAPI.unsyncSegmentInner(cache, segmentChange.segmentId)
				}
			})

			preparedChanges.segments = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			preparedChanges.parts = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			preparedChanges.pieces = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			preparedChanges.adlibPieces = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			preparedChanges.adlibActions = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			approvedSegmentChanges.forEach((segmentChange) => {
				for (const key in preparedChanges.segments) {
					preparedChanges.segments[key].push(...segmentChange.segment[key])
					preparedChanges.parts[key].push(...segmentChange.parts[key])
					preparedChanges.pieces[key].push(...segmentChange.pieces[key])
					preparedChanges.adlibPieces[key].push(...segmentChange.adlibPieces[key])
					preparedChanges.adlibActions[key].push(...segmentChange.adlibActions[key])
				}
			})
		}
	} else {
		// determine if update is allowed here
		if (
			!isUpdateAllowed(
				playoutInfo,
				dbRundown,
				{ changed: [dbRundown] },
				preparedChanges.segments,
				preparedChanges.parts
			)
		) {
			ServerRundownAPI.unsyncRundownInner(cache)
			waitForPromise(cache.saveAllToDatabase())

			span?.end()
			return false
		}
	}

	const rundownBaselineChanges = sumChanges(
		saveIntoCache<RundownBaselineObj, RundownBaselineObj>(
			cache.RundownBaselineObjs,
			{
				rundownId: dbRundown._id,
			},
			[preparedChanges.baselineObj]
		),
		// Save the global adlibs
		saveIntoCache<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(
			cache.RundownBaselineAdLibPieces,
			{
				rundownId: dbRundown._id,
			},
			preparedChanges.baselineAdlibPieces
		),
		saveIntoCache<RundownBaselineAdLibAction, RundownBaselineAdLibAction>(
			cache.RundownBaselineAdLibActions,
			{
				rundownId: dbRundown._id,
			},
			preparedChanges.baselineAdlibActions
		)
	)
	if (anythingChanged(rundownBaselineChanges)) {
		// If any of the rundown baseline datas was modified, we'll update the baselineModifyHash of the rundown
		cache.Rundown.update({
			$set: {
				baselineModifyHash: unprotectString(getRandomId()),
			},
		})
	}

	const allChanges = sumChanges(
		rundownChanges,
		playlistChanges,
		rundownBaselineChanges,

		// These are done in this order to ensure that the afterRemoveAll don't delete anything that was simply moved

		savePreparedChangesIntoCache<Piece, Piece>(preparedChanges.pieces, cache.Pieces, {
			afterInsert(piece) {
				logger.debug('inserted piece ' + piece._id)
				logger.debug(piece)
			},
			afterUpdate(piece) {
				logger.debug('updated piece ' + piece._id)
			},
			afterRemove(piece) {
				logger.debug('deleted piece ' + piece._id)
			},
		}),

		savePreparedChangesIntoCache<AdLibAction, AdLibAction>(preparedChanges.adlibActions, cache.AdLibActions, {
			afterInsert(adlibAction) {
				logger.debug('inserted adlibAction ' + adlibAction._id)
				logger.debug(adlibAction)
			},
			afterUpdate(adlibAction) {
				logger.debug('updated adlibAction ' + adlibAction._id)
			},
			afterRemove(adlibAction) {
				logger.debug('deleted adlibAction ' + adlibAction._id)
			},
		}),
		savePreparedChangesIntoCache<AdLibPiece, AdLibPiece>(preparedChanges.adlibPieces, cache.AdLibPieces, {
			afterInsert(adLibPiece) {
				logger.debug('inserted adLibPiece ' + adLibPiece._id)
				logger.debug(adLibPiece)
			},
			afterUpdate(adLibPiece) {
				logger.debug('updated adLibPiece ' + adLibPiece._id)
			},
			afterRemove(adLibPiece) {
				logger.debug('deleted adLibPiece ' + adLibPiece._id)
			},
		}),
		savePreparedChangesIntoCache<Part, DBPart>(preparedChanges.parts, cache.Parts, {
			afterInsert(part) {
				logger.debug('inserted part ' + part._id)
			},
			afterUpdate(part) {
				logger.debug('updated part ' + part._id)
			},
			afterRemove(part) {
				logger.debug('deleted part ' + part._id)
			},
			afterRemoveAll(parts) {
				afterRemoveParts(
					cache,
					parts.map((p) => p._id)
				)
			},
		}),

		// Update Segments:
		savePreparedChangesIntoCache(preparedChanges.segments, cache.Segments, {
			afterInsert(segment) {
				logger.info('inserted segment ' + segment._id)
			},
			afterUpdate(segment) {
				logger.info('updated segment ' + segment._id)
			},
			afterRemove(segment) {
				logger.info('removed segment ' + segment._id)
			},
		})
	)

	const didChange = anythingChanged(allChanges)
	if (didChange) {
		const segments = [...preparedChanges.segments.changed, ...preparedChanges.segments.inserted]
		afterIngestChangedData(
			cache,
			playoutInfo,
			segments.map((s) => ({
				segmentId: s._id,
				oldPartIdsAndRanks: (existingRundownParts[unprotectString(s._id)] || []).map((p) => ({
					id: p._id,
					rank: p._rank,
				})),
			}))
		)

		reportRundownDataHasChanged(cache, dbPlaylist)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return didChange
}

/** Set _rank and playlistId of rundowns in a playlist */
export function updateRundownsInPlaylist(
	playlist: DBRundownPlaylist,
	rundownRanks: BlueprintResultOrderedRundowns,
	currentRundown?: DBRundown
) {
	// TODO - locking
	const { rundowns, selector } = getAllRundownsInPlaylist(playlist._id, playlist.externalId)

	let maxRank: number = Number.NEGATIVE_INFINITY
	let currentRundownUpdated: DBRundown | undefined
	rundowns.forEach((rundown) => {
		rundown.playlistId = playlist._id

		if (!playlist.rundownRanksAreSetInSofie) {
			const rundownRank = rundownRanks[unprotectString(rundown._id)]
			if (rundownRank !== undefined) {
				rundown._rank = rundownRank
			}
		}
		if (!_.isNaN(Number(rundown._rank))) {
			maxRank = Math.max(maxRank, rundown._rank)
		}
		if (currentRundown && rundown._id === currentRundown._id) currentRundownUpdated = rundown
		return rundown
	})
	if (playlist.rundownRanksAreSetInSofie) {
		// Place new rundowns at the end:

		const unrankedRundowns = sortDefaultRundownInPlaylistOrder(rundowns.filter((r) => r._rank === undefined))

		unrankedRundowns.forEach((rundown) => {
			if (rundown._rank === undefined) {
				rundown._rank = ++maxRank
			}
		})
	}
	if (currentRundown && !currentRundownUpdated) {
		throw new Meteor.Error(
			500,
			`updateRundownsInPlaylist: Rundown "${currentRundown._id}" is not a part of rundowns`
		)
	}
	if (currentRundown && currentRundownUpdated) {
		// Apply to in-memory copy:
		currentRundown.playlistId = currentRundownUpdated.playlistId
		currentRundown._rank = currentRundownUpdated._rank
	}

	saveIntoDb(Rundowns, selector, rundowns)
}

export function handleRemovedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string
) {
	return rundownIngestSyncFunction(
		'handleRemovedSegment',
		peripheralDevice,
		rundownExternalId,
		() => {
			// Nothing to precompute
		},
		(cache, playoutInfo) => {
			const rundown = getRundown2(cache)
			const segmentId = getSegmentId(rundown._id, segmentExternalId)
			const segment = cache.Segments.findOne(segmentId)
			if (!segment) throw new Meteor.Error(404, `handleRemovedSegment: Segment "${segmentId}" not found`)

			if (canBeUpdated(rundown, segment)) {
				if (!isUpdateAllowed(playoutInfo, rundown, {}, { removed: [segment] }, {})) {
					unsyncSegmentOrRundown(cache, segmentId)
				} else {
					if (removeSegments(cache, [segmentId]) === 0) {
						throw new Meteor.Error(
							404,
							`handleRemovedSegment: removeSegments: Segment ${segmentExternalId} not found`
						)
					} else {
						UpdateNext.ensureNextPartIsValid(cache, playoutInfo)
					}
				}

				cache.defer(() => {
					IngestDataCache.remove({
						segmentId: segmentId,
						rundownId: rundown._id,
					})
				})
			}
		}
	)
}
export function handleUpdatedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	ingestSegment: IngestSegment
) {
	const span = profiler.startSpan('ingest.rundownInput.updateSegmentFromIngestData')
	rundownIngestSyncFunction(
		'handleUpdatedSegment',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
			const segment = cache.Segments.findOne(segmentId) // Note: undefined is valid here, as it means this is a new segment
			// Nothing to precompute
			if (!canBeUpdated(rundown, segment)) return

			saveSegmentCache(ingestDataCache, rundown._id, segmentId, makeNewIngestSegment(ingestSegment))

			const showStyle = getShowStyleCompound2(rundown)
			const blueprint = loadShowStyleBlueprint(showStyle)
			return prepareUpdateSegmentFromIngestData(cache, showStyle, blueprint, ingestSegment)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = savePreparedSegmentChanges(
					cache,
					playoutInfo,
					preparedChanges
				)
				if (updatedSegmentId) {
					afterIngestChangedData(cache, playoutInfo, [{ segmentId: updatedSegmentId, oldPartIdsAndRanks }])
				}
			}
		}
	)
	span?.end()
}
/**
 * Run ingestData through blueprints and update the Segment
 * @param cache
 * @param ingestSegment
 * @returns a segmentId if data has changed, null otherwise
 */
export function prepareUpdateSegmentFromIngestData(
	cache: ReadOnlyCache<CacheForIngest>,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	wrappedBlueprint: WrappedShowStyleBlueprint,
	ingestSegment: IngestSegment
): PreparedSegmentChanges {
	const span = profiler.startSpan('ingest.rundownInput.prepareUpdateSegmentFromIngestData')
	const rundown = getRundown2(cache)

	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)

	const existingSegment = cache.Segments.findOne(segmentId)
	// The segment may not yet exist (if it had its id changed), so we need to fetch the old ones manually
	const existingParts = cache.Parts.findFetch({
		segmentId: segmentId,
	})

	ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)

	const { parts, segmentPieces, adlibPieces, adlibActions, newSegment } = generateSegmentContents(
		cache,
		showStyle,
		wrappedBlueprint,
		rundown,
		ingestSegment,
		existingSegment,
		existingParts
	)

	const changes = literal<PreparedSegmentChanges>({
		segmentId,
		segment: newSegment,
		parts,
		pieces: segmentPieces,
		adlibPieces,
		adlibActions,
	})

	span?.end()
	return changes
}

export interface PreparedSegmentChanges {
	segmentId: SegmentId
	segment: DBSegment
	parts: DBPart[]
	pieces: Piece[]
	adlibPieces: AdLibPiece[]
	adlibActions: AdLibAction[]
}

export function savePreparedSegmentChanges(
	cache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo,
	preparedChanges: PreparedSegmentChanges
): {
	segmentId: SegmentId | null
	oldPartIdsAndRanks: Array<{ id: PartId; rank: number }>
} {
	const span = profiler.startSpan('ingest.rundownInput.savePreparedSegmentChanges')
	const rundown = getRundown2(cache)

	const partIds = preparedChanges.parts.map((p) => p._id)
	const prepareSaveParts = prepareSaveIntoCache<Part, DBPart>(
		cache.Parts,
		{
			$or: [
				{
					// The parts in this Segment:
					segmentId: preparedChanges.segmentId,
				},
				{
					// Move over parts from other segments
					_id: { $in: partIds },
				},
			],
		},
		preparedChanges.parts
	)
	const prepareSavePieces = prepareSaveIntoCache<Piece, Piece>(
		cache.Pieces,
		{
			startPartId: { $in: partIds },
		},
		preparedChanges.pieces
	)
	const prepareSaveAdlibPieces = prepareSaveIntoCache<AdLibPiece, AdLibPiece>(
		cache.AdLibPieces,
		{
			partId: { $in: partIds },
		},
		preparedChanges.adlibPieces
	)
	const prepareSaveAdlibActions = prepareSaveIntoCache<AdLibAction, AdLibAction>(
		cache.AdLibActions,
		{
			partId: { $in: partIds },
		},
		preparedChanges.adlibActions
	)

	// determine if update is allowed here
	if (!isUpdateAllowed(playoutInfo, rundown, {}, { changed: [preparedChanges.segment] }, prepareSaveParts)) {
		unsyncSegmentOrRundown(cache, preparedChanges.segmentId)
		return { segmentId: null, oldPartIdsAndRanks: [] }
	}

	// Update segment info:
	cache.Segments.upsert(preparedChanges.segmentId, preparedChanges.segment)

	const changes = sumChanges(
		// These are done in this order to ensure that the afterRemoveAll don't delete anything that was simply moved

		savePreparedChangesIntoCache<Piece, Piece>(prepareSavePieces, cache.Pieces, {
			afterInsert(piece) {
				logger.debug('inserted piece ' + piece._id)
				logger.debug(piece)
			},
			afterUpdate(piece) {
				logger.debug('updated piece ' + piece._id)
			},
			afterRemove(piece) {
				logger.debug('deleted piece ' + piece._id)
			},
		}),
		savePreparedChangesIntoCache<AdLibPiece, AdLibPiece>(prepareSaveAdlibPieces, cache.AdLibPieces, {
			afterInsert(adLibPiece) {
				logger.debug('inserted adLibPiece ' + adLibPiece._id)
				logger.debug(adLibPiece)
			},
			afterUpdate(adLibPiece) {
				logger.debug('updated adLibPiece ' + adLibPiece._id)
			},
			afterRemove(adLibPiece) {
				logger.debug('deleted adLibPiece ' + adLibPiece._id)
			},
		}),
		savePreparedChangesIntoCache<AdLibAction, AdLibAction>(prepareSaveAdlibActions, cache.AdLibActions, {
			afterInsert(adLibAction) {
				logger.debug('inserted adLibAction ' + adLibAction._id)
				logger.debug(adLibAction)
			},
			afterUpdate(adLibAction) {
				logger.debug('updated adLibAction ' + adLibAction._id)
			},
			afterRemove(adLibAction) {
				logger.debug('deleted adLibAction ' + adLibAction._id)
			},
		}),
		savePreparedChangesIntoCache<Part, DBPart>(prepareSaveParts, cache.Parts, {
			afterInsert(part) {
				logger.debug('inserted part ' + part._id)
			},
			afterUpdate(part) {
				logger.debug('updated part ' + part._id)
			},
			afterRemove(part) {
				logger.debug('deleted part ' + part._id)
			},
			afterRemoveAll(parts) {
				afterRemoveParts(
					cache,
					parts.map((p) => p._id)
				)
			},
		})
	)

	const oldPartIdsAndRanks = existingParts.map((p) => ({ id: p._id, rank: p._rank }))
	span?.end()
	return { segmentId: anythingChanged(changes) ? preparedChanges.segmentId : null, oldPartIdsAndRanks }
}
function syncChangesToPartInstances(
	cache: CacheForPlayout,
	blueprint: ShowStyleBlueprintManifest,
	ingestCache: ReadOnlyCache<CacheForIngest>
) {
	const rundown = ingestCache.Rundown.doc
	if (cache.Playlist.doc.activationId && rundown) {
		if (blueprint.syncIngestUpdateToPartInstance) {
			const { previousPartInstance, currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(
				cache
			)
			const instances: {
				existingPartInstance: PartInstance
				previousPartInstance: PartInstance | undefined
				playStatus: 'current' | 'next'
			}[] = []
			if (currentPartInstance)
				instances.push({
					existingPartInstance: currentPartInstance,
					previousPartInstance: previousPartInstance,
					playStatus: 'current',
				})
			if (nextPartInstance)
				instances.push({
					existingPartInstance: nextPartInstance,
					previousPartInstance: currentPartInstance,
					playStatus: isTooCloseToAutonext(currentPartInstance, false) ? 'current' : 'next',
				})

			for (const { existingPartInstance, previousPartInstance, playStatus } of instances) {
				const pieceInstancesInPart = cache.PieceInstances.findFetch({
					partInstanceId: existingPartInstance._id,
				})

				const partId = existingPartInstance.part._id
				const newPart = cache.Parts.findOne(partId)

				if (newPart) {
					const existingResultPartInstance: BlueprintSyncIngestPartInstance = {
						partInstance: unprotectObject(existingPartInstance),
						pieceInstances: unprotectObjectArray(pieceInstancesInPart),
					}

					const referencedAdlibIds = _.compact(pieceInstancesInPart.map((p) => p.adLibSourceId))
					const referencedAdlibs = ingestCache.AdLibPieces.findFetch({ _id: { $in: referencedAdlibIds } })

					const adlibPieces = ingestCache.AdLibPieces.findFetch({ partId: partId })
					const adlibActions = ingestCache.AdLibActions.findFetch({ partId: partId })

					const proposedPieceInstances = getPieceInstancesForPart(
						cache,
						previousPartInstance,
						newPart,
						waitForPromise(fetchPiecesThatMayBeActiveForPart(cache, newPart)),
						existingPartInstance._id,
						false
					)

					const newResultData: BlueprintSyncIngestNewData = {
						part: unprotectObject(newPart),
						pieceInstances: unprotectObjectArray(proposedPieceInstances),
						adLibPieces: unprotectObjectArray(adlibPieces),
						actions: unprotectObjectArray(adlibActions),
						referencedAdlibs: unprotectObjectArray(referencedAdlibs),
					}

					const syncContext = new SyncIngestUpdateToPartInstanceContext(
						{
							name: `Update to ${newPart.externalId}`,
							identifier: `rundownId=${newPart.rundownId},segmentId=${newPart.segmentId}`,
						},
						cache.Playlist.doc.activationId,
						rundown,
						cache,
						existingPartInstance,
						pieceInstancesInPart,
						proposedPieceInstances,
						playStatus
					)
					// TODO - how can we limit the frequency we run this? (ie, how do we know nothing affecting this has changed)
					try {
						// The blueprint handles what in the updated part is going to be synced into the partInstance:
						blueprint.syncIngestUpdateToPartInstance(
							syncContext,
							existingResultPartInstance,
							clone(newResultData),
							playStatus
						)

						// If the blueprint function throws, no changes will be synced to the cache:
						syncContext.applyChangesToCache(cache)
					} catch (e) {
						logger.error(e)
					}

					// Save notes:
					if (!existingPartInstance.part.notes) existingPartInstance.part.notes = []
					const notes: PartNote[] = existingPartInstance.part.notes
					let changed = false
					for (const note of syncContext.notes) {
						changed = true
						notes.push(
							literal<SegmentNote>({
								type: note.type,
								message: note.message,
								origin: {
									name: '', // TODO
								},
							})
						)
					}
					if (changed) {
						// TODO - these dont get shown to the user currently
						// TODO - old notes from the sync may need to be pruned, or we will end up with duplicates and 'stuck' notes?
						cache.PartInstances.update(existingPartInstance._id, {
							$set: {
								'part.notes': notes,
							},
						})
					}

					if (existingPartInstance._id === cache.Playlist.doc.currentPartInstanceId) {
						// This should be run after 'current', before 'next':
						syncPlayheadInfinitesForNextPartInstance(cache)
					}
				} else {
					// the part has been removed, don't sync that
				}
			}
		} else {
			// blueprint.syncIngestUpdateToPartInstance is not set, default behaviour is to not sync the partInstance at all.
		}
	}
}

export function afterIngestChangedData(
	ingestCache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo,
	changedSegments: ChangedSegmentsRankInfo
) {
	// To be called after rundown has been changed
	updateExpectedMediaItemsOnRundown(ingestCache)
	updateExpectedPlayoutItemsOnRundown(ingestCache)

	// Lock the playlist and make sure it is updated
	rundownPlaylistPlayoutSyncFunctionInner('afterIngestChangedData', playoutInfo.playlist, null, (cache) => {
		updatePartInstancesBasicProperties(cache, rundown._id)

		updatePartInstanceRanks(cache, changedSegments)

		syncChangesToPartInstances(cache, blueprint, ingestCache)
	})

	triggerUpdateTimelineAfterIngestData(playoutInfo.playlist._id)
}

export function handleRemovedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	partExternalId: string
) {
	return rundownIngestSyncFunction(
		'handleRemovedPart',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestDataCache) => {
			const rundown = getRundown2(cache)
			const segmentId = getSegmentId(rundown._id, segmentExternalId)
			const partId = getPartId(rundown._id, partExternalId)
			const segment = getSegment2(cache, segmentId)

			if (!canBeUpdated(rundown, segment, partId)) return undefined

			// Blueprints will handle the deletion of the Part
			const ingestSegment = loadCachedIngestSegment(
				ingestDataCache,
				rundownExternalId,
				segmentId,
				segmentExternalId
			)
			ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partExternalId)
			ingestSegment.modified = getCurrentTime()

			saveSegmentCache(ingestDataCache, rundown._id, segmentId, ingestSegment)

			const showStyle = getShowStyleCompound2(rundown)
			const blueprint = loadShowStyleBlueprint(showStyle)
			return prepareUpdateSegmentFromIngestData(cache, showStyle, blueprint, ingestSegment)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				const rundown = getRundown2(cache)
				const segmentId = getSegmentId(rundown._id, segmentExternalId)
				const partId = getPartId(rundown._id, partExternalId)

				const part = cache.Parts.findOne({
					_id: partId,
					segmentId: segmentId,
				})
				if (!part) throw new Meteor.Error(404, 'Part not found')

				if (!isUpdateAllowed(playoutInfo, rundown, {}, {}, { removed: [part] })) {
					unsyncSegmentOrRundown(cache, segmentId)
				} else {
					const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = savePreparedSegmentChanges(
						cache,
						playoutInfo,
						preparedChanges
					)
					if (updatedSegmentId) {
						afterIngestChangedData(cache, playoutInfo, [
							{ segmentId: updatedSegmentId, oldPartIdsAndRanks },
						])
					}
				}
			}
		}
	)
}
export function handleUpdatedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	ingestPart: IngestPart
) {
	return rundownIngestSyncFunction(
		'handleUpdatedPart',
		peripheralDevice,
		rundownExternalId,
		(cache, ingestCache) => {
			return prepareUpdatePartInner(cache, ingestCache, segmentExternalId, ingestPart)
		},
		(cache, playoutInfo, preparedChanges) => {
			if (preparedChanges) {
				const rundown = getRundown2(cache)
				if (!isUpdateAllowed(playoutInfo, rundown, {}, {}, {})) {
					ServerRundownAPI.unsyncRundownInner(cache)
				} else {
					const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = savePreparedSegmentChanges(
						cache,
						playoutInfo,
						preparedChanges
					)
					if (updatedSegmentId) {
						afterIngestChangedData(cache, playoutInfo, [
							{ segmentId: updatedSegmentId, oldPartIdsAndRanks },
						])
					}
				}
			}
		}
	)
}
export function prepareUpdatePartInner(
	cache: ReadOnlyCache<CacheForIngest>,
	ingestDataCache: RundownIngestDataCacheCollection,
	segmentExternalId: string,
	ingestPart: IngestPart
): PreparedSegmentChanges | undefined {
	const span = profiler.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	// Updated OR created part
	const rundown = getRundown2(cache)
	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	const partId = getPartId(rundown._id, ingestPart.externalId)
	const segment = cache.Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)

	if (!canBeUpdated(rundown, segment, partId)) return undefined

	// const part = cache.Parts.findOne({
	// 	_id: partId,
	// 	segmentId: segmentId,
	// 	rundownId: rundown._id,
	// })

	// if (part && !isUpdateAllowed(cache, playlist, rundown, {}, {}, { changed: [part] })) {
	// 	// TODO-CACHE this looks like the part part of this has no effect
	// 	ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
	// } else {
	// Blueprints will handle the creation of the Part
	const ingestSegment: LocalIngestSegment = loadCachedIngestSegment(
		ingestDataCache,
		rundown.externalId,
		segmentId,
		segmentExternalId
	)
	ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== ingestPart.externalId)
	ingestSegment.parts.push(makeNewIngestPart(ingestPart))
	ingestSegment.modified = getCurrentTime()

	saveSegmentCache(ingestDataCache, rundown._id, segmentId, ingestSegment)

	const showStyle = getShowStyleCompound2(rundown)
	const blueprint = loadShowStyleBlueprint(showStyle)
	const res = prepareUpdateSegmentFromIngestData(cache, showStyle, blueprint, ingestSegment)
	span?.end()
	return res
}

function generateSegmentContents(
	cache: ReadOnlyCache<CacheForIngest>,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: WrappedShowStyleBlueprint,
	dbRundown: ReadonlyDeep<DBRundown>,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBPart[]
) {
	const span = profiler.startSpan('ingest.rundownInput.generateSegmentContents')

	const rundownId = dbRundown._id
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)

	// const notesContext = new NotesContext(ingestSegment.name, `rundownId=${rundownId},segmentId=${segmentId}`, true)
	const context = new SegmentUserContext(
		{
			name: `getSegment=${ingestSegment.name}`,
			identifier: `rundownId=${rundownId},segmentId=${segmentId}`,
		},
		cache.Studio.doc,
		dbRundown,
		showStyle
	)

	const blueprintRes = blueprint.blueprint.getSegment(context, ingestSegment)

	// Ensure all parts have a valid externalId set on them
	const knownPartExternalIds = blueprintRes.parts.map((p) => p.part.externalId)

	const segmentNotes: SegmentNote[] = []
	for (const note of context.notes) {
		if (!note.partExternalId || knownPartExternalIds.indexOf(note.partExternalId) === -1) {
			segmentNotes.push(
				literal<SegmentNote>({
					type: note.type,
					message: {
						...note.message,
						namespaces: [unprotectString(blueprint.blueprintId)],
					},
					origin: {
						name: '', // TODO
					},
				})
			)
		}
	}

	const newSegment = literal<DBSegment>({
		..._.omit(existingSegment || {}, 'isHidden'),
		...blueprintRes.segment,
		_id: segmentId,
		rundownId: rundownId,
		externalId: ingestSegment.externalId,
		_rank: ingestSegment.rank,
		notes: segmentNotes,
	})

	const parts: DBPart[] = []
	const segmentPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []
	const adlibActions: AdLibAction[] = []

	// Parts
	blueprintRes.parts.forEach((blueprintPart, i) => {
		const partId = getPartId(rundownId, blueprintPart.part.externalId)

		const notes: PartNote[] = []

		for (const note of context.notes) {
			if (note.partExternalId === blueprintPart.part.externalId) {
				notes.push(
					literal<PartNote>({
						type: note.type,
						message: {
							...note.message,
							namespaces: [unprotectString(blueprint.blueprintId)],
						},
						origin: {
							name: '', // TODO
						},
					})
				)
			}
		}

		const existingPart = existingParts.find((p) => p._id === partId)
		const existingPartProps = existingPart ? _.pick(existingPart, 'status') : {} // This property is 'owned' by core and updated via its own flow
		const part = literal<DBPart>({
			...existingPartProps,
			...blueprintPart.part,
			_id: partId,
			rundownId: rundownId,
			segmentId: newSegment._id,
			_rank: i, // This gets updated to a rank unique within its segment in a later step
			notes: notes,
		})
		parts.push(part)

		// This ensures that it doesn't accidently get played while hidden
		if (blueprintRes.segment.isHidden) {
			part.invalid = true
		}

		// Update pieces
		segmentPieces.push(
			...postProcessPieces(
				context,
				blueprintPart.pieces,
				blueprint.blueprintId,
				rundownId,
				newSegment._id,
				part._id,
				undefined,
				undefined,
				part.invalid
			)
		)
		adlibPieces.push(
			...postProcessAdLibPieces(context, blueprint.blueprintId, rundownId, part._id, blueprintPart.adLibPieces)
		)
		adlibActions.push(
			...postProcessAdLibActions(context, blueprint.blueprintId, rundownId, part._id, blueprintPart.actions || [])
		)
	})

	// If the segment has no parts, then hide it
	if (parts.length === 0) {
		newSegment.isHidden = true
	}

	span?.end()
	return {
		newSegment,
		parts,
		segmentPieces,
		adlibPieces,
		adlibActions,
	}
}

export function isUpdateAllowed(
	playoutInfo: IngestPlayoutInfo,
	rundown: ReadonlyDeep<Rundown>,
	rundownChanges?: Partial<PreparedChanges<ReadonlyDeep<DBRundown>>>,
	segmentChanges?: Partial<PreparedChanges<DBSegment>>,
	partChanges?: Partial<PreparedChanges<DBPart>>
): boolean {
	const span = profiler.startSpan('rundownInput.isUpdateAllowed')

	let allowed: boolean = true

	if (!rundown) return false
	if (rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}

	if (playoutInfo.playlist.activationId) {
		if (allowed && rundownChanges && rundownChanges.removed && rundownChanges.removed.length) {
			_.each(rundownChanges.removed, (rd) => {
				if (rundown._id === rd._id) {
					// Don't allow removing an active rundown
					logger.warn(
						`Not allowing removal of current active rundown "${rd._id}", making rundown unsynced instead`
					)
					allowed = false
				}
			})
		}
		const { currentPartInstance, nextPartInstance } = playoutInfo // getSelectedPartInstancesFromCache(cache, rundownPlaylist)
		if (currentPartInstance) {
			if (allowed && partChanges && partChanges.removed && partChanges.removed.length) {
				_.each(partChanges.removed, (part) => {
					if (currentPartInstance.part._id === part._id) {
						// Don't allow removing currently playing part
						logger.warn(
							`Not allowing removal of currently playing part "${part._id}" ("${part.externalId}"), making rundown unsynced instead`
						)
						allowed = false
					} else if (
						nextPartInstance &&
						nextPartInstance.part._id === part._id &&
						isTooCloseToAutonext(currentPartInstance, false)
					) {
						// Don't allow removing next part, when autonext is about to happen
						logger.warn(
							`Not allowing removal of nexted part "${part._id}" ("${part.externalId}"), making rundown unsynced instead`
						)
						allowed = false
					}
				})
			}
			if (allowed) {
				if (segmentChanges && segmentChanges.removed && segmentChanges.removed.length) {
					_.each(segmentChanges.removed, (segment) => {
						if (currentPartInstance.segmentId === segment._id) {
							// Don't allow removing segment with currently playing part
							logger.warn(
								`Not allowing removal of segment "${segment._id}" ("${segment.externalId}"), containing currently playing part "${currentPartInstance._id}" ("${currentPartInstance.part.externalId}"), making rundown unsynced instead`
							)
							allowed = false
						}
					})
				}
			}
		}
	}
	if (!allowed) {
		if (rundownChanges) logger.debug(`rundownChanges: ${printChanges(rundownChanges)}`)
		if (segmentChanges) logger.debug(`segmentChanges: ${printChanges(segmentChanges)}`)
		if (partChanges) logger.debug(`partChanges: ${printChanges(partChanges)}`)
	}

	span?.end()
	return allowed
}
function printChanges(changes: Partial<PreparedChanges<{ _id: ProtectedString<any>; externalId: string }>>): string {
	let str = ''

	const compileDocs = (docs: { _id: ProtectedString<any>; externalId: string }[], keyword: string) => {
		return _.map(docs, (doc) => `${keyword}: "${doc._id}" ("${doc.externalId}")`).join(', ')
	}

	if (changes.changed) str += compileDocs(changes.changed, 'change')
	if (changes.inserted) str += compileDocs(changes.inserted, 'insert')
	if (changes.removed) str += compileDocs(changes.removed, 'remove')

	return str
}

type PartIdToSegmentId = Map<PartId, SegmentId>

function splitIntoSegments(
	prepareSaveSegments: PreparedChanges<DBSegment>,
	prepareSaveParts: PreparedChanges<DBPart>,
	prepareSavePieces: PreparedChanges<Piece>,
	prepareSaveAdLibPieces: PreparedChanges<AdLibPiece>,
	prepareSaveAdLibActions: PreparedChanges<AdLibAction>
): SegmentChanges[] {
	let changes: SegmentChanges[] = []

	processChangeGroup(changes, prepareSaveSegments, 'changed')
	processChangeGroup(changes, prepareSaveSegments, 'inserted')
	processChangeGroup(changes, prepareSaveSegments, 'removed')
	processChangeGroup(changes, prepareSaveSegments, 'unchanged')

	const partsToSegments: PartIdToSegmentId = new Map()

	prepareSaveParts.changed.forEach((part) => {
		partsToSegments.set(part._id, part.segmentId)
		const index = changes.findIndex((c) => c.segmentId === part.segmentId)
		if (index === -1) {
			const newChange = makeChangeObj(part.segmentId)
			newChange.parts.changed.push(part)
			changes.push(newChange)
		} else {
			changes[index].parts.changed.push(part)
		}
	})
	;['removed', 'inserted', 'unchanged'].forEach((change: keyof Omit<PreparedChanges<DBPart>, 'changed'>) => {
		prepareSaveParts[change].forEach((part: DBPart) => {
			partsToSegments.set(part._id, part.segmentId)
			const index = changes.findIndex((c) => c.segmentId === part.segmentId)
			if (index === -1) {
				const newChange = makeChangeObj(part.segmentId)
				newChange.parts[change].push(part)
				changes.push(newChange)
			} else {
				changes[index].parts[change].push(part)
			}
		})
	})

	for (const piece of prepareSavePieces.changed) {
		const segmentId = partsToSegments.get(piece.startPartId)
		if (!segmentId) {
			logger.warning(`SegmentId could not be found when trying to modify piece ${piece._id}`)
			break // In theory this shouldn't happen, but reject 'orphaned' changes
		}
		const index = changes.findIndex((c) => c.segmentId === segmentId)
		if (index === -1) {
			const newChange = makeChangeObj(segmentId)
			newChange.pieces.changed.push(piece)
			changes.push(newChange)
		} else {
			changes[index].pieces.changed.push(piece)
		}
	}

	;['removed', 'inserted', 'unchanged'].forEach((change: keyof Omit<PreparedChanges<Piece>, 'changed'>) => {
		for (const piece of prepareSavePieces[change]) {
			const segmentId = partsToSegments.get(piece.startPartId)
			if (!segmentId) {
				logger.warning(`SegmentId could not be found when trying to modify piece ${piece._id}`)
				break // In theory this shouldn't happen, but reject 'orphaned' changes
			}
			const index = changes.findIndex((c) => c.segmentId === segmentId)
			if (index === -1) {
				const newChange = makeChangeObj(segmentId)
				newChange.pieces[change].push(piece)
				changes.push(newChange)
			} else {
				changes[index].pieces[change].push(piece)
			}
		}
	})

	for (const adlib of prepareSaveAdLibPieces.changed) {
		const segmentId = adlib.partId ? partsToSegments.get(adlib.partId) : undefined
		if (!segmentId) {
			logger.warning(`SegmentId could not be found when trying to modify adlib ${adlib._id}`)
			break // In theory this shouldn't happen, but reject 'orphaned' changes
		}
		const index = changes.findIndex((c) => c.segmentId === segmentId)
		if (index === -1) {
			const newChange = makeChangeObj(segmentId)
			newChange.adlibPieces.changed.push(adlib)
			changes.push(newChange)
		} else {
			changes[index].adlibPieces.changed.push(adlib)
		}
	}

	;['removed', 'inserted', 'unchanged'].forEach((change: keyof Omit<PreparedChanges<AdLibPiece>, 'changed'>) => {
		for (const piece of prepareSaveAdLibPieces[change]) {
			const segmentId = piece.partId ? partsToSegments.get(piece.partId) : undefined
			if (!segmentId) {
				logger.warning(`SegmentId could not be found when trying to modify adlib ${piece._id}`)
				break // In theory this shouldn't happen, but reject 'orphaned' changes
			}
			const index = changes.findIndex((c) => c.segmentId === segmentId)
			if (index === -1) {
				const newChange = makeChangeObj(segmentId)
				newChange.adlibPieces[change].push(piece)
				changes.push(newChange)
			} else {
				changes[index].adlibPieces[change].push(piece)
			}
		}
	})

	for (const adlib of prepareSaveAdLibActions.changed) {
		const segmentId = adlib.partId ? partsToSegments.get(adlib.partId) : undefined
		if (!segmentId) {
			logger.warning(`SegmentId could not be found when trying to modify adlib action ${adlib._id}`)
			break // In theory this shouldn't happen, but reject 'orphaned' changes
		}
		const index = changes.findIndex((c) => c.segmentId === segmentId)
		if (index === -1) {
			const newChange = makeChangeObj(segmentId)
			newChange.adlibActions.changed.push(adlib)
			changes.push(newChange)
		} else {
			changes[index].adlibActions.changed.push(adlib)
		}
	}

	;['removed', 'inserted', 'unchanged'].forEach((change: keyof Omit<PreparedChanges<AdLibPiece>, 'changed'>) => {
		for (const piece of prepareSaveAdLibActions[change]) {
			const segmentId = piece.partId ? partsToSegments.get(piece.partId) : undefined
			if (!segmentId) {
				logger.warning(`SegmentId could not be found when trying to modify adlib action ${piece._id}`)
				break // In theory this shouldn't happen, but reject 'orphaned' changes
			}
			const index = changes.findIndex((c) => c.segmentId === segmentId)
			if (index === -1) {
				const newChange = makeChangeObj(segmentId)
				newChange.adlibActions[change].push(piece)
				changes.push(newChange)
			} else {
				changes[index].adlibActions[change].push(piece)
			}
		}
	})

	return changes
}

function processChangeGroup<ChangeType extends keyof PreparedChanges<DBSegment>>(
	changes: SegmentChanges[],
	preparedChanges: PreparedChanges<DBSegment>,
	changeField: ChangeType
) {
	const subset = preparedChanges[changeField]
	// @ts-ignore
	subset.forEach((ch) => {
		if (changeField === 'changed') {
			const existing = changes.findIndex((c) => ch._id === c.segmentId)
			processChangeGroupInner(existing, changes, changeField, ch, ch._id)
		} else {
			const existing = changes.findIndex((c) => ch._id === c.segmentId)
			processChangeGroupInner(existing, changes, changeField, ch, ch._id)
		}
	})
}

function processChangeGroupInner<ChangeType extends keyof PreparedChanges<DBSegment>>(
	existing: number,
	changes: SegmentChanges[],
	changeField: ChangeType,
	changedObject: DBSegment,
	segmentId
) {
	if (existing !== -1) {
		if (!changes[existing].segment) {
			changes[existing].segment = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}
		}

		// @ts-ignore
		changes[existing].segment[changeField].push(changedObject as any)
	} else {
		const newChange = makeChangeObj(segmentId)
		// @ts-ignore
		newChange.segment[changeField].push(changedObject as any)
		changes.push(newChange)
	}
}

function makeChangeObj(segmentId: SegmentId): SegmentChanges {
	return {
		segmentId,
		segment: {
			inserted: [],
			changed: [],
			removed: [],
			unchanged: [],
		},
		parts: {
			inserted: [],
			changed: [],
			removed: [],
			unchanged: [],
		},
		pieces: {
			inserted: [],
			changed: [],
			removed: [],
			unchanged: [],
		},
		adlibPieces: {
			inserted: [],
			changed: [],
			removed: [],
			unchanged: [],
		},
		adlibActions: {
			inserted: [],
			changed: [],
			removed: [],
			unchanged: [],
		},
	}
}

function unsyncSegmentOrRundown(cache: CacheForIngest, segmentId: SegmentId) {
	if (Settings.allowUnsyncedSegments) {
		ServerRundownAPI.unsyncSegmentInner(cache, segmentId)
	} else {
		ServerRundownAPI.unsyncRundownInner(cache)
	}
}
