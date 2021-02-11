import { Meteor } from 'meteor/meteor'
import { check } from '../../../lib/check'
import * as _ from 'underscore'
import { PeripheralDevice, PeripheralDeviceId, getExternalNRCSName } from '../../../lib/collections/PeripheralDevices'
import { Rundown, Rundowns, DBRundown } from '../../../lib/collections/Rundowns'
import { Part, DBPart } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import {
	saveIntoDb,
	getCurrentTime,
	literal,
	sumChanges,
	anythingChanged,
	unprotectString,
	protectString,
	getRandomId,
	PreparedChanges,
} from '../../../lib/lib'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	BlueprintResultOrderedRundowns,
} from '@sofie-automation/blueprints-integration'
import { logger } from '../../../lib/logging'
import { Studio, StudioId } from '../../../lib/collections/Studios'
import {
	selectShowStyleVariant,
	afterRemoveParts,
	getAllRundownsInPlaylist,
	sortDefaultRundownInPlaylistOrder,
} from '../rundown'
import { loadShowStyleBlueprint, WrappedShowStyleBlueprint } from '../blueprints/cache'
import { StudioUserContext, ShowStyleUserContext, CommonContext, SegmentUserContext } from '../blueprints/context'
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
import { DBSegment, Segments, SegmentId } from '../../../lib/collections/Segments'
import { AdLibPiece } from '../../../lib/collections/AdLibPieces'
import {
	loadCachedIngestSegment,
	loadCachedRundownData,
	LocalIngestRundown,
	LocalIngestSegment,
	makeNewIngestSegment,
	makeNewIngestPart,
	makeNewIngestRundown,
} from './ingestCache'
import {
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
import { PartNote, SegmentNote, RundownNote } from '../../../lib/api/notes'
import { DBRundownPlaylist, RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { isTooCloseToAutonext, getSelectedPartInstancesFromCache } from '../playout/lib'
import { MethodContext } from '../../../lib/api/methods'
import { CacheForRundownPlaylist } from '../../cache/DatabaseCaches'
import { saveIntoCache } from '../../cache/lib'
import { Settings } from '../../../lib/Settings'
import { AdLibAction } from '../../../lib/collections/AdLibActions'
import { RundownBaselineAdLibAction } from '../../../lib/collections/RundownBaselineAdLibActions'
import { profiler } from '../profiler'
import { getShowStyleCompound2, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { playoutNoCacheFromStudioLockFunction } from '../playout/syncFunction'
import { studioLockFunction } from '../studio/syncFunction'
import { CommitIngestData, ingestLockFunction } from './syncFunction'
import { CacheForIngest } from './cache'
import { ReadonlyDeep } from 'type-fest'

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

	const showStyleBlueprint = loadShowStyleBlueprint(showStyle.base)
	// const notesContext = new NotesContext(true)
	const blueprintContext = new ShowStyleUserContext(
		{
			name: `${showStyle.base.name}-${showStyle.variant.name}`,
			identifier: `showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		},
		cache.Studio.doc,
		showStyle.compound
	)
	const rundownRes = showStyleBlueprint.blueprint.getRundown(blueprintContext, extendedIngestRundown)

	const translationNamespaces: string[] = []
	if (showStyleBlueprint.blueprintId) {
		translationNamespaces.push(unprotectString(showStyleBlueprint.blueprintId))
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

	const dbRundownData = literal<DBRundown>({
		...rundownRes.rundown,
		notes: rundownNotes,
		_id: cache.RundownId,
		externalId: ingestRundown.externalId,
		organizationId: cache.Studio.doc.organizationId,
		studioId: cache.Studio.doc._id,
		showStyleVariantId: showStyle.variant._id,
		showStyleBaseId: showStyle.base._id,
		orphaned: undefined,

		importVersions: {
			studio: cache.Studio.doc._rundownVersionHash,
			showStyleBase: showStyle.base._rundownVersionHash,
			showStyleVariant: showStyle.variant._rundownVersionHash,
			blueprint: showStyleBlueprint.blueprint.blueprintVersion,
			core: PackageInfo.versionExtended || PackageInfo.version,
		},

		created: cache.Rundown.doc?.created ?? getCurrentTime(),
		modified: getCurrentTime(),

		// TODO - these should be preserved during a regenerateRundown
		peripheralDeviceId: peripheralDevice?._id,
		externalNRCSName: getExternalNRCSName(peripheralDevice),

		// validated later
		playlistId: protectString(''),
		_rank: 0,
		...(cache.Rundown.doc ? _.pick(cache.Rundown.doc, 'startedPlayback', 'playlistId', '_rank') : {}),
	})
	const dbRundown = cache.Rundown.replace(dbRundownData)

	// Save the baseline
	const blueprintRundownContext = new CommonContext({
		name: dbRundown.name,
		identifier: `rundownId=${dbRundown._id}`,
	})
	logger.info(`Building baseline objects for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.length} objects from baseline.`)
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib objects from baseline.`)
	logger.info(`... got ${(rundownRes.globalActions || []).length} adLib actions from baseline.`)

	const rundownBaselineChanges = sumChanges(
		saveIntoCache<RundownBaselineObj, RundownBaselineObj>(cache.RundownBaselineObjs, {}, [
			{
				_id: protectString<RundownBaselineObjId>(Random.id(7)),
				rundownId: dbRundown._id,
				objects: postProcessRundownBaselineItems(
					blueprintRundownContext,
					showStyle.base.blueprintId,
					rundownRes.baseline
				),
			},
		]),
		// Save the global adlibs
		saveIntoCache<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(
			cache.RundownBaselineAdLibPieces,
			{},
			postProcessAdLibPieces(
				blueprintRundownContext,
				showStyle.base.blueprintId,
				dbRundown._id,
				undefined,
				rundownRes.globalAdLibPieces
			)
		),
		saveIntoCache<RundownBaselineAdLibAction, RundownBaselineAdLibAction>(
			cache.RundownBaselineAdLibActions,
			{},
			postProcessGlobalAdLibActions(
				blueprintRundownContext,
				showStyle.base.blueprintId,
				dbRundown._id,
				rundownRes.globalActions || []
			)
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

	// TODO - store notes from rundownNotesContext

	const segmentChanges = await updateSegmentsFromIngestData(cache, dbRundown, ingestRundown.segments)

	/** Don't remove segments for now, orphan them instead. The 'commit' phase will clean them up if possible */
	const removedSegments = cache.Segments.findFetch({ _id: { $nin: segmentChanges.segments.map((s) => s._id) } })
	for (const oldSegment of removedSegments) {
		segmentChanges.segments.push({
			...oldSegment,
			orphaned: 'deleted',
		})
	}

	// TODO - rename this setting
	if (Settings.allowUnsyncedSegments && removedSegments.length > 0) {
		// Preserve any old content, unless the part is referenced in another segment
		const retainSegments = new Set(removedSegments.map((s) => s._id))
		const newPartIds = new Set(segmentChanges.parts.map((p) => p._id))
		const oldParts = cache.Parts.findFetch((p) => retainSegments.has(p.segmentId) && !newPartIds.has(p._id))
		segmentChanges.parts.push(...oldParts)

		const oldPartIds = new Set(oldParts.map((p) => p._id))
		segmentChanges.pieces.push(...cache.Pieces.findFetch((p) => oldPartIds.has(p.startPartId)))
		segmentChanges.adlibPieces.push(...cache.AdLibPieces.findFetch((p) => p.partId && oldPartIds.has(p.partId)))
		segmentChanges.adlibActions.push(...cache.AdLibActions.findFetch((p) => p.partId && oldPartIds.has(p.partId)))
	}

	await saveSegmentChangesToCache(cache, segmentChanges, true)

	// const didChange = anythingChanged(sumChanges(allChanges, segmentChanges))
	// if (didChange) {
	// 	afterIngestChangedData(
	// 		cache,
	// 		showStyle.compound,
	// 		blueprint,
	// 		dbRundown,
	// 		newSegments.map((s) => ({
	// 			segmentId: s._id,
	// 			oldPartIdsAndRanks: (existingRundownParts[unprotectString(s._id)] || []).map((p) => ({
	// 				id: p._id,
	// 				rank: p._rank,
	// 			})),
	// 		}))
	// 	)
	// }

	logger.info(`Rundown ${dbRundown._id} update complete`)

	span?.end()
	return literal<CommitIngestData>({
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: removedSegments.map((s) => s._id),

		removeRundown: false,

		showStyle: showStyle.compound,
		blueprint: showStyleBlueprint,
	})
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
			return regenSegmentInner(cache, ingestSegment, isCreateAction)
		}
	)
}
export interface UpdateSegmentsResult {
	segments: DBSegment[]
	parts: DBPart[]
	pieces: Piece[]
	adlibPieces: AdLibPiece[]
	adlibActions: AdLibAction[]

	/** ShowStyle, if loaded to reuse */
	showStyle: ShowStyleCompound | undefined
	/** Blueprint, if loaded to reuse */
	blueprint: WrappedShowStyleBlueprint | undefined
}
export async function updateSegmentsFromIngestData(
	cache: CacheForIngest,
	rundown: ReadonlyDeep<Rundown>, // TODO?
	ingestSegments: LocalIngestSegment[]
): Promise<UpdateSegmentsResult> {
	const span = profiler.startSpan('ingest.rundownInput.updateSegmentsFromIngestData')

	const res: Omit<UpdateSegmentsResult, 'showStyle' | 'blueprint'> = {
		segments: [],
		parts: [],
		pieces: [],
		adlibPieces: [],
		adlibActions: [],
	}

	if (ingestSegments.length > 0) {
		const showStyle = await getShowStyleCompound2(rundown)
		const blueprint = loadShowStyleBlueprint(showStyle)

		const changedSegmentIds: SegmentId[] = []
		for (let ingestSegment of ingestSegments) {
			const segmentId = getSegmentId(cache.RundownId, ingestSegment.externalId)
			changedSegmentIds.push(segmentId)

			const existingSegment = cache.Segments.findOne(segmentId)

			const context = new SegmentUserContext(
				{
					name: `getSegment=${ingestSegment.name}`,
					identifier: `rundownId=${rundown._id},segmentId=${segmentId}`,
				},
				cache.Studio.doc,
				showStyle,
				rundown
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
				...blueprintRes.segment,
				_id: segmentId,
				rundownId: rundown._id,
				externalId: ingestSegment.externalId,
				externalModified: ingestSegment.modified,
				_rank: ingestSegment.rank,
				notes: segmentNotes,
			})
			res.segments.push(newSegment)

			blueprintRes.parts.forEach((blueprintPart, i) => {
				const partId = getPartId(rundown._id, blueprintPart.part.externalId)

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

				const existingPart = cache.Parts.findOne(partId)
				const part = literal<DBPart>({
					...blueprintPart.part,
					_id: partId,
					rundownId: rundown._id,
					segmentId: newSegment._id,
					_rank: i, // This gets updated to a rank unique within its segment in a later step
					notes: notes,

					// Preserve:
					status: existingPart?.status, // This property is 'owned' by core and updated via its own flow
				})
				res.parts.push(part)

				// This ensures that it doesn't accidently get played while hidden
				if (blueprintRes.segment.isHidden) {
					part.invalid = true
				}

				// Update pieces
				res.pieces.push(
					...postProcessPieces(
						context,
						blueprintPart.pieces,
						blueprint.blueprintId,
						rundown._id,
						newSegment._id,
						part._id,
						undefined,
						undefined,
						part.invalid
					)
				)
				res.adlibPieces.push(
					...postProcessAdLibPieces(
						context,
						blueprint.blueprintId,
						rundown._id,
						part._id,
						blueprintPart.adLibPieces
					)
				)
				res.adlibActions.push(
					...postProcessAdLibActions(
						context,
						blueprint.blueprintId,
						rundown._id,
						part._id,
						blueprintPart.actions || []
					)
				)
			})

			// If the segment has no parts, then hide it
			if (blueprintRes.parts.length === 0) {
				newSegment.isHidden = true
			}
		}

		span?.end()
		return {
			...res,

			showStyle,
			blueprint,
		}
	} else {
		span?.end()
		return {
			...res,

			showStyle: undefined,
			blueprint: undefined,
		}
	}
}

/**
 * Save the calculated UpdateSegmentsResult into the cache
 * Note: this will NOT remove any segments, it is expected for that to be done later
 * @param cache The cache to save into
 * @param data The data to save
 * @param isWholeRundownUpdate Whether this is a whole rundown change (This will remove any stray items)
 */
export async function saveSegmentChangesToCache(
	cache: CacheForIngest,
	data: UpdateSegmentsResult,
	isWholeRundownUpdate: boolean
): Promise<void> {
	const newPartIds = data.parts.map((p) => p._id)
	const newSegmentIds = data.segments.map((p) => p._id)

	// Note: These are done in this order to ensure that the afterRemoveAll don't delete anything that was simply moved
	saveIntoCache<Piece, Piece>(
		cache.Pieces,
		isWholeRundownUpdate ? {} : { startPartId: { $in: newPartIds } },
		data.pieces,
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
	)
	saveIntoCache<AdLibAction, AdLibAction>(
		cache.AdLibActions,
		isWholeRundownUpdate ? {} : { partId: { $in: newPartIds } },
		data.adlibActions,
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
	)
	saveIntoCache<AdLibPiece, AdLibPiece>(
		cache.AdLibPieces,
		isWholeRundownUpdate ? {} : { partId: { $in: newPartIds } },
		data.adlibPieces,
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
	)
	const partChanges = saveIntoCache<Part, DBPart>(
		cache.Parts,
		isWholeRundownUpdate ? {} : { segmentId: { $in: newSegmentIds } },
		data.parts,
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
		}
	)

	// Cleanup any items belonging to the removed parts
	if (partChanges.removed.length > 0) {
		afterRemoveParts(cache, partChanges.removed)
	}

	// Update Segments: Only update, never remove
	for (const segment of data.segments) {
		cache.Segments.replace(segment)
	}
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
			return regenSegmentInner(cache, ingestSegment, false)
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
			return regenSegmentInner(cache, ingestSegment, false)
		}
	)
}

export async function regenSegmentInner(
	cache: CacheForIngest,
	ingestSegment: LocalIngestSegment,
	isNewSegment: boolean
): Promise<CommitIngestData | null> {
	const span = profiler.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	const rundown = getRundown2(cache)

	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
	const segment = cache.Segments.findOne(segmentId)
	if (!isNewSegment && !segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found`)
	if (!canSegmentBeUpdated(rundown, segment, isNewSegment)) return null

	const segmentChanges = await updateSegmentsFromIngestData(cache, rundown, [ingestSegment])
	await saveSegmentChangesToCache(cache, segmentChanges, false)

	span?.end()
	return {
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: [],

		removeRundown: false,

		showStyle: segmentChanges.showStyle,
		blueprint: segmentChanges.blueprint,
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
