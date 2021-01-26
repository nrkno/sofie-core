import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import * as _ from 'underscore'
import { PeripheralDevice, PeripheralDeviceId, getExternalNRCSName } from '../../../lib/collections/PeripheralDevices'
import { Rundown, Rundowns, DBRundown, RundownId } from '../../../lib/collections/Rundowns'
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
	getRandomId,
	PreparedChanges,
	unprotectObject,
	unprotectObjectArray,
	clone,
	normalizeArrayToMap,
	omit,
	asyncSaveIntoDb,
	waitForPromiseAll,
} from '../../../lib/lib'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	BlueprintResultSegment,
	BlueprintResultOrderedRundowns,
	BlueprintSyncIngestPartInstance,
	ShowStyleBlueprintManifest,
	BlueprintSyncIngestNewData,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio, Studios } from '../../../lib/collections/Studios'
import {
	selectShowStyleVariant,
	afterRemoveParts,
	ServerRundownAPI,
	updatePartInstanceRanks,
	produceRundownPlaylistInfoFromRundown,
	allowedToMoveRundownOutOfPlaylist,
	getAllRundownsInPlaylist,
	sortDefaultRundownInPlaylistOrder,
	ChangedSegmentsRankInfo,
	removeSegmentContents,
	unsyncAndEmptySegment,
} from '../rundown'
import { loadShowStyleBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import {
	ShowStyleContext,
	RundownContext,
	SegmentContext,
	NotesContext,
	SyncIngestUpdateToPartInstanceContext,
} from '../blueprints/context'
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
	canRundownBeUpdated,
	canSegmentBeUpdated,
	getRundownPlaylist,
	getSegment,
	checkAccessAndGetPeripheralDevice,
	extendIngestRundownCore,
	modifyPlaylistExternalId,
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
import {
	isTooCloseToAutonext,
	getSelectedPartInstancesFromCache,
	getRundownsSegmentsAndPartsFromCache,
	removeRundownFromCache,
} from '../playout/lib'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { MethodContext } from '../../../lib/api/methods'
import { CacheForRundownPlaylist, initCacheForRundownPlaylist } from '../../DatabaseCaches'
import { prepareSaveIntoCache, saveIntoCache, savePreparedChangesIntoCache } from '../../DatabaseCache'
import { reportRundownDataHasChanged } from '../asRunLog'
import { Settings } from '../../../lib/Settings'
import { AdLibAction } from '../../../lib/collections/AdLibActions'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { removeEmptyPlaylists } from '../rundownPlaylist'
import { profiler } from '../profiler'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites'
import { IngestDataCache } from '../../../lib/collections/IngestDataCache'

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
export function rundownPlaylistSyncFunction<T extends () => any>(
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	context: string,
	fcn: T
): ReturnType<T> {
	return syncFunction(fcn, context, `ingest_rundown_${rundownPlaylistId}`, undefined, priority)()
}

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
		handleUpdatedRundown(undefined, peripheralDevice, ingestRundown, true)
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
		handleUpdatedRundown(undefined, peripheralDevice, ingestRundown, false)
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
		return getIngestSegment(peripheralDevice, rundownExternalId, segmentExternalId)
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
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment, true)
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
		handleUpdatedSegment(peripheralDevice, rundownExternalId, ingestSegment, false)
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
function getIngestSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string
): IngestSegment {
	const rundown = Rundowns.findOne({
		peripheralDeviceId: peripheralDevice._id,
		externalId: rundownExternalId,
	})
	if (!rundown) {
		throw new Meteor.Error(404, `Rundown ${rundownExternalId} does not exist`)
	}

	const segment = Segments.findOne({
		externalId: segmentExternalId,
		rundownId: rundown._id,
	})

	if (!segment) {
		throw new Meteor.Error(404, `Segment ${segmentExternalId} does not exist in rundown ${rundownExternalId}`)
	}

	return loadCachedIngestSegment(rundown._id, rundown.externalId, segment._id, segment.externalId)
}
function listIngestRundowns(peripheralDevice: PeripheralDevice): string[] {
	const rundowns = Rundowns.find({
		peripheralDeviceId: peripheralDevice._id,
	}).fetch()

	return rundowns.map((r) => r.externalId)
}

