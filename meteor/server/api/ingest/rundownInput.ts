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
import { DBSegment, Segments, SegmentId } from '../../../lib/collections/Segments'
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
} from './ingestCache'
import {
	getRundownId,
	getSegmentId,
	getPartId,
	getStudioFromDevice,
	getRundown,
	canBeUpdated,
	getRundownPlaylist,
	getSegment,
	checkAccessAndGetPeripheralDevice,
	extendIngestRundownCore,
	modifyPlaylistExternalId,
	rundownIngestSyncFunction,
	getRundown2,
	IngestPlayoutInfo,
	getRundownSegmentsAndPartsFromIngestCache,
	getShowStyleBaseIngest,
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
import { isTooCloseToAutonext, getRundownsSegmentsAndPartsFromCache, removeRundownFromCache } from '../playout/lib'
import { PartInstances } from '../../../lib/collections/PartInstances'
import { MethodContext } from '../../../lib/api/methods'
import {
	CacheForRundownPlaylist,
	initCacheForRundownPlaylist,
	CacheForStudio2,
	CacheForIngest,
} from '../../DatabaseCaches'
import { prepareSaveIntoCache, savePreparedChangesIntoCache } from '../../DatabaseCache'
import { reportRundownDataHasChanged } from '../asRunLog'
import { Settings } from '../../../lib/Settings'
import { AdLibAction, AdLibActions } from '../../../lib/collections/AdLibActions'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { removeEmptyPlaylists } from '../rundownPlaylist'
import { DeepReadonly } from 'utility-types'

/** Priority for handling of synchronous events. Lower means higher priority */
export enum RundownSyncFunctionPriority {
	/** Events initiated from external (ingest) devices */
	INGEST = 0,
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
	fcn: T
): ReturnType<T> {
	return syncFunction(fcn, `rundown_playlist_${rundownPlaylistId}`, undefined, priority)()
}

export function rundownPlaylistCustomSyncFunction<T>(
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	fcn: () => T
): T {
	return syncFunction(fcn, `rundown_playlist_${rundownPlaylistId}`, undefined, priority)()
}

export function studioSyncFunction<T>(studioId: StudioId, fcn: (cache: CacheForStudio2) => T): T {
	return syncFunction(() => {
		const cache = waitForPromise(CacheForStudio2.create(studioId))

		const res = fcn(cache)

		waitForPromise(cache.saveAllToDatabase())

		return res
	}, `studio_${studioId}`)()
}

// export function rundownPlaylistIngestFromStudioSyncFunction<T>(
// 	rundownPlaylistId: RundownPlaylistId,
// 	studioCache: CacheForStudio2,
// 	priority: RundownSyncFunctionPriority,
// 	fcn: (cache: CacheForIngest) => T
// ): T {
// 	return syncFunction(
// 		() => {
// 			const cache = waitForPromise(CacheForIngest.create(studioCache, rundownPlaylistId))

// 			const res = fcn(cache)

// 			waitForPromise(cache.saveAllToDatabase())

// 			return res
// 		},
// 		`rundown_playlist_${rundownPlaylistId}`,
// 		undefined,
// 		priority
// 	)()
// }

interface SegmentChanges {
	segmentId: SegmentId
	segment: PreparedChanges<DBSegment>
	parts: PreparedChanges<DBPart>
	pieces: PreparedChanges<Piece>
	adlibPieces: PreparedChanges<AdLibPiece>
}

export namespace RundownInput {
	// Get info on the current rundowns from this device:
	export function dataRundownList(context: MethodContext, deviceId: PeripheralDeviceId, deviceToken: string) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)
		logger.info('dataRundownList')
		return listIngestRundowns(peripheralDevice)
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
		return getIngestRundown(peripheralDevice, rundownExternalId)
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

function getIngestRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string): IngestRundown {
	const rundown = Rundowns.findOne({
		peripheralDeviceId: peripheralDevice._id,
		externalId: rundownExternalId,
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown ${rundownExternalId} does not exist`)
	}

	return loadCachedRundownData(rundown._id, rundown.externalId)
}
function listIngestRundowns(peripheralDevice: PeripheralDevice): string[] {
	const rundowns = Rundowns.find({
		peripheralDeviceId: peripheralDevice._id,
	}).fetch()

	return rundowns.map((r) => r.externalId)
}

export function handleRemovedRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string) {
	return rundownIngestSyncFunction(
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
					removeRundownFromCache(cache, rundown)
				} else {
					// Don't allow removing currently playing rundown playlists:
					logger.warn(
						`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
					)
					ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
				}
			} else {
				logger.info(`Rundown "${rundown._id}" cannot be updated`)
				if (!rundown.unsynced) {
					ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
				}
			}
		}
	)
}
/** Handle an updated (or inserted) Rundown */
export function handleUpdatedRundown(
	peripheralDevice: PeripheralDevice,
	ingestRundown: IngestRundown,
	dataSource: string
) {
	return rundownIngestSyncFunction(
		peripheralDevice,
		ingestRundown.externalId,
		(cache) => {
			handleUpdatedRundownInner(cache, makeNewIngestRundown(ingestRundown), dataSource, peripheralDevice)
		},
		null // TODO
	)
}
export function handleUpdatedRundownInner(
	cache: CacheForIngest,
	ingestRundown: IngestRundown | LocalIngestRundown,
	dataSource?: string,
	peripheralDevice?: PeripheralDevice
) {
	const existingDbRundown = cache.Rundown.doc
	if (!canBeUpdated(existingDbRundown)) return

	const rundownId = cache.Rundown.doc?._id ?? getRundownId(cache.Studio.doc, ingestRundown.externalId)

	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	const newIngestRundown = isLocalIngestRundown(ingestRundown) ? ingestRundown : makeNewIngestRundown(ingestRundown)

	// TODO-CACHE defer
	saveRundownCache(rundownId, newIngestRundown)

	updateRundownFromIngestData(cache, ingestRundown, dataSource, peripheralDevice)
}
export function regenerateRundown(rundownId: RundownId) {
	logger.info(`Regenerating rundown ${rundownId}`)
	const existingDbRundown = Rundowns.findOne(rundownId)
	if (!existingDbRundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)

	const studio = Studios.findOne(existingDbRundown.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${existingDbRundown.studioId}" not found`)

	const ingestRundown = loadCachedRundownData(rundownId, existingDbRundown.externalId)

	const dataSource = 'regenerate'

	updateRundownFromIngestData(studio, existingDbRundown, ingestRundown, dataSource, undefined)
}
function updateRundownFromIngestData( // TODO - split into calculation and save phases. These can then be invoked a bit nicer and cleaner than elsewhere
	cache: CacheForIngest,
	ingestRundown: IngestRundown,
	dataSource?: string,
	peripheralDevice?: PeripheralDevice
): boolean {
	const studio = cache.Studio.doc
	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)
	const rundownId = getRundownId(studio, ingestRundown.externalId)

	const showStyle = selectShowStyleVariant(studio, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Meteor.Error(501, 'Blueprint rejected the rundown')
	}

	const showStyleBlueprint = loadShowStyleBlueprint(showStyle.base).blueprint
	const notesContext = new NotesContext(
		`${showStyle.base.name}-${showStyle.variant.name}`,
		`showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		true
	)
	const blueprintContext = new ShowStyleContext(
		studio,
		undefined,
		undefined,
		showStyle.base._id,
		showStyle.variant._id,
		notesContext
	)
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

	const showStyleBlueprintDb = (Blueprints.findOne(showStyle.base.blueprintId) as Blueprint) || {}

	const dbRundownData: DBRundown = {
		// Some defaults to be overridden
		peripheralDeviceId: protectString(''),
		externalNRCSName: getExternalNRCSName(undefined),
		created: getCurrentTime(),
		_rank: 0, // set later, in produceRundownPlaylistInfo
		playlistId: protectString(''), // set later, in produceRundownPlaylistInfo

		// Persist old values in some old bits
		...clone(cache.Rundown.doc),

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
			blueprint: showStyleBlueprintDb.blueprintVersion,
			core: PackageInfo.versionExtended || PackageInfo.version,
		},

		dataSource: dataSource ?? cache.Rundown.doc?.dataSource ?? '',
		modified: getCurrentTime(),
	}
	if (peripheralDevice) {
		dbRundownData.peripheralDeviceId = peripheralDevice._id
		dbRundownData.externalNRCSName = getExternalNRCSName(peripheralDevice)
	}

	// Do a check if we're allowed to move out of currently playing playlist:
	if (cache.Rundown.doc && cache.Rundown.doc.playlistExternalId !== dbRundownData.playlistExternalId) {
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

				dbRundownData.playlistExternalId = cache.Rundown.doc.playlistExternalId
				dbRundownData.playlistId = cache.Rundown.doc.playlistId

				if (!dbRundownData.notes) dbRundownData.notes = []
				dbRundownData.notes.push({
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

	const rundownChanges = {
		added: cache.Rundown.doc ? 0 : 1,
		updated: cache.Rundown.doc ? 1 : 0,
		removed: 0,
	}

	const dbRundown = cache.Rundown.replace(dbRundownData)

	// TODO-CACHE - all the way to removeEmptyPlaylists
	// const rundownPlaylistInfo = produceRundownPlaylistInfo(studio, dbRundown, peripheralDevice)

	// const playlistChanges = saveIntoDb(
	// 	RundownPlaylists,
	// 	{
	// 		_id: rundownPlaylistInfo.rundownPlaylist._id,
	// 	},
	// 	[rundownPlaylistInfo.rundownPlaylist],
	// 	{
	// 		beforeInsert: (o) => {
	// 			o.created = getCurrentTime()
	// 			o.modified = getCurrentTime()
	// 			o.previousPartInstanceId = null
	// 			o.currentPartInstanceId = null
	// 			o.nextPartInstanceId = null
	// 			return o
	// 		},
	// 		beforeUpdate: (o) => {
	// 			o.modified = getCurrentTime()
	// 			return o
	// 		},
	// 	}
	// )

	// handleUpdatedRundownPlaylist(dbRundown, rundownPlaylistInfo.rundownPlaylist, rundownPlaylistInfo.order)
	// removeEmptyPlaylists(studio) // TODO-CACHE

	// const dbPlaylist = dbRundown.getRundownPlaylist()
	// if (!dbPlaylist) throw new Meteor.Error(500, 'RundownPlaylist not found (it should have been)')

	// const cache = waitForPromise(initCacheForRundownPlaylist(dbPlaylist))

	// Save the baseline
	const rundownNotesContext = new NotesContext(dbRundown.name, `rundownId=${dbRundown._id}`, true)
	const blueprintRundownContext = new RundownContext(dbRundown, cache, rundownNotesContext)
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

	const { blueprint, blueprintId } = loadShowStyleBlueprint(showStyle.base)

	_.each(ingestRundown.segments, (ingestSegment: IngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = _.find(existingSegments, (s) => s._id === segmentId)
		const existingParts = existingRundownParts.filter((p) => p.segmentId === segmentId)

		ingestSegment.parts = _.sortBy(ingestSegment.parts, (part) => part.rank)

		const notesContext = new NotesContext(ingestSegment.name, `rundownId=${rundownId},segmentId=${segmentId}`, true)
		const context = new SegmentContext(dbRundown, cache, notesContext)
		const res = blueprint.getSegment(context, ingestSegment)

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
	let prepareSaveSegments = prepareSaveIntoCache(
		cache.Segments,
		{
			rundownId: rundownId,
		},
		segments
	)
	let prepareSaveParts = prepareSaveIntoCache(
		cache.Parts,
		{
			rundownId: rundownId,
		},
		parts
	)
	let prepareSavePieces = prepareSaveIntoCache(
		cache.Pieces,
		{
			startRundownId: rundownId,
		},
		segmentPieces
	)
	let prepareSaveAdLibPieces = prepareSaveIntoCache<AdLibPiece, AdLibPiece>(
		cache.AdLibPieces,
		{
			rundownId: rundownId,
		},
		adlibPieces
	)
	const prepareSaveAdLibActions = prepareSaveIntoCache<AdLibAction, AdLibAction>(
		cache.AdLibActions,
		{
			rundownId: rundownId,
		},
		adlibActions
	)

	if (Settings.allowUnsyncedSegments) {
		if (
			!isUpdateAllowed(
				cache,
				dbPlaylist,
				dbRundown,
				{ changed: [dbRundown] },
				prepareSaveSegments,
				prepareSaveParts
			)
		) {
			ServerRundownAPI.unsyncRundownInner(cache, dbRundown._id)
			waitForPromise(cache.saveAllToDatabase())
			return false
		} else {
			const segmentChanges: SegmentChanges[] = splitIntoSegments(
				prepareSaveSegments,
				prepareSaveParts,
				prepareSavePieces,
				prepareSaveAdLibPieces
			)
			const approvedSegmentChanges: SegmentChanges[] = []
			_.each(segmentChanges, (segmentChange) => {
				if (
					isUpdateAllowed(
						cache,
						dbPlaylist,
						dbRundown,
						{ changed: [dbRundown] },
						segmentChange.segment,
						segmentChange.parts
					)
				) {
					approvedSegmentChanges.push(segmentChange)
				} else {
					ServerRundownAPI.unsyncSegmentInner(cache, rundownId, segmentChange.segmentId)
				}
			})

			prepareSaveSegments = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			prepareSaveParts = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			prepareSavePieces = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			prepareSaveAdLibPieces = {
				inserted: [],
				changed: [],
				removed: [],
				unchanged: [],
			}

			approvedSegmentChanges.forEach((segmentChange) => {
				for (const key in prepareSaveSegments) {
					prepareSaveSegments[key].push(...segmentChange.segment[key])
					prepareSaveParts[key].push(...segmentChange.parts[key])
					prepareSavePieces[key].push(...segmentChange.pieces[key])
					prepareSaveAdLibPieces[key].push(...segmentChange.adlibPieces[key])
				}
			})
		}
	} else {
		// determine if update is allowed here
		if (
			!isUpdateAllowed(
				cache,
				dbPlaylist,
				dbRundown,
				{ changed: [dbRundown] },
				prepareSaveSegments,
				prepareSaveParts
			)
		) {
			ServerRundownAPI.unsyncRundownInner(cache, dbRundown._id)
			waitForPromise(cache.saveAllToDatabase())
			return false
		}
	}

	const rundownBaselineChanges = sumChanges(
		saveIntoDb<RundownBaselineObj, RundownBaselineObj>(
			RundownBaselineObjs,
			{
				rundownId: dbRundown._id,
			},
			[baselineObj]
		),
		// Save the global adlibs
		saveIntoDb<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(
			RundownBaselineAdLibPieces,
			{
				rundownId: dbRundown._id,
			},
			baselineAdlibPieces
		),
		saveIntoDb<RundownBaselineAdLibAction, RundownBaselineAdLibAction>(
			RundownBaselineAdLibActions,
			{
				rundownId: dbRundown._id,
			},
			baselineAdlibActions
		)
	)
	if (anythingChanged(rundownBaselineChanges)) {
		// If any of the rundown baseline datas was modified, we'll update the baselineModifyHash of the rundown
		cache.Rundowns.update(dbRundown._id, {
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

		savePreparedChangesIntoCache<AdLibAction, AdLibAction>(prepareSaveAdLibActions, cache.AdLibActions, {
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
		savePreparedChangesIntoCache<AdLibPiece, AdLibPiece>(prepareSaveAdLibPieces, cache.AdLibPieces, {
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
				afterRemoveParts(cache, rundownId, parts)
			},
		}),

		// Update Segments:
		savePreparedChangesIntoCache(prepareSaveSegments, cache.Segments, {
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
					rundownId,
					_.map(segments, (s) => s._id)
				)
			},
		})
	)

	const didChange = anythingChanged(allChanges)
	if (didChange) {
		afterIngestChangedData(
			cache,
			dbRundown,
			_.map(segments, (s) => s._id)
		)

		reportRundownDataHasChanged(cache, dbPlaylist, dbRundown)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)
	waitForPromise(cache.saveAllToDatabase())
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
		if (rundownOrder !== undefined) {
			r.playlistId = playlist._id
			r._rank = rundownOrder
		} else {
			// an unranked Rundown is essentially "floated" - it is a part of the playlist, but it shouldn't be visible in the UI
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
					ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
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
	return rundownIngestSyncFunction(
		peripheralDevice,
		rundownExternalId,
		(cache) => {
			const rundown = getRundown2(cache)
			const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
			const segment = cache.Segments.findOne(segmentId) // Note: undefined is valid here, as it means this is a new segment
			// Nothing to precompute
			if (!canBeUpdated(rundown, segment)) return

			// TODO-CACHE defer
			saveSegmentCache(rundown._id, segmentId, makeNewIngestSegment(ingestSegment))

			const blueprint = loadShowStyleBlueprint(getShowStyleBaseIngest(cache))
			const updatedSegmentId = updateSegmentFromIngestData(cache, blueprint, ingestSegment)
			if (updatedSegmentId) {
				afterIngestChangedData(cache, [updatedSegmentId])
			}
		},
		(cache, playoutInfo) => {
			// TODO
		}
	)
}
export function updateSegmentsFromIngestData(cache: CacheForIngest, ingestSegments: IngestSegment[]) {
	const changedSegmentIds: SegmentId[] = []
	if (ingestSegments.length > 0) {
		const blueprint = loadShowStyleBlueprint(getShowStyleBaseIngest(cache))
		for (let ingestSegment of ingestSegments) {
			const segmentId = updateSegmentFromIngestData(cache, blueprint, ingestSegment)
			if (segmentId !== null) {
				changedSegmentIds.push(segmentId)
			}
		}
		if (changedSegmentIds.length > 0) {
			afterIngestChangedData(cache, changedSegmentIds)
		}
	}
}
/**
 * Run ingestData through blueprints and update the Segment
 * @param cache
 * @param ingestSegment
 * @returns a segmentId if data has changed, null otherwise
 */
function updateSegmentFromIngestData(
	cache: CacheForIngest,
	wrappedBlueprint: WrappedShowStyleBlueprint,
	ingestSegment: IngestSegment
): SegmentId | null {
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
	const context = new SegmentContext(rundown, cache, notesContext)
	const res = wrappedBlueprint.blueprint.getSegment(context, ingestSegment)

	const { parts, segmentPieces, adlibPieces, adlibActions, newSegment } = generateSegmentContents(
		context,
		wrappedBlueprint.blueprintId,
		ingestSegment,
		existingSegment,
		existingParts,
		res
	)

	const prepareSaveParts = prepareSaveIntoCache<Part, DBPart>(
		cache.Parts,
		{
			$or: [
				{
					// The parts in this Segment:
					segmentId: segmentId,
				},
				{
					// Move over parts from other segments
					_id: { $in: _.pluck(parts, '_id') },
				},
			],
			dynamicallyInsertedAfterPartId: { $exists: false }, // do not affect dynamically inserted parts (such as adLib parts)
		},
		parts
	)
	const prepareSavePieces = prepareSaveIntoCache<Piece, Piece>(
		cache.Pieces,
		{
			startPartId: { $in: parts.map((p) => p._id) },
		},
		segmentPieces
	)

	const prepareSaveAdLibPieces = prepareSaveIntoCache<AdLibPiece, AdLibPiece>(
		cache.AdLibPieces,
		{
			partId: { $in: parts.map((p) => p._id) },
		},
		adlibPieces
	)
	const prepareSaveAdLibActions = prepareSaveIntoCache<AdLibAction, AdLibAction>(
		cache.AdLibActions,
		{
			partId: { $in: parts.map((p) => p._id) },
		},
		adlibActions
	)

	// determine if update is allowed here
	if (!isUpdateAllowed(cache, playlist, rundown, {}, { changed: [newSegment] }, prepareSaveParts)) {
		ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
		return null
	}

	// Update segment info:
	cache.Segments.upsert(
		{
			_id: segmentId,
		},
		newSegment
	)

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
		savePreparedChangesIntoCache<AdLibPiece, AdLibPiece>(prepareSaveAdLibPieces, cache.AdLibPieces, {
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
		savePreparedChangesIntoCache<AdLibAction, AdLibAction>(prepareSaveAdLibActions, cache.AdLibActions, {
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

	return anythingChanged(changes) ? segmentId : null
}
function afterIngestChangedData(cache: CacheForIngest, changedSegmentIds: SegmentId[]) {
	// To be called after rundown has been changed
	updateExpectedMediaItemsOnRundown(cache)
	updateExpectedPlayoutItemsOnRundown(cache)

	updatePartRanks(cache, playlist, changedSegmentIds)

	UpdateNext.ensureNextPartIsValid(cache, playlist)

	triggerUpdateTimelineAfterIngestData(rundown.playlistId)
}

export function handleRemovedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	partExternalId: string
) {
	return rundownIngestSyncFunction(
		peripheralDevice,
		rundownExternalId,
		() => {
			// TODO - some should be moved here...
		},
		(cache, playoutInfo) => {
			const rundown = getRundown2(cache)
			const segmentId = getSegmentId(rundown._id, segmentExternalId)
			const partId = getPartId(rundown._id, partExternalId)
			const segment = getSegment2(cache, segmentId)

			if (canBeUpdated(rundown, segment, partId)) {
				const part = cache.Parts.findOne({
					_id: partId,
					segmentId: segmentId,
				})
				if (!part) throw new Meteor.Error(404, 'Part not found')

				if (!isUpdateAllowed(playoutInfo, rundown, {}, {}, { removed: [part] })) {
					ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
				} else {
					// Blueprints will handle the deletion of the Part
					const ingestSegment = loadCachedIngestSegment(
						rundown._id,
						rundownExternalId,
						segmentId,
						segmentExternalId
					)
					ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partExternalId)
					ingestSegment.modified = getCurrentTime()

					// TODO-CACHE defer
					saveSegmentCache(rundown._id, segmentId, ingestSegment)

					const blueprint = loadShowStyleBlueprint(getShowStyleBaseIngest(cache))
					const updatedSegmentId = updateSegmentFromIngestData(cache, blueprint, ingestSegment)
					if (updatedSegmentId) {
						afterIngestChangedData(cache, [updatedSegmentId])
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
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)
	const playlistId = getRundown(rundownId, rundownExternalId).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const playlist = getRundownPlaylist(rundown)

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
		handleUpdatedPartInner(cache, studio, playlist, rundown, segmentExternalId, ingestPart)

		waitForPromise(cache.saveAllToDatabase())
	})
}
export function handleUpdatedPartInner(
	cache: CacheForRundownPlaylist,
	studio: Studio,
	playlist: RundownPlaylist,
	rundown: Rundown,
	segmentExternalId: string,
	ingestPart: IngestPart
) {
	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	const partId = getPartId(rundown._id, ingestPart.externalId)
	const segment = cache.Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)

	if (!canBeUpdated(rundown, segment, partId)) return

	const part = cache.Parts.findOne({
		_id: partId,
		segmentId: segmentId,
		rundownId: rundown._id,
	})

	if (part && !isUpdateAllowed(cache, playlist, rundown, {}, {}, { changed: [part] })) {
		ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
	} else {
		// Blueprints will handle the creation of the Part
		const ingestSegment: LocalIngestSegment = loadCachedIngestSegment(
			rundown._id,
			rundown.externalId,
			segmentId,
			segmentExternalId
		)
		ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== ingestPart.externalId)
		ingestSegment.parts.push(makeNewIngestPart(ingestPart))
		ingestSegment.modified = getCurrentTime()

		cache.defer(() => {
			saveSegmentCache(rundown._id, segmentId, ingestSegment)
		})
		const updatedSegmentId = updateSegmentFromIngestData(cache, studio, playlist, rundown, ingestSegment)
		if (updatedSegmentId) {
			afterIngestChangedData(cache, rundown, [updatedSegmentId])
		}
	}
}

function generateSegmentContents(
	context: SegmentContext,
	blueprintId: BlueprintId,
	ingestSegment: IngestSegment,
	existingSegment: DBSegment | undefined,
	existingParts: DBPart[],
	blueprintRes: BlueprintResultSegment
) {
	const rundownId = context._rundown._id
	const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
	const rawNotes = context.notesContext.getNotes()

	// Ensure all parts have a valid externalId set on them
	const knownPartIds = blueprintRes.parts.map((p) => p.part.externalId)

	const rawSegmentNotes = _.filter(
		rawNotes,
		(note) => !note.trackingId || knownPartIds.indexOf(note.trackingId) === -1
	)
	const segmentNotes = _.map(rawSegmentNotes, (note) =>
		literal<SegmentNote>({
			type: note.type,
			message: note.message,
			origin: {
				name: '', // TODO
			},
		})
	)

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

		const partRawNotes = _.filter(rawNotes, (note) => note.trackingId === blueprintPart.part.externalId)
		const notes = _.map(partRawNotes, (note) =>
			literal<PartNote>({
				type: note.type,
				message: note.message,
				origin: {
					name: '', // TODO
				},
			})
		)

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
	prepareSaveAdLibPieces: PreparedChanges<AdLibPiece>
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
	}
}
