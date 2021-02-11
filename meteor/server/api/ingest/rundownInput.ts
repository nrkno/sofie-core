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
	normalizeArrayToMap,
	omit,
	asyncSaveIntoDb,
	waitForPromiseAll,
} from '../../../lib/lib'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	BlueprintResultOrderedRundowns,
	ShowStyleBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio, StudioId, Studios } from '../../../lib/collections/Studios'
import {
	selectShowStyleVariant,
	afterRemoveParts,
	ServerRundownAPI,
	produceRundownPlaylistInfoFromRundown,
	allowedToMoveRundownOutOfPlaylist,
	getAllRundownsInPlaylist,
	sortDefaultRundownInPlaylistOrder,
	ChangedSegmentsRankInfo,
	unsyncAndEmptySegment,
	removeSegmentContents,
} from '../rundown'
import { loadShowStyleBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import { StudioUserContext, ShowStyleUserContext, CommonContext, SegmentUserContext } from '../blueprints/context'
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
	canRundownBeUpdated,
	canSegmentBeUpdated,
	getSegment,
	checkAccessAndGetPeripheralDevice,
	extendIngestRundownCore,
	modifyPlaylistExternalId,
	getRundown2,
} from './lib'
import { PackageInfo } from '../../coreSystem'
import { PartNote, NoteType, SegmentNote, RundownNote } from '../../../lib/api/notes'
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
} from '../playout/lib'
import { MethodContext } from '../../../lib/api/methods'
import { CacheForRundownPlaylist, initCacheForRundownPlaylist } from '../../cache/DatabaseCaches'
import { prepareSaveIntoCache, saveIntoCache, savePreparedChangesIntoCache } from '../../cache/lib'
import { reportRundownDataHasChanged } from '../asRunLog'
import { Settings } from '../../../lib/Settings'
import { AdLibAction } from '../../../lib/collections/AdLibActions'
import {
	RundownBaselineAdLibActions,
	RundownBaselineAdLibAction,
} from '../../../lib/collections/RundownBaselineAdLibActions'
import { removeEmptyPlaylists } from '../rundownPlaylist'
import { profiler } from '../profiler'
import { getShowStyleCompound2, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { playoutNoCacheFromStudioLockFunction } from '../playout/syncFunction'
import { studioLockFunction } from '../studio/syncFunction'
import { CommitIngestData, ingestLockFunction } from './syncFunction'
import { CacheForIngest } from './cache'
import { afterIngestChangedData } from './commit'

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
/** @deprecated */
export function rundownPlaylistSyncFunction<T extends () => any>(
	studioId: StudioId,
	rundownPlaylistId: RundownPlaylistId,
	priority: RundownSyncFunctionPriority,
	context: string,
	fcn: T
): ReturnType<T> {
	return studioLockFunction(context, studioId, (lock) =>
		playoutNoCacheFromStudioLockFunction(context, lock, { _id: rundownPlaylistId, studioId } as any, priority, fcn)
	)
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
	const studio = getStudioFromDevice(peripheralDevice)

	return ingestLockFunction(
		'handleRemovedRundown',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				// Remove it
				return undefined
			} else {
				return null
			}
		},
		async (cache) => {
			const rundown = getRundown2(cache)

			return {
				changedSegmentIds: [],
				removedSegmentIds: [],
				removeRundown: canRundownBeUpdated(rundown, false),

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}
/** Handle an updated (or inserted) Rundown */
export function handleUpdatedRundown(
	studio0: Studio | undefined,
	peripheralDevice: PeripheralDevice | undefined,
	newIngestRundown: IngestRundown,
	isCreateAction: boolean
) {
	const studioId = peripheralDevice?.studioId ?? studio0?._id
	if ((!peripheralDevice && !studio0) || !studioId) {
		throw new Meteor.Error(500, `A PeripheralDevice or Studio is required to update a rundown`)
	}

	if (peripheralDevice && studio0 && peripheralDevice.studioId !== studio0._id) {
		throw new Meteor.Error(
			500,
			`PeripheralDevice "${peripheralDevice._id}" does not belong to studio "${studio0._id}"`
		)
	}

	const rundownExternalId = newIngestRundown.externalId
	return ingestLockFunction(
		'handleUpdatedRundown',
		studioId,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown || isCreateAction) {
				// We want to regenerate unmodified
				return makeNewIngestRundown(newIngestRundown)
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const rundown = getRundown2(cache)

			if (!ingestRundown) throw new Meteor.Error(`regenerateRundown lost the IngestRundown...`)

			handleUpdatedRundownInner(cache, ingestRundown, isCreateAction, peripheralDevice)

			return {
				changedSegmentIds: [], // TODO - set this!
				removedSegmentIds: [], // TODO - set this!
				removeRundown: false,

				showStyle: undefined,
				blueprint: undefined,
			}
		}
	)
}
export async function handleUpdatedRundownInner(
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	isCreateAction: boolean,
	peripheralDevice?: PeripheralDevice // TODO - to cache?
): Promise<CommitIngestData | null> {
	if (!canRundownBeUpdated(cache.Rundown.doc, isCreateAction)) return null

	logger.info(`${cache.Rundown.doc ? 'Updating' : 'Adding'} rundown ${cache.RundownId}`)

	return updateRundownFromIngestData(cache, ingestRundown, peripheralDevice)
}
export function regenerateRundown(studio: Studio, rundownExternalId: string) {
	return ingestLockFunction(
		'regenerateRundown',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				// We want to regenerate unmodified
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			// If the rundown is orphaned, then we can't regenerate as there wont be any data to use!
			if (!ingestRundown || !canRundownBeUpdated(cache.Rundown.doc, false)) return null

			return updateRundownFromIngestData(cache, ingestRundown, undefined)
		}
	)
}
async function updateRundownFromIngestData(
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	peripheralDevice: PeripheralDevice | undefined
): Promise<CommitIngestData | null> {
	const span = profiler.startSpan('ingest.rundownInput.updateRundownFromIngestData')

	// canBeUpdated is to be run by the callers

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, cache.Rundown.doc)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${cache.Studio.doc._id},rundownId=${cache.RundownId},ingestRundownId=${cache.RundownExternalId}`,
			tempSendUserNotesIntoBlackHole: true,
		},
		cache.Studio.doc
	)
	// TODO-CONTEXT save any user notes from selectShowStyleContext
	// TODO - better caching here!
	const showStyle = selectShowStyleVariant(selectShowStyleContext, extendedIngestRundown)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Meteor.Error(501, 'Blueprint rejected the rundown')
	}

	const showStyleBlueprint = loadShowStyleBlueprint(showStyle.base).blueprint
	// const notesContext = new NotesContext(true)
	const blueprintContext = new ShowStyleUserContext(
		{
			name: `${showStyle.base.name}-${showStyle.variant.name}`,
			identifier: `showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		},
		cache.Studio.doc,
		showStyle.compound
	)
	const rundownRes = showStyleBlueprint.getRundown(blueprintContext, extendedIngestRundown)

	const translationNamespaces: string[] = []
	if (showStyleBlueprint.blueprintId) {
		translationNamespaces.push(showStyleBlueprint.blueprintId)
	}
	if (cache.Studio.doc.blueprintId) {
		translationNamespaces.push(unprotectString(cache.Studio.doc.blueprintId))
	}

	// Ensure the ids in the notes are clean
	const rundownNotes = blueprintContext.notes.map((note) =>
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
					message: {
						key:
							'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.',
					},
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

	const dbPlaylist = dbRundown.getRundownPlaylist()
	if (!dbPlaylist) throw new Meteor.Error(500, 'RundownPlaylist not found (it should have been)')

	const cache = waitForPromise(initCacheForRundownPlaylist(dbPlaylist))

	cache.deferAfterSave(() => {
		const studioId = studio._id
		Meteor.defer(() => {
			// It needs to lock every playlist, and we are already inside one of the locks it needs
			removeEmptyPlaylists(studioId)
		})
	})

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

	const segmentsAndParts = getRundownsSegmentsAndPartsFromCache(cache.Parts, cache.Segments, [dbRundown])
	const existingRundownParts = _.groupBy(segmentsAndParts.parts, (part) => part.segmentId)
	const existingSegments = normalizeArrayToMap(segmentsAndParts.segments, '_id')

	const newSegments: DBSegment[] = []
	const newParts: DBPart[] = []
	const newPieces: Piece[] = []
	const newAdlibPieces: AdLibPiece[] = []
	const newAdlibActions: AdLibAction[] = []

	const { blueprint, blueprintId } = loadShowStyleBlueprint(showStyle.base)
	// translationNamespaces.add(unprotectString(blueprintId))

	_.each(ingestRundown.segments, (ingestSegment: LocalIngestSegment) => {
		const segmentId = getSegmentId(rundownId, ingestSegment.externalId)
		const existingSegment = existingSegments.get(segmentId)
		const existingParts = existingRundownParts[unprotectString(segmentId)] || []

		// Future: if canUpdateSegment ever does anything more than checking for allowed deletion, it should be done here.
		// That introduces some logic complexities, as what if a part is moved between segments?

		ingestSegment.parts = _.sortBy(ingestSegment.parts, (part) => part.rank)

		const segmentContents = generateSegmentContents(
			studio,
			showStyle.compound,
			dbRundown,
			blueprint,
			blueprintId,
			ingestSegment,
			existingSegment,
			existingParts
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
			showStyle.compound,
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

	return ingestLockFunction(
		'handleRemovedSegment',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const oldSegmentsLength = ingestRundown.segments.length
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.modified = getCurrentTime()

				if (ingestRundown.segments.length === oldSegmentsLength) {
					// Nothing was removed
					return null
				}

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache) => {
			const rundown = getRundown2(cache)
			const segmentId = getSegmentId(rundown._id, segmentExternalId)
			const segment = getSegment(segmentId)

			if (!canSegmentBeUpdated(rundown, segment, false)) {
				// segment has already been deleted
				return null
			} else {
				return {
					changedSegmentIds: [],
					removedSegmentIds: [segmentId],

					removeRundown: false,

					showStyle: undefined,
					blueprint: undefined,
				}
			}
		}
	)
}
export function handleUpdatedSegment(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	newIngestSegment: IngestSegment,
	isCreateAction: boolean
) {
	const studio = getStudioFromDevice(peripheralDevice)

	const segmentExternalId = newIngestSegment.externalId

	return ingestLockFunction(
		'handleUpdatedSegment',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.segments = ingestRundown.segments.filter((s) => s.externalId !== segmentExternalId)
				ingestRundown.segments.push(makeNewIngestSegment(newIngestSegment))
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return regenSegmentInner(cache, studio, ingestSegment, isCreateAction)
		}
	)
}
export function updateSegmentsFromIngestData(
	cache: CacheForRundownPlaylist,
	studio: Studio,
	playlist: RundownPlaylist,
	rundown: Rundown,
	ingestSegments: LocalIngestSegment[]
) {
	if (ingestSegments.length > 0) {
		const showStyle = waitForPromise(cache.activationCache.getShowStyleCompound(rundown))
		const blueprint = loadShowStyleBlueprint(showStyle)

		const changedSegments: ChangedSegmentsRankInfo = []
		for (let ingestSegment of ingestSegments) {
			const { segmentId, oldPartIdsAndRanks } = updateSegmentFromIngestData(
				cache,
				studio,
				showStyle,
				blueprint,
				rundown,
				ingestSegment
			)
			if (segmentId !== null) {
				changedSegments.push({ segmentId, oldPartIdsAndRanks })
			}
		}
		if (changedSegments.length > 0) {
			afterIngestChangedData(cache, showStyle, blueprint.blueprint, rundown, changedSegments)
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
	studio: Studio,
	showStyle: ShowStyleCompound,
	blueprint: WrappedShowStyleBlueprint,
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

	const { parts, segmentPieces, adlibPieces, adlibActions, newSegment } = generateSegmentContents(
		studio,
		showStyle,
		rundown,
		blueprint.blueprint,
		blueprint.blueprintId,
		ingestSegment,
		existingSegment,
		existingParts
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
export function handleRemovedPart(
	peripheralDevice: PeripheralDevice,
	rundownExternalId: string,
	segmentExternalId: string,
	partExternalId: string
) {
	const studio = getStudioFromDevice(peripheralDevice)

	return ingestLockFunction(
		'handleRemovedPart',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
				if (!ingestSegment) {
					logger.warn(
						`handleUpdatedPart: Missing Segment with externalId "${segmentExternalId}" in Rundown ingest data for "${rundownExternalId}"`
					)
					return null
				}
				const oldPartsLength = ingestSegment.parts.length
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== partExternalId)
				ingestSegment.modified = getCurrentTime()

				if (ingestSegment.parts.length === oldPartsLength) {
					// Nothing was removed
					return null
				}

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return regenSegmentInner(cache, studio, ingestSegment, false)
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

	return ingestLockFunction(
		'handleUpdatedPart',
		studio._id,
		rundownExternalId,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segmentExternalId)
				if (!ingestSegment) {
					logger.warn(
						`handleUpdatedPart: Missing Segment with externalId "${segmentExternalId}" in Rundown ingest data for "${rundownExternalId}"`
					)
					return null
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== ingestPart.externalId)
				ingestSegment.parts.push(makeNewIngestPart(ingestPart))
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				return null
			}
		},
		async (cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments.find((s) => s.externalId === segmentExternalId)
			if (!ingestSegment) throw new Meteor.Error(500, `IngestSegment "${segmentExternalId}" is missing!`)
			return regenSegmentInner(cache, studio, ingestSegment, false)
		}
	)
}

export async function regenSegmentInner(
	cache: CacheForIngest,
	studio: Studio,
	ingestSegment: IngestSegment,
	isNewSegment: boolean
): Promise<CommitIngestData | null> {
	const span = profiler.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	const rundown = getRundown2(cache)

	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
	const segment = cache.Segments.findOne(segmentId)
	if (!isNewSegment && !segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)
	if (!canSegmentBeUpdated(rundown, segment, isNewSegment)) return null

	const showStyle = await getShowStyleCompound2(rundown)
	const blueprint = loadShowStyleBlueprint(showStyle)

	const { segmentId: updatedSegmentId, oldPartIdsAndRanks } = updateSegmentFromIngestData(
		cache,
		studio,
		showStyle,
		blueprint,
		rundown,
		ingestSegment
	)

	span?.end()
	return {
		changedSegmentIds: _.compact([updatedSegmentId]),
		removedSegmentIds: [],

		removeRundown: false,

		showStyle,
		blueprint,
	}
}

function generateSegmentContents(
	studio: Studio,
	showStyle: ShowStyleCompound,
	dbRundown: Rundown,
	blueprint: ShowStyleBlueprintManifest,
	blueprintId: BlueprintId,
	ingestSegment: LocalIngestSegment,
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
		studio,
		showStyle,
		dbRundown
	)

	const blueprintRes = blueprint.getSegment(context, ingestSegment)

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
						namespaces: [unprotectString(blueprintId)],
					},
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

		for (const note of context.notes) {
			if (note.partExternalId === blueprintPart.part.externalId) {
				notes.push(
					literal<PartNote>({
						type: note.type,
						message: {
							...note.message,
							namespaces: [unprotectString(blueprintId)],
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
				blueprintId,
				rundownId,
				newSegment._id,
				part._id,
				undefined,
				undefined,
				part.invalid
			)
		)
		adlibPieces.push(
			...postProcessAdLibPieces(context, blueprintId, rundownId, part._id, blueprintPart.adLibPieces)
		)
		adlibActions.push(
			...postProcessAdLibActions(context, blueprintId, rundownId, part._id, blueprintPart.actions || [])
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
