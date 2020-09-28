import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import * as _ from 'underscore'
import {
	PeripheralDevice,
	PeripheralDeviceId,
	getExternalNRCSName,
	getStudioIdFromDevice,
} from '../../../lib/collections/PeripheralDevices'
import { Rundown, Rundowns, DBRundown, RundownId } from '../../../lib/collections/Rundowns'
import { Part, DBPart, PartId } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import {
	saveIntoDb,
	getCurrentTime,
	literal,
	sumChanges,
	anythingChanged,
	ReturnType,
	waitForPromise,
	unprotectString,
	protectString,
	ProtectedString,
	Omit,
	getRandomId,
	PreparedChanges,
	clone,
} from '../../../lib/lib'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	BlueprintResultSegment,
} from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio, Studios, StudioId } from '../../../lib/collections/Studios'
import {
	selectShowStyleVariant,
	afterRemoveSegments,
	afterRemoveParts,
	ServerRundownAPI,
	removeSegments,
	updatePartRanks,
	produceRundownPlaylistInfo,
	RundownPlaylistAndOrder,
} from '../rundown'
import { loadShowStyleBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import { ShowStyleContext, RundownContext, SegmentContext, NotesContext } from '../blueprints/context'
import { Blueprints, Blueprint, BlueprintId } from '../../../lib/collections/Blueprints'
import {
	RundownBaselineObj,
	RundownBaselineObjId,
	RundownBaselineObjs,
} from '../../../lib/collections/RundownBaselineObjs'
import { Random } from 'meteor/random'
import {
	postProcessRundownBaselineItems,
	postProcessAdLibPieces,
	postProcessPieces,
	postProcessAdLibActions,
	postProcessGlobalAdLibActions,
} from '../blueprints/postProcess'
import {
	RundownBaselineAdLibItem,
	RundownBaselineAdLibPieces,
} from '../../../lib/collections/RundownBaselineAdLibPieces'
import { DBSegment, Segments, SegmentId, Segment } from '../../../lib/collections/Segments'
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
} from './lib'
import { PackageInfo } from '../../coreSystem'
import { updateExpectedMediaItemsOnRundown } from '../expectedMediaItems'
import { triggerUpdateTimelineAfterIngestData } from '../playout/playout'
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
import { Mongo } from 'meteor/mongo'
import { isTooCloseToAutonext } from '../playout/lib'
import { PartInstances } from '../../../lib/collections/PartInstances'
import { MethodContext } from '../../../lib/api/methods'
import { CacheForStudio2, CacheForIngest, ReadOnlyCache } from '../../DatabaseCaches'
import { prepareSaveIntoCache, savePreparedChangesIntoCache, saveIntoCache } from '../../DatabaseCache'
import { reportRundownDataHasChanged } from '../asRunLog'
import { Settings } from '../../../lib/Settings'
import { AdLibAction, AdLibActions } from '../../../lib/collections/AdLibActions'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { removeEmptyPlaylists } from '../rundownPlaylist'
import { DeepReadonly } from 'utility-types'
import { ShowStyleCompound, getShowStyleCompound2 } from '../../../lib/collections/ShowStyleVariants'
import { run } from 'tslint/lib/runner'
import { profiler } from '../profiler'

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
export function rundownPlaylistSyncFunction<T extends Function>( // TODO - remove this
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	context: string,
	fcn: T
): ReturnType<T> {
	return syncFunction(fcn, context, `rundown_playlist_${rundownPlaylistId}`, undefined, priority)()
}

export function rundownPlaylistCustomSyncFunction<T>(
	context: string,
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	fcn: () => T
): T {
	return syncFunction(fcn, context, `rundown_playlist_${rundownPlaylistId}`, undefined, priority)()
}