export function handleRemovedRundown(peripheralDevice: PeripheralDevice, rundownExternalId: string) {
	const span = profiler.startSpan('rundownInput.handleRemovedRundown')

	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)
	const rundownPlaylistId = getRundown(rundownId, rundownExternalId).playlistId

	rundownPlaylistSyncFunction(rundownPlaylistId, RundownSyncFunctionPriority.INGEST, 'handleRemovedRundown', () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const playlist = getRundownPlaylist(rundown)

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

		if (!canRundownBeUpdated(rundown, false)) {
			// Rundown is already deleted
		} else if (!allowedToMoveRundownOutOfPlaylist(playlist, rundown)) {
			// Don't allow removing currently playing rundown playlists:
			logger.warn(
				`Not allowing removal of currently playing rundown "${rundown._id}", making it unsynced instead`
			)
			ServerRundownAPI.unsyncRundownInner(cache, rundown._id)
		} else {
			logger.info(`Removing rundown "${rundown._id}"`)
			removeRundownFromCache(cache, rundown)
		}

		waitForPromise(cache.saveAllToDatabase())
		span?.end()
	})
}
/** Handle an updated (or inserted) Rundown */
export function handleUpdatedRundown(
	studio0: Studio | undefined,
	peripheralDevice: PeripheralDevice | undefined,
	ingestRundown: IngestRundown,
	isCreateAction: boolean
) {
	if (!peripheralDevice && !studio0) {
		throw new Meteor.Error(500, `A PeripheralDevice or Studio is required to update a rundown`)
	}

	const studio = studio0 ?? getStudioFromDevice(peripheralDevice as PeripheralDevice)
	const rundownId = getRundownId(studio, ingestRundown.externalId)
	if (peripheralDevice && peripheralDevice.studioId !== studio._id) {
		throw new Meteor.Error(
			500,
			`PeripheralDevice "${peripheralDevice._id}" does not belong to studio "${studio._id}"`
		)
	}

	// Lock behind a playlist if it exists
	const existingRundown = Rundowns.findOne(rundownId)
	const playlistId = existingRundown ? existingRundown.playlistId : protectString('newPlaylist')
	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleUpdatedRundown', () =>
		handleUpdatedRundownInner(
			studio,
			rundownId,
			makeNewIngestRundown(ingestRundown),
			isCreateAction,
			peripheralDevice
		)
	)
}
export function handleUpdatedRundownInner(
	studio: Studio,
	rundownId: RundownId,
	ingestRundown: IngestRundown | LocalIngestRundown,
	isCreateAction: boolean,
	peripheralDevice?: PeripheralDevice
) {
	const existingDbRundown = Rundowns.findOne(rundownId)
	if (!canRundownBeUpdated(existingDbRundown, isCreateAction)) return

	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	const newIngestRundown = isLocalIngestRundown(ingestRundown) ? ingestRundown : makeNewIngestRundown(ingestRundown)

	saveRundownCache(rundownId, newIngestRundown)

	updateRundownFromIngestData(studio, existingDbRundown, ingestRundown, peripheralDevice)
}
export function regenerateRundown(rundownId: RundownId) {
	const span = profiler.startSpan('ingest.rundownInput.regenerateRundown')

	logger.info(`Regenerating rundown ${rundownId}`)
	const existingDbRundown = Rundowns.findOne(rundownId)
	if (!existingDbRundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)

	const studio = Studios.findOne(existingDbRundown.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio "${existingDbRundown.studioId}" not found`)

	return rundownPlaylistSyncFunction(
		existingDbRundown.playlistId,
		RundownSyncFunctionPriority.INGEST,
		'handleUpdatedRundown',
		() => {
			// Reload to ensure it isnt stale
			const existingDbRundown2 = Rundowns.findOne(rundownId)
			if (!existingDbRundown2) throw new Meteor.Error(404, `Rundown "${rundownId}" not found`)

			const ingestRundown = loadCachedRundownData(rundownId, existingDbRundown2.externalId)

			updateRundownFromIngestData(studio, existingDbRundown2, ingestRundown, undefined)

			span?.end()
		}
	)
}
function updateRundownFromIngestData(
	studio: Studio,
	existingDbRundown: Rundown | undefined,
	ingestRundown: IngestRundown,
	peripheralDevice?: PeripheralDevice
): boolean {
	const span = profiler.startSpan('ingest.rundownInput.updateRundownFromIngestData')

	// canBeUpdated is run by the callers

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, existingDbRundown)
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

	const dbRundownData: DBRundown = _.extend(
		_.clone(existingDbRundown) || {},
		_.omit(
			literal<DBRundown>({
				...rundownRes.rundown,
				notes: rundownNotes,
				_id: rundownId,
				externalId: ingestRundown.externalId,
				organizationId: studio.organizationId,
				studioId: studio._id,
				showStyleVariantId: showStyle.variant._id,
				showStyleBaseId: showStyle.base._id,
				orphaned: undefined,

				importVersions: {
					studio: studio._rundownVersionHash,
					showStyleBase: showStyle.base._rundownVersionHash,
					showStyleVariant: showStyle.variant._rundownVersionHash,
					blueprint: showStyleBlueprintDb.blueprintVersion,
					core: PackageInfo.versionExtended || PackageInfo.version,
				},

				// omit the below fields:
				created: 0, // omitted, set later, below
				modified: 0, // omitted, set later, below
				peripheralDeviceId: protectString(''), // omitted, set later, below
				externalNRCSName: '', // omitted, set later, below
				playlistId: protectString<RundownPlaylistId>(''), // omitted, set later, in produceRundownPlaylistInfo
				_rank: 0, // omitted, set later, in produceRundownPlaylistInfo
			}),
			['created', 'modified', 'peripheralDeviceId', 'externalNRCSName', 'playlistId', '_rank']
		)
	)
	if (peripheralDevice) {
		dbRundownData.peripheralDeviceId = peripheralDevice._id
		dbRundownData.externalNRCSName = getExternalNRCSName(peripheralDevice)
	} else {
		if (!dbRundownData.externalNRCSName) {
			dbRundownData.externalNRCSName = getExternalNRCSName(undefined)
		}
	}

	// Do a check if we're allowed to move out of currently playing playlist:
	if (existingDbRundown && existingDbRundown.playlistExternalId !== dbRundownData.playlistExternalId) {
		// The rundown is going to change playlist
		const existingPlaylist = RundownPlaylists.findOne(existingDbRundown.playlistId)
		if (existingPlaylist) {
			if (!allowedToMoveRundownOutOfPlaylist(existingPlaylist, existingDbRundown)) {
				// The rundown contains a PartInstance that is currently on air.
				// We're trying for a "soft approach" here, instead of rejecting the change altogether,
				// and will just revert the playlist change:

				dbRundownData.playlistExternalId = existingDbRundown.playlistExternalId
				dbRundownData.playlistId = existingDbRundown.playlistId

				if (!dbRundownData.notes) dbRundownData.notes = []
				dbRundownData.notes.push({
					type: NoteType.WARNING,
					message: `The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.`,
					origin: {
						name: 'Data update',
					},
				})

				logger.warn(
					`Blocking moving rundown "${existingDbRundown._id}" out of playlist "${existingDbRundown.playlistId}"`
				)
			}
		} else {
			logger.warn(`Existing playlist "${existingDbRundown.playlistId}" not found`)
		}
	}

	const rundownPlaylistInfo = produceRundownPlaylistInfoFromRundown(studio, dbRundownData, peripheralDevice)
	dbRundownData.playlistId = rundownPlaylistInfo.rundownPlaylist._id

	// Save rundown into database:
	const rundownChanges = saveIntoDb(
		Rundowns,
		{
			_id: dbRundownData._id,
		},
		[dbRundownData],
		{
			beforeInsert: (o) => {
				o.modified = getCurrentTime()
				o.created = getCurrentTime()
				return o
			},
			beforeUpdate: (o) => {
				o.modified = getCurrentTime()
				return o
			},
		}
	)

	const playlistChanges = saveIntoDb(
		RundownPlaylists,
		{
			_id: rundownPlaylistInfo.rundownPlaylist._id,
		},
		[rundownPlaylistInfo.rundownPlaylist],
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

	const dbRundown = Rundowns.findOne(dbRundownData._id)
	if (!dbRundown) throw new Meteor.Error(500, 'Rundown not found (it should have been)')

	updateRundownsInPlaylist(rundownPlaylistInfo.rundownPlaylist, rundownPlaylistInfo.order, dbRundown)
	removeEmptyPlaylists(studio._id)

	const dbPlaylist = dbRundown.getRundownPlaylist()
	if (!dbPlaylist) throw new Meteor.Error(500, 'RundownPlaylist not found (it should have been)')

	const cache = waitForPromise(initCacheForRundownPlaylist(dbPlaylist))

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

	const segmentsAndParts = getRundownsSegmentsAndPartsFromCache(cache, [dbRundown])
	const existingRundownParts = _.groupBy(segmentsAndParts.parts, (part) => part.segmentId)
	const existingSegments = normalizeArrayToMap(segmentsAndParts.segments, '_id')

	const newSegments: DBSegment[] = []
	const newParts: DBPart[] = []
	const newPieces: Piece[] = []
	const newAdlibPieces: AdLibPiece[] = []
	const newAdlibActions: AdLibAction[] = []

	const { blueprint, blueprintId } = loadShowStyleBlueprint(showStyle.base)

	_.each(ingestRundown.segments, (ingestSegment: LocalIngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = existingSegments.get(segmentId)
		const existingParts = existingRundownParts[unprotectString(segmentId)] || []

		// Future: if canUpdateSegment ever does anything more than checking for allowed deletion, it should be done here.
		// That introduces some logic complexities, as what if a part is moved between segments?

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

		newSegments.push(segmentContents.newSegment)
		newParts.push(...segmentContents.parts)
		newPieces.push(...segmentContents.segmentPieces)
		newAdlibPieces.push(...segmentContents.adlibPieces)
		newAdlibActions.push(...segmentContents.adlibActions)
	})

	const removedSegments = cache.Segments.findFetch({ _id: { $nin: newSegments.map((s) => s._id) } })
	const retainSegments = new Set<SegmentId>()
	for (const oldSegment of removedSegments) {
		if (!canRemoveSegment(cache, dbPlaylist, oldSegment)) {
			newSegments.push({
				...oldSegment,
				orphaned: 'deleted',
			})
			retainSegments.add(oldSegment._id)
		}
	}

	// TODO - rename this setting
	if (Settings.allowUnsyncedSegments && retainSegments.size > 0) {
		// Preserve any old content, unless the part is referenced in another segment
		const newPartIds = new Set(newParts.map((p) => p._id))
		const oldParts = cache.Parts.findFetch((p) => retainSegments.has(p.segmentId) && !newPartIds.has(p._id))
		newParts.push(...oldParts)

		const oldPartIds = new Set(oldParts.map((p) => p._id))
		newPieces.push(...cache.Pieces.findFetch((p) => oldPartIds.has(p.startPartId)))
		newAdlibPieces.push(...cache.AdLibPieces.findFetch((p) => p.partId && oldPartIds.has(p.partId)))
		newAdlibActions.push(...cache.AdLibActions.findFetch((p) => p.partId && oldPartIds.has(p.partId)))
	}

	const rundownBaselineChanges = sumChanges(
		...waitForPromiseAll([
			asyncSaveIntoDb<RundownBaselineObj, RundownBaselineObj>(
				RundownBaselineObjs,
				{
					rundownId: dbRundown._id,
				},
				[baselineObj]
			),
			// Save the global adlibs
			asyncSaveIntoDb<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(
				RundownBaselineAdLibPieces,
				{
					rundownId: dbRundown._id,
				},
				baselineAdlibPieces
			),
			asyncSaveIntoDb<RundownBaselineAdLibAction, RundownBaselineAdLibAction>(
				RundownBaselineAdLibActions,
				{
					rundownId: dbRundown._id,
				},
				baselineAdlibActions
			),
		])
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

		saveIntoCache<Piece, Piece>(
			cache.Pieces,
			{
				rundownId: rundownId,
			},
			newPieces,
			{
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
			}
		),

		saveIntoCache<AdLibAction, AdLibAction>(
			cache.AdLibActions,
			{
				rundownId: rundownId,
			},
			newAdlibActions,
			{
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
			}
		),
		saveIntoCache<AdLibPiece, AdLibPiece>(
			cache.AdLibPieces,
			{
				rundownId: rundownId,
			},
			newAdlibPieces,
			{
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
			}
		),
		saveIntoCache<Part, DBPart>(
			cache.Parts,
			{
				rundownId: rundownId,
			},
			newParts,
			{
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
			}
		),

		// Update Segments:
		saveIntoCache(
			cache.Segments,
			{
				rundownId: rundownId,
			},
			newSegments,
			{
				afterInsert(segment) {
					logger.info('inserted segment ' + segment._id)
				},
				afterUpdate(segment) {
					logger.info('updated segment ' + segment._id)
				},
				afterRemove(segment) {
					logger.info('removed segment ' + segment._id)
				},
			}
		)
	)

	const didChange = anythingChanged(allChanges)
	if (didChange) {
		afterIngestChangedData(
			cache,
			blueprint,
			dbRundown,
			newSegments.map((s) => ({
				segmentId: s._id,
				oldPartIdsAndRanks: (existingRundownParts[unprotectString(s._id)] || []).map((p) => ({
					id: p._id,
					rank: p._rank,
				})),
			}))
		)

		reportRundownDataHasChanged(cache, dbPlaylist, dbRundown)
	}

	logger.info(`Rundown ${dbRundown._id} update complete`)
	waitForPromise(cache.saveAllToDatabase())

	span?.end()
	return didChange
}

/** Set _rank and playlistId of rundowns in a playlist */
export function updateRundownsInPlaylist(
	playlist: DBRundownPlaylist,
	rundownRanks: BlueprintResultOrderedRundowns,
	currentRundown?: DBRundown
) {
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
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)
	const playlistId = getRundown(rundownId, rundownExternalId).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleRemovedSegment', () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const playlist = getRundownPlaylist(rundown)
		const segmentId = getSegmentId(rundown._id, segmentExternalId)

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

		const segment = cache.Segments.findOne(segmentId)
		if (!segment) throw new Meteor.Error(404, `handleRemovedSegment: Segment "${segmentId}" not found`)

		if (!canSegmentBeUpdated(rundown, segment, false)) {
			// segment has already been deleted
		} else {
			if (!canRemoveSegment(cache, playlist, segment)) {
				unsyncAndEmptySegment(cache, rundownId, segmentId)
			} else {
				cache.defer(() => {
					IngestDataCache.remove({
						segmentId: segmentId,
						rundownId: rundownId,
					})
				})

				cache.Segments.remove(segmentId)
				removeSegmentContents(cache, rundownId, [segmentId])

				UpdateNext.ensureNextPartIsValid(cache, playlist)
			}
		}

		waitForPromise(cache.saveAllToDatabase())
	})
}
export function handleUpdatedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	ingestSegment: IngestSegment,
	isCreateAction: boolean
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)
	const playlistId = getRundown(rundownId, rundownExternalId).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleUpdatedSegment', () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const playlist = getRundownPlaylist(rundown)

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

		const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
		const oldSegment = cache.Segments.findOne(segmentId)
		if (!canSegmentBeUpdated(rundown, oldSegment, isCreateAction)) return

		const localIngestSegment = makeNewIngestSegment(ingestSegment)
		cache.defer(() => {
			// can we do this?
			saveSegmentCache(rundown._id, segmentId, localIngestSegment)
		})

		const blueprint = loadShowStyleBlueprint(waitForPromise(cache.activationCache.getShowStyleBase(rundown)))

		const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = updateSegmentFromIngestData(
			cache,
			blueprint,
			playlist,
			rundown,
			localIngestSegment
		)
		if (updatedSegmentId) {
			afterIngestChangedData(cache, blueprint.blueprint, rundown, [
				{ segmentId: updatedSegmentId, oldPartIdsAndRanks },
			])
		}

		waitForPromise(cache.saveAllToDatabase())
	})
}
export function updateSegmentsFromIngestData(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	rundown: Rundown,
	ingestSegments: LocalIngestSegment[]
) {
	if (ingestSegments.length > 0) {
		const blueprint = loadShowStyleBlueprint(waitForPromise(cache.activationCache.getShowStyleBase(rundown)))

		const changedSegments: ChangedSegmentsRankInfo = []
		for (let ingestSegment of ingestSegments) {
			const { segmentId, oldPartIdsAndRanks } = updateSegmentFromIngestData(
				cache,
				blueprint,
				playlist,
				rundown,
				ingestSegment
			)
			if (segmentId !== null) {
				changedSegments.push({ segmentId, oldPartIdsAndRanks })
			}
		}
		if (changedSegments.length > 0) {
			afterIngestChangedData(cache, blueprint.blueprint, rundown, changedSegments)
		}
	}
}
/**
 * Run ingestData through blueprints and update the Segment
 * @param cache
 * @param studio
 * @param rundown
 * @param ingestSegment
 * @returns a segmentId if data has changed, null otherwise
 */
function updateSegmentFromIngestData(
	cache: CacheForRundownPlaylist,
	blueprint: WrappedShowStyleBlueprint,
	playlist: RundownPlaylist,
	rundown: Rundown,
	ingestSegment: LocalIngestSegment
): {
	segmentId: SegmentId | null
	oldPartIdsAndRanks: Array<{ id: PartId; rank: number }>
} {
	const span = profiler.startSpan('ingest.rundownInput.updateSegmentFromIngestData')
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)

	const existingSegment = cache.Segments.findOne({
		_id: segmentId,
		rundownId: rundown._id,
	})
	// The segment may not yet exist (if it had its id changed), so we need to fetch the old ones manually
	const existingParts = cache.Parts.findFetch({
		rundownId: rundown._id,
		segmentId: segmentId,
	})

	ingestSegment.parts = _.sortBy(ingestSegment.parts, (s) => s.rank)

	const notesContext = new NotesContext(ingestSegment.name, `rundownId=${rundown._id},segmentId=${segmentId}`, true)
	const context = new SegmentContext(rundown, cache, notesContext)
	const blueprintSegment = blueprint.blueprint.getSegment(context, ingestSegment)

	const { parts, segmentPieces, adlibPieces, adlibActions, newSegment } = generateSegmentContents(
		context,
		blueprint.blueprintId,
		ingestSegment,
		existingSegment,
		existingParts,
		blueprintSegment
	)

	const prepareSaveParts = prepareSaveIntoCache<Part, DBPart>(
		cache.Parts,
		{
			rundownId: rundown._id,
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
		},
		parts
	)
	const prepareSavePieces = prepareSaveIntoCache<Piece, Piece>(
		cache.Pieces,
		{
			startRundownId: rundown._id,
			startPartId: { $in: parts.map((p) => p._id) },
		},
		segmentPieces
	)

	const prepareSaveAdLibPieces = prepareSaveIntoCache<AdLibPiece, AdLibPiece>(
		cache.AdLibPieces,
		{
			rundownId: rundown._id,
			partId: { $in: parts.map((p) => p._id) },
		},
		adlibPieces
	)
	const prepareSaveAdLibActions = prepareSaveIntoCache<AdLibAction, AdLibAction>(
		cache.AdLibActions,
		{
			rundownId: rundown._id,
			partId: { $in: parts.map((p) => p._id) },
		},
		adlibActions
	)

	// Update segment info:
	cache.Segments.upsert(
		{
			_id: segmentId,
			rundownId: rundown._id,
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

	const oldPartIdsAndRanks = existingParts.map((p) => ({ id: p._id, rank: p._rank }))
	span?.end()
	return { segmentId: anythingChanged(changes) ? segmentId : null, oldPartIdsAndRanks }
}
function syncChangesToPartInstances(
	cache: CacheForRundownPlaylist,
	blueprint: ShowStyleBlueprintManifest,
	playlist: RundownPlaylist,
	rundown: Rundown
) {
	if (playlist.active) {
		if (blueprint.syncIngestUpdateToPartInstance) {
			const { previousPartInstance, currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(
				cache,
				playlist
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
					const referencedAdlibs = cache.AdLibPieces.findFetch({ _id: { $in: referencedAdlibIds } })

					const adlibPieces = cache.AdLibPieces.findFetch({ partId: partId })
					const adlibActions = cache.AdLibActions.findFetch({ partId: partId })

					const proposedPieceInstances = getPieceInstancesForPart(
						cache,
						playlist,
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
						rundown,
						cache,
						new NotesContext(
							`Update to ${newPart.externalId}`,
							`rundownId=${newPart.rundownId},segmentId=${newPart.segmentId}`,
							true
						),
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
					for (const note of syncContext.notesContext.getNotes()) {
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

					if (existingPartInstance._id === playlist.currentPartInstanceId) {
						// This should be run after 'current', before 'next':
						syncPlayheadInfinitesForNextPartInstance(cache, playlist)
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
function afterIngestChangedData(
	cache: CacheForRundownPlaylist,
	blueprint: ShowStyleBlueprintManifest,
	rundown: Rundown,
	changedSegments: ChangedSegmentsRankInfo
) {
	const playlist = cache.RundownPlaylists.findOne({ _id: rundown.playlistId })
	if (!playlist) {
		throw new Meteor.Error(404, `Orphaned rundown ${rundown._id}`)
	}

	// To be called after rundown has been changed
	updateExpectedMediaItemsOnRundown(cache, rundown._id)
	updateExpectedPlayoutItemsOnRundown(cache, rundown._id)

	updatePartInstanceRanks(cache, playlist, changedSegments)

	UpdateNext.ensureNextPartIsValid(cache, playlist)

	syncChangesToPartInstances(cache, blueprint, playlist, rundown)

	triggerUpdateTimelineAfterIngestData(rundown.playlistId)
}

export function handleRemovedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	partExternalId: string
) {
	const studio = getStudioFromDevice(peripheralDevice)
	const rundownId = getRundownId(studio, rundownExternalId)
	const playlistId = getRundown(rundownId, rundownExternalId).playlistId

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleRemovedPart', () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		const playlist = getRundownPlaylist(rundown)
		const segmentId = getSegmentId(rundown._id, segmentExternalId)
		const segment = getSegment(segmentId)

		if (!canSegmentBeUpdated(rundown, segment, false)) return

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))

		// Blueprints will handle the deletion of the Part
		const ingestSegment = loadCachedIngestSegment(rundown._id, rundownExternalId, segmentId, segmentExternalId)
		const oldIngestPart = ingestSegment.parts.find((p) => p.externalId === partExternalId)
		if (!oldIngestPart) throw new Meteor.Error(404, `IngestPart "${partExternalId}" not found`)

		ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partExternalId)
		ingestSegment.modified = getCurrentTime()

		cache.defer(() => {
			saveSegmentCache(rundown._id, segmentId, ingestSegment)
		})

		const blueprint = loadShowStyleBlueprint(waitForPromise(cache.activationCache.getShowStyleBase(rundown)))

		const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = updateSegmentFromIngestData(
			cache,
			blueprint,
			playlist,
			rundown,
			ingestSegment
		)
		if (updatedSegmentId) {
			afterIngestChangedData(cache, blueprint.blueprint, rundown, [
				{ segmentId: updatedSegmentId, oldPartIdsAndRanks },
			])
		}

		waitForPromise(cache.saveAllToDatabase())
	})
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

	return rundownPlaylistSyncFunction(playlistId, RundownSyncFunctionPriority.INGEST, 'handleUpdatedPart', () => {
		const rundown = getRundown(rundownId, rundownExternalId)
		if (!rundown) return

		const playlist = getRundownPlaylist(rundown)

		const cache = waitForPromise(initCacheForRundownPlaylist(playlist))
		handleUpdatedPartInner(cache, playlist, rundown, segmentExternalId, ingestPart)

		waitForPromise(cache.saveAllToDatabase())
	})
}
export function handleUpdatedPartInner(
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	rundown: Rundown,
	segmentExternalId: string,
	ingestPart: IngestPart
) {
	const span = profiler.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, segmentExternalId)
	const segment = cache.Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)
	if (!canSegmentBeUpdated(rundown, segment, false)) return

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

	const blueprint = loadShowStyleBlueprint(waitForPromise(cache.activationCache.getShowStyleBase(rundown)))

	const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = updateSegmentFromIngestData(
		cache,
		blueprint,
		playlist,
		rundown,
		ingestSegment
	)
	if (updatedSegmentId) {
		afterIngestChangedData(cache, blueprint.blueprint, rundown, [
			{ segmentId: updatedSegmentId, oldPartIdsAndRanks },
		])
	}

	span?.end()
}

function generateSegmentContents(
	context: SegmentContext,
	blueprintId: BlueprintId,
	ingestSegment: LocalIngestSegment,
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
		...(existingSegment ? omit(existingSegment, 'isHidden', 'orphaned') : {}),
		...blueprintRes.segment,
		_id: segmentId,
		rundownId: rundownId,
		externalId: ingestSegment.externalId,
		externalModified: ingestSegment.modified,
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

export function canRemoveSegment(
	cache: CacheForRundownPlaylist,
	rundownPlaylist: RundownPlaylist,
	segment: DBSegment | undefined
): boolean {
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, rundownPlaylist)
	if (
		segment &&
		(currentPartInstance?.segmentId === segment._id ||
			(nextPartInstance?.segmentId === segment._id && isTooCloseToAutonext(currentPartInstance, false)))
	) {
		// Don't allow removing an active rundown
		logger.warn(`Not allowing removal of current playing segment "${segment._id}", making segment unsynced instead`)
		return false
	}

	return true
}