export function studioSyncFunction<T>(context: string, studioId: StudioId, fcn: (cache: CacheForStudio2) => T): T {
	return syncFunction(
		() => {
			const cache = waitForPromise(CacheForStudio2.create(studioId))

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

	const showStyle = selectShowStyleVariant(studio, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		span?.end()
		throw new Meteor.Error(501, 'Blueprint rejected the rundown')
	}

	const { blueprint: showStyleBlueprint, blueprintId } = loadShowStyleBlueprint(showStyle.base)
	const notesContext = new NotesContext(
		`${showStyle.base.name}-${showStyle.variant.name}`,
		`showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		true
	)
	const blueprintContext = new ShowStyleContext(studio, showStyle.compound, notesContext)
	const rundownRes = showStyleBlueprint.getRundown(blueprintContext, extendedIngestRundown)

	// Ensure the ids in the notes are clean
	const rundownNotes = _.map(notesContext.getNotes(), (note) =>
		literal<RundownNote>({
			type: note.type,
			message: note.message,
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
			blueprint: showStyleBlueprint.blueprintVersion,
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
		const existingPlaylist = RundownPlaylists.findOne(existingDbRundown.playlistId)
		if (existingPlaylist) {
			const { currentPartInstance } = existingPlaylist.getSelectedPartInstances()

			if (
				existingPlaylist.active &&
				currentPartInstance &&
				currentPartInstance.rundownId === cache.Rundown.doc._id
			) {
				// The rundown contains a PartInstance that is currently on air.
				// We're trying for a "soft approach" here, instead of rejecting the change altogether,
				// and will just revert the playlist change:

				dbRundown.playlistExternalId = cache.Rundown.doc.playlistExternalId
				dbRundown.playlistId = cache.Rundown.doc.playlistId

				if (!dbRundown.notes) dbRundown.notes = []
				dbRundown.notes.push({
					type: NoteType.WARNING,
					message: `The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.`,
					origin: {
						name: 'Data update',
					},
				})
			}
		} else {
			logger.warn(`Existing playlist "${cache.Rundown.doc.playlistId}" not found`)
		}
	}

	const rundownPlaylistInfo = produceRundownPlaylistInfo(studio, dbRundown, peripheralDevice)

	// Save the baseline
	const rundownNotesContext = new NotesContext(dbRundown.name, `rundownId=${dbRundown._id}`, true)
	const blueprintRundownContext = new RundownContext(
		cache.Studio.doc,
		dbRundown,
		showStyle.compound,
		rundownNotesContext
	)
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
		rundownRes.globalAdLibPieces,
		showStyle.base.blueprintId
	)
	logger.info(`... got ${(rundownRes.globalActions || []).length} adLib actions from baseline.`)
	const baselineAdlibActions = postProcessGlobalAdLibActions(
		blueprintRundownContext,
		rundownRes.globalActions || [],
		showStyle.base.blueprintId
	)

	// TODO - store notes from rundownNotesContext

	const segmentsAndParts = getRundownSegmentsAndPartsFromIngestCache(cache)
	const existingRundownParts = _.filter(segmentsAndParts.parts, (part) => !part.dynamicallyInsertedAfterPartId)
	const existingSegments = segmentsAndParts.segments

	const segments: DBSegment[] = []
	const parts: DBPart[] = []
	const segmentPieces: Piece[] = []
	const adlibPieces: AdLibPiece[] = []
	const adlibActions: AdLibAction[] = []

	// const { blueprint, blueprintId } = loadShowStyleBlueprint(showStyle.base)

	_.each(ingestRundown.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = _.find(existingSegments, (s) => s._id === segmentId)
		const existingParts = existingRundownParts.filter((p) => p.segmentId === segmentId)

		ingestSegment.parts = _.sortBy(ingestSegment.parts, (part) => part.rank)

		const notesContext = new NotesContext(ingestSegment.name, `rundownId=${rundownId},segmentId=${segmentId}`, true)
		const context = new SegmentContext(cache.Studio.doc, dbRundown, showStyle.compound, notesContext)
		const res = showStyleBlueprint.getSegment(context, ingestSegment)

		const segmentContents = generateSegmentContents(
			context,
			blueprintId,
			ingestSegment,
			existingSegment,
			existingParts,
			res
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
	removeEmptyPlaylists(studio) // TODO-CACHE

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
			afterRemoveAll(segments) {
				afterRemoveSegments(
					cache,
					segments.map((s) => s._id)
				)
			},
		})
	)

	const didChange = anythingChanged(allChanges)
	if (didChange) {
		afterIngestChangedData(cache, playoutInfo, [
			...preparedChanges.segments.changed.map((s) => s._id),
			...preparedChanges.segments.inserted.map((s) => s._id),
		])

		reportRundownDataHasChanged(cache, dbPlaylist)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return didChange
}

/** Set order and playlistID of rundowns in a playlist */
function handleUpdatedRundownPlaylist(
	currentRundown: DBRundown,
	playlist: DBRundownPlaylist,
	order: _.Dictionary<number>
) {
	let rundowns: DBRundown[] = []
	let selector: Mongo.Selector<DBRundown> = {}
	if (currentRundown.playlistExternalId && playlist.externalId === currentRundown.playlistExternalId) {
		selector = { playlistExternalId: currentRundown.playlistExternalId }
		rundowns = Rundowns.find({ playlistExternalId: currentRundown.playlistExternalId }).fetch()
	} else if (!currentRundown.playlistExternalId) {
		selector = { _id: currentRundown._id }
		rundowns = [currentRundown]
	} else if (currentRundown.playlistExternalId && playlist.externalId !== currentRundown.playlistExternalId) {
		throw new Meteor.Error(
			501,
			`Rundown "${currentRundown._id}" is assigned to a playlist "${currentRundown.playlistExternalId}", but the produced playlist has external ID: "${playlist.externalId}".`
		)
	} else {
		throw new Meteor.Error(501, `Unknown error when handling rundown playlist.`)
	}

	const updated = rundowns.map((r) => {
		const rundownOrder = order[unprotectString(r._id)]
		r.playlistId = playlist._id
		if (rundownOrder !== undefined) {
			r._rank = rundownOrder
		} else {
			// an unranked Rundown is essentially "floated" - it is a part of the playlist, but it shouldn't be visible in the UI
			r._rank = -1
			// TODO - this should do something to make it be floated
		}

		if (r._id === currentRundown._id) {
			// Apply to in-memory copy
			currentRundown.playlistId = r.playlistId
			currentRundown._rank = r._rank
		}
		return r
	})

	saveIntoDb(Rundowns, selector, updated)
}

function handleRemovedSegment(
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
					ServerRundownAPI.unsyncRundownInner(cache)
				} else {
					if (removeSegments(cache, [segmentId]) === 0) {
						throw new Meteor.Error(
							404,
							`handleRemovedSegment: removeSegments: Segment ${segmentExternalId} not found`
						)
					}
				}
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
				const updatedSegmentId = savePreparedSegmentChanges(cache, playoutInfo, preparedChanges)
				if (updatedSegmentId) {
					afterIngestChangedData(cache, playoutInfo, [updatedSegmentId])
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
	showStyle: DeepReadonly<ShowStyleCompound>,
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
		dynamicallyInsertedAfterPartId: { $exists: false },
	})

	ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)

	const notesContext = new NotesContext(ingestSegment.name, `rundownId=${rundown._id},segmentId=${segmentId}`, true)
	const context = new SegmentContext(cache.Studio.doc, rundown, showStyle, notesContext)
	const res = wrappedBlueprint.blueprint.getSegment(context, ingestSegment)

	const { parts, segmentPieces, adlibPieces, adlibActions, newSegment } = generateSegmentContents(
		context,
		wrappedBlueprint.blueprintId,
		ingestSegment,
		existingSegment,
		existingParts,
		res
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
): SegmentId | null {
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
			dynamicallyInsertedAfterPartId: { $exists: false }, // do not affect dynamically inserted parts (such as adLib parts)
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
		ServerRundownAPI.unsyncRundownInner(cache)
		span?.end()
		return null
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

	const hasChanged = anythingChanged(changes) ? preparedChanges.segmentId : null
	span?.end()
	return hasChanged
}

export function afterIngestChangedData(
	cache: CacheForIngest,
	playoutInfo: IngestPlayoutInfo,
	changedSegmentIds: SegmentId[]
) {
	// To be called after rundown has been changed
	updateExpectedMediaItemsOnRundown(cache)
	updateExpectedPlayoutItemsOnRundown(cache)

	updatePartRanks(cache.Parts, undefined, changedSegmentIds)

	UpdateNext.ensureNextPartIsValid(cache, playoutInfo)
	// TODO - this timeline update stuff needs rethinking
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
					ServerRundownAPI.unsyncRundownInner(cache)
				} else {
					const updatedSegmentId = savePreparedSegmentChanges(cache, playoutInfo, preparedChanges)
					if (updatedSegmentId) {
						afterIngestChangedData(cache, playoutInfo, [updatedSegmentId])
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
					const updatedSegmentId = savePreparedSegmentChanges(cache, playoutInfo, preparedChanges)
					if (updatedSegmentId) {
						afterIngestChangedData(cache, playoutInfo, [updatedSegmentId])
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
	context: SegmentContext,
	blueprintId: BlueprintId,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBPart[],
	blueprintRes: BlueprintResultSegment
) {
	const span = profiler.startSpan('ingest.rundownInput.generateSegmentContents')

	const rundownId = context._rundown._id
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
	const rawNotes = context.notesContext.getNotes()

	// Ensure all parts have a valid externalId set on them
	const knownPartIds = blueprintRes.parts.map((p) => p.part.externalId)

	const segmentNotes: SegmentNote[] = []
	for (const note of rawNotes) {
		if (!note.trackingId || knownPartIds.indexOf(note.trackingId) === -1) {
			segmentNotes.push(
				literal<SegmentNote>({
					type: note.type,
					message: note.message,
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

		for (const note of rawNotes) {
			if (note.trackingId === blueprintPart.part.externalId) {
				notes.push(
					literal<PartNote>({
						type: note.type,
						message: note.message,
						origin: {
							name: '', // TODO
						},
					})
				)
			}
		}

		const existingPart = _.find(existingParts, (p) => p._id === partId)
		const part = literal<DBPart>({
			..._.omit(existingPart || {}, 'invalid'),
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
				blueprintId,
				rundownId,
				newSegment._id,
				part._id,
				undefined,
				undefined,
				part.invalid
			)
		)
		adlibPieces.push(...postProcessAdLibPieces(context, blueprintPart.adLibPieces, blueprintId, part._id))
		adlibActions.push(...postProcessAdLibActions(context, blueprintPart.actions || [], blueprintId, part._id))
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
	rundown: DeepReadonly<Rundown>,
	rundownChanges?: Partial<PreparedChanges<DeepReadonly<DBRundown>>>,
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

	if (playoutInfo.playlist.active) {
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
							`Not allowing removal of currently playing part "${part._id}", making rundown unsynced instead`
						)
						allowed = false
					} else if (
						nextPartInstance &&
						nextPartInstance.part._id === part._id &&
						isTooCloseToAutonext(currentPartInstance, false)
					) {
						// Don't allow removing next part, when autonext is about to happen
						logger.warn(
							`Not allowing removal of nexted part "${part._id}", making rundown unsynced instead`
						)
						allowed = false
					}
				})
			}
			if (allowed && segmentChanges && segmentChanges.removed && segmentChanges.removed.length) {
				_.each(segmentChanges.removed, (segment) => {
					if (currentPartInstance.segmentId === segment._id) {
						// Don't allow removing segment with currently playing part
						logger.warn(
							`Not allowing removal of segment "${segment._id}", containing currently playing part "${currentPartInstance.part._id}", making rundown unsynced instead`
						)
					}
				})
			}
			if (allowed) {
				if (segmentChanges && segmentChanges.removed && segmentChanges.removed.length) {
					_.each(segmentChanges.removed, (segment) => {
						if (currentPartInstance && currentPartInstance.segmentId === segment._id) {
							// Don't allow removing segment with currently playing part
							logger.warn(
								`Not allowing removal of segment "${segment._id}", containing currently playing part "${currentPartInstance._id}"`
							)
							allowed = false
						}
					})
				}
				if (
					allowed &&
					partChanges &&
					partChanges.removed &&
					partChanges.removed.length &&
					currentPartInstance &&
					currentPartInstance.part.dynamicallyInsertedAfterPartId
				) {
					// If the currently playing part is a queued part and depending on any of the parts that are to be removed:
					const removedPartIds = partChanges.removed.map((part) => part._id)
					if (removedPartIds.includes(currentPartInstance.part.dynamicallyInsertedAfterPartId)) {
						// Don't allow removal of a part that has a currently playing queued Part
						logger.warn(
							`Not allowing removal of part "${currentPartInstance.part.dynamicallyInsertedAfterPartId}", because currently playing (queued) part "${currentPartInstance._id}" is after it`
						)
						allowed = false
					}
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
function printChanges(changes: Partial<PreparedChanges<{ _id: ProtectedString<any> }>>): string {
	let str = ''

	if (changes.changed) str += _.map(changes.changed, (doc) => 'change:' + doc._id).join(',')
	if (changes.inserted) str += _.map(changes.inserted, (doc) => 'insert:' + doc._id).join(',')
	if (changes.removed) str += _.map(changes.removed, (doc) => 'remove:' + doc._id).join(',')

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
