import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../lib/check'
import { Rundowns, Rundown, DBRundown, RundownId } from '../../lib/collections/Rundowns'
import { DBPart, PartId } from '../../lib/collections/Parts'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { Segments, SegmentId } from '../../lib/collections/Segments'
import {
	getCurrentTime,
	waitForPromise,
	unprotectObjectArray,
	protectString,
	unprotectString,
	makePromise,
	waitForPromiseObj,
	asyncCollectionFindFetch,
	normalizeArray,
	getRandomId,
	mongoFindOptions,
	getRank,
	waitForPromiseAll,
	asyncCollectionRemove,
	normalizeArrayToMap,
} from '../../lib/lib'
import { logger } from '../logging'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownAPI, RundownAPIMethods, RundownPlaylistValidateBlueprintConfigResult } from '../../lib/api/rundown'
import {
	ShowStyleVariants,
	ShowStyleVariant,
	ShowStyleVariantId,
	createShowStyleCompound,
} from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { Studios, Studio } from '../../lib/collections/Studios'
import {
	BlueprintResultOrderedRundowns,
	ExtendedIngestRundown,
	BlueprintResultRundownPlaylist,
} from '@sofie-automation/blueprints-integration'
import { StudioConfigContext } from './blueprints/context'
import { loadStudioBlueprint, loadShowStyleBlueprint } from './blueprints/cache'
import { PackageInfo } from '../coreSystem'
import { IngestActions } from './ingest/actions'
import {
	DBRundownPlaylist,
	RundownPlaylists,
	RundownPlaylistId,
	RundownPlaylist,
} from '../../lib/collections/RundownPlaylists'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from '../../lib/api/userActions'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess } from '../security/studio'
import { RundownPlaylistContentWriteAccess } from '../security/rundownPlaylist'
import {
	CacheForRundownPlaylist,
	initCacheForRundownPlaylist,
	initCacheForRundownPlaylistFromRundown,
} from '../DatabaseCaches'
import { saveIntoCache } from '../DatabaseCache'
import {
	removeRundownFromCache,
	removeRundownPlaylistFromCache,
	getSelectedPartInstancesFromCache,
} from './playout/lib'
import { AdLibActions } from '../../lib/collections/AdLibActions'
import { Settings } from '../../lib/Settings'
import { findMissingConfigs } from './blueprints/config'
import { rundownContentAllowWrite } from '../security/rundown'
import { triggerUpdateTimelineAfterIngestData } from './playout/playout'
import { profiler } from './profiler'
import { updateRundownsInPlaylist } from './ingest/rundownInput'
import { Mongo } from 'meteor/mongo'
import { getPlaylistIdFromExternalId, removeEmptyPlaylists } from './rundownPlaylist'
import { ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PartInstanceId } from '../../lib/collections/PartInstances'

export function selectShowStyleVariant(
	studio: Studio,
	ingestRundown: ExtendedIngestRundown
): { variant: ShowStyleVariant; base: ShowStyleBase } | null {
	if (!studio.supportedShowStyleBase.length) {
		logger.debug(`Studio "${studio._id}" does not have any supportedShowStyleBase`)
		return null
	}
	const showStyleBases = ShowStyleBases.find({ _id: { $in: studio.supportedShowStyleBase } }).fetch()
	let showStyleBase = _.first(showStyleBases)
	if (!showStyleBase) {
		logger.debug(
			`No showStyleBases matching with supportedShowStyleBase [${studio.supportedShowStyleBase}] from studio "${studio._id}"`
		)
		return null
	}

	const context = new StudioConfigContext(studio)

	const studioBlueprint = loadStudioBlueprint(studio)
	if (!studioBlueprint) throw new Meteor.Error(500, `Studio "${studio._id}" does not have a blueprint`)

	if (!studioBlueprint.blueprint.getShowStyleId)
		throw new Meteor.Error(500, `Studio "${studio._id}" blueprint missing property getShowStyleId`)

	const showStyleId: ShowStyleBaseId | null = protectString(
		studioBlueprint.blueprint.getShowStyleId(context, unprotectObjectArray(showStyleBases) as any, ingestRundown)
	)
	if (showStyleId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned showStyleId = null`)
		return null
	}
	showStyleBase = _.find(showStyleBases, (s) => s._id === showStyleId)
	if (!showStyleBase) {
		logger.debug(
			`No ShowStyleBase found matching showStyleId "${showStyleId}", from studio "${studio._id}" blueprint`
		)
		return null
	}
	const showStyleVariants = ShowStyleVariants.find({ showStyleBaseId: showStyleBase._id }).fetch()
	if (!showStyleVariants.length) throw new Meteor.Error(500, `ShowStyleBase "${showStyleBase._id}" has no variants`)

	const showStyleBlueprint = loadShowStyleBlueprint(showStyleBase)
	if (!showStyleBlueprint)
		throw new Meteor.Error(500, `ShowStyleBase "${showStyleBase._id}" does not have a valid blueprint`)

	const variantId: ShowStyleVariantId | null = protectString(
		showStyleBlueprint.blueprint.getShowStyleVariantId(
			context,
			unprotectObjectArray(showStyleVariants) as any,
			ingestRundown
		)
	)
	if (variantId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned variantId = null in .getShowStyleVariantId`)
		return null
	} else {
		const showStyleVariant = _.find(showStyleVariants, (s) => s._id === variantId)
		if (!showStyleVariant)
			throw new Meteor.Error(404, `Blueprint returned variantId "${variantId}", which was not found!`)

		return {
			variant: showStyleVariant,
			base: showStyleBase,
		}
	}
}
/** Return true if the rundown is allowed to be moved out of that playlist */
export function allowedToMoveRundownOutOfPlaylist(playlist: RundownPlaylist, rundown: DBRundown) {
	const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()

	if (rundown.playlistId !== playlist._id)
		throw new Meteor.Error(
			500,
			`Wrong playlist "${playlist._id}" provided for rundown "${rundown._id}" ("${rundown.playlistId}")`
		)

	return !(
		playlist.active &&
		((currentPartInstance && currentPartInstance.rundownId === rundown._id) ||
			(nextPartInstance && nextPartInstance.rundownId === rundown._id))
	)
}

export interface RundownPlaylistAndOrder {
	rundownPlaylist: DBRundownPlaylist
	order: BlueprintResultOrderedRundowns
}

export function getAllRundownsInPlaylist(playlistId: RundownPlaylistId, playlistExternalId: string | null) {
	let selector: Mongo.Selector<DBRundown> = {
		$or: [{ playlistId: playlistId }],
	}
	if (playlistExternalId) {
		// When playlist externalId is set, also include rundowns with playlistExternalId
		selector.$or?.push({
			playlistExternalId: playlistExternalId,
			playlistIdIsSetInSofie: { $ne: true }, // Don't include rundowns that has been manually moved into another playlist.
		})
	}
	return {
		rundowns: Rundowns.find(selector).fetch() as DBRundown[],
		selector: selector,
	}
}
/**
 * Produce the ranks of rundowns in a playlist.
 * @param studio
 * @param playlistId
 */
export function produceRundownPlaylistRanks(
	studio: Studio,
	playlistId: RundownPlaylistId
): BlueprintResultOrderedRundowns {
	// Note: This function does essentially the same as produceRundownPlaylistInfoFromRundown
	// but just returns the rundown order

	const studioBlueprint = loadStudioBlueprint(studio)
	if (!studioBlueprint) throw new Meteor.Error(500, `Studio "${studio._id}" does not have a blueprint`)

	const existingPlaylist = RundownPlaylists.findOne(playlistId)
	if (!existingPlaylist) throw new Meteor.Error(404, `Playlist "${playlistId}" not found`)

	const { rundowns } = getAllRundownsInPlaylist(existingPlaylist._id, existingPlaylist.externalId)

	const playlistInfo: BlueprintResultRundownPlaylist | null = studioBlueprint.blueprint.getRundownPlaylistInfo
		? studioBlueprint.blueprint.getRundownPlaylistInfo(unprotectObjectArray(rundowns))
		: null

	if (playlistInfo) {
		if (playlistInfo.order) {
			return playlistInfo.order
		}
	}
	// If no order is provided, fall back to default sorting:
	const rundownsInOrder = sortDefaultRundownInPlaylistOrder(rundowns)
	return _.object(rundownsInOrder.map((i, index) => [i._id, index + 1]))
}

/** Produce info about playlist from rundown (using blueprints)
 * This function is (/can be) run before the playlist has been created.
 */
export function produceRundownPlaylistInfoFromRundown(
	studio: Studio,
	currentRundown: DBRundown,
	peripheralDevice: PeripheralDevice | undefined
): RundownPlaylistAndOrder {
	const studioBlueprint = loadStudioBlueprint(studio)
	if (!studioBlueprint) throw new Meteor.Error(500, `Studio "${studio._id}" does not have a blueprint`)

	/** The playlist that the rundown is going to be inserted into. */
	let playlistId: RundownPlaylistId | undefined
	if (currentRundown.playlistIdIsSetInSofie) {
		playlistId = currentRundown.playlistId
	} else if (currentRundown.playlistExternalId) {
		playlistId = getPlaylistIdFromExternalId(studio._id, currentRundown.playlistExternalId)
	}

	const getAllRundownsInPlaylist2 = (playlistId: RundownPlaylistId, playlistExternalId: string | null) => {
		const { rundowns } = getAllRundownsInPlaylist(playlistId, playlistExternalId)

		const currentIndex = rundowns.findIndex((rd) => rd._id === currentRundown._id)
		if (currentIndex !== -1) {
			rundowns[currentIndex] = currentRundown
		} else {
			rundowns.push(currentRundown)
		}

		return rundowns
	}

	if (playlistId) {
		// The rundown is going to be (or already is) inserted into a new (or existing) playlist.

		const existingPlaylist: RundownPlaylist | undefined = RundownPlaylists.findOne(playlistId)

		const playlistExternalId: string | undefined = existingPlaylist?.externalId || currentRundown.playlistExternalId

		if (playlistExternalId) {
			const rundowns = getAllRundownsInPlaylist2(playlistId, playlistExternalId)

			const playlistInfo: BlueprintResultRundownPlaylist | null = studioBlueprint.blueprint.getRundownPlaylistInfo
				? studioBlueprint.blueprint.getRundownPlaylistInfo(unprotectObjectArray(rundowns))
				: null

			if (playlistInfo) {
				const playlist: DBRundownPlaylist = {
					created: getCurrentTime(),
					currentPartInstanceId: null,
					nextPartInstanceId: null,
					previousPartInstanceId: null,

					...existingPlaylist,

					_id: playlistId,
					externalId: playlistExternalId,
					organizationId: studio.organizationId,
					studioId: studio._id,
					name: playlistInfo.playlist.name,
					expectedStart: playlistInfo.playlist.expectedStart,
					expectedDuration: playlistInfo.playlist.expectedDuration,

					loop: playlistInfo.playlist.loop,

					outOfOrderTiming: playlistInfo.playlist.outOfOrderTiming,

					modified: getCurrentTime(),

					peripheralDeviceId: peripheralDevice
						? peripheralDevice._id
						: existingPlaylist
						? existingPlaylist.peripheralDeviceId
						: protectString(''),
				}

				let order: BlueprintResultOrderedRundowns | null = playlistInfo.order
				if (!order) {
					// If no order is provided, fall back to default sorting:

					const rundownsInOrder = sortDefaultRundownInPlaylistOrder(rundowns)
					order = _.object(rundownsInOrder.map((i, index) => [i._id, index + 1]))
				}

				return {
					rundownPlaylist: playlist,
					order: order, // Note: if playlist.rundownRanksAreSetInSofie is set, this order should be ignored later
				}
			} else {
				// Blueprints returned null.
			}
		} else {
			// No playlist externalId could be found.
		}
	} else {
		// No playlistId could be determined.
	}

	// Fallback:

	// It's a rundown that "doesn't have a playlist", so we just make one up:

	let playlistExternalId: string | null
	let newPlaylistId: RundownPlaylistId

	if (playlistId) {
		// There is a playlistId specified, that should be used then:
		const existingPlaylist = RundownPlaylists.findOne(playlistId)

		playlistExternalId = existingPlaylist?.externalId || null
		newPlaylistId = playlistId
	} else {
		playlistExternalId = unprotectString(currentRundown._id)
		newPlaylistId = getPlaylistIdFromExternalId(studio._id, playlistExternalId)
	}

	const existingPlaylist = RundownPlaylists.findOne(newPlaylistId)

	const rundowns = getAllRundownsInPlaylist2(newPlaylistId, playlistExternalId)

	const defaultPlaylist: DBRundownPlaylist = defaultPlaylistForRundown(currentRundown, studio, existingPlaylist)

	const playlist = {
		...defaultPlaylist,

		_id: newPlaylistId,
		externalId: playlistExternalId,
		peripheralDeviceId: peripheralDevice ? peripheralDevice._id : protectString(''),
	}

	const rundownsInOrder = sortDefaultRundownInPlaylistOrder(rundowns)

	return {
		rundownPlaylist: playlist,
		order: _.object(rundownsInOrder.map((i, index) => [i._id, index + 1])),
	}
}
export function sortDefaultRundownInPlaylistOrder(rundowns: DBRundown[]): DBRundown[] {
	return mongoFindOptions<DBRundown, DBRundown>(rundowns, {
		sort: {
			expectedStart: 1,
			name: 1,
			_id: 1,
		},
	})
}
function defaultPlaylistForRundown(
	rundown: DBRundown,
	studio: Studio,
	existingPlaylist?: RundownPlaylist
): DBRundownPlaylist {
	return {
		_id: getRandomId(),
		externalId: '',
		created: getCurrentTime(),
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,

		...existingPlaylist,

		organizationId: studio.organizationId,
		studioId: studio._id,
		name: rundown.name,
		expectedStart: rundown.expectedStart,
		expectedDuration: rundown.expectedDuration,

		modified: getCurrentTime(),

		peripheralDeviceId: rundown.peripheralDeviceId,
	}
}

/**
 * Removes the contents of specified Segments from the cache/database
 * @param rundownId The Rundown id to remove from
 * @param segmentIds The Segment ids to be removed
 */
export function removeSegmentContents(
	cache: CacheForRundownPlaylist,
	rundownId: RundownId,
	segmentIds: SegmentId[]
): void {
	// Remove the parts:
	const changes = saveIntoCache(
		cache.Parts,
		{
			rundownId: rundownId,
			segmentId: { $in: segmentIds },
		},
		[],
		{
			afterRemoveAll(parts) {
				removeSegmentsParts(cache, rundownId, parts)
			},
		}
	)

	if (changes.removed > 0) {
		triggerUpdateTimelineAfterIngestData(cache.containsDataFromPlaylist)
	}
}
export function unsyncAndEmptySegment(cache: CacheForRundownPlaylist, rundownId: RundownId, segmentId: SegmentId) {
	cache.Segments.update(segmentId, {
		$set: {
			orphaned: 'deleted',
		},
	})

	if (!Settings.allowUnsyncedSegments) {
		// Remove everything inside the segment
		removeSegmentContents(cache, rundownId, [segmentId])

		// Mark all the instances as deleted
		cache.PartInstances.update((p) => !p.reset && p.segmentId === segmentId && !p.orphaned, {
			$set: {
				orphaned: 'deleted',
			},
		})
	}
}

/**
 * After Parts have been removed, handle the contents.
 * This will NOT trigger an update of the timeline
 * @param rundownId Id of the Rundown
 * @param removedParts The parts that have been removed
 */
function removeSegmentsParts(cache: CacheForRundownPlaylist, rundownId: RundownId, removedParts: DBPart[]) {
	// Clean up all the db items that belong to the removed Parts
	const removedPartIds = removedParts.map((p) => p._id)
	cache.Pieces.remove({
		startRundownId: rundownId,
		startPartId: { $in: removedPartIds },
	})

	afterRemoveParts(cache, removedPartIds)

	cache.deferAfterSave(() => {
		waitForPromiseAll([
			asyncCollectionRemove(ExpectedPlayoutItems, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
			asyncCollectionRemove(ExpectedMediaItems, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
			asyncCollectionRemove(AdLibPieces, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
			asyncCollectionRemove(AdLibActions, {
				rundownId: rundownId,
				partId: { $in: removedPartIds },
			}),
		])
	})
}

/**
 * After Parts have been removed, inform the partInstances.
 * This will NOT remove any data or update the timeline
 * @param removedPartIds The ids of the parts that have been removed
 */
export function afterRemoveParts(cache: CacheForRundownPlaylist, removedPartIds: PartId[]) {
	const removedPartIdsSet = new Set(removedPartIds)

	const playlist = cache.RundownPlaylists.findOne(cache.containsDataFromPlaylist)
	if (playlist) {
		// Update the selected partinstances

		const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache, playlist)
		const removePartInstanceIds = cache.PartInstances.findFetch(
			(p) =>
				removedPartIdsSet.has(p.part._id) &&
				p._id !== currentPartInstance?._id &&
				p._id !== nextPartInstance?._id
		).map((p) => p._id)
		cache.PartInstances.update({ _id: { $in: removePartInstanceIds } }, { $set: { reset: true } })
		cache.PieceInstances.update({ partInstanceId: { $in: removePartInstanceIds } }, { $set: { reset: true } })
	}
}

export type ChangedSegmentsRankInfo = Array<{
	segmentId: SegmentId
	oldPartIdsAndRanks: Array<{ id: PartId; rank: number }> | null // Null if the Parts havent changed, and so can be loaded locally
}>

/**
 * Update the ranks of all PartInstances in the given segments.
 * Syncs the ranks from matching Parts to PartInstances.
 * Orphaned PartInstances get ranks interpolated based on what they were ranked between before the ingest update
 */
export function updatePartInstanceRanks(
	cache: CacheForRundownPlaylist,
	_playlist: RundownPlaylist,
	changedSegments: ChangedSegmentsRankInfo
) {
	const groupedPartInstances = _.groupBy(
		cache.PartInstances.findFetch({
			reset: { $ne: true },
			segmentId: { $in: changedSegments.map((s) => s.segmentId) },
		}),
		(p) => p.segmentId
	)
	const groupedNewParts = _.groupBy(
		cache.Parts.findFetch({
			segmentId: { $in: changedSegments.map((s) => s.segmentId) },
		}),
		(p) => p.segmentId
	)

	let updatedParts = 0
	for (const { segmentId, oldPartIdsAndRanks: oldPartIdsAndRanks0 } of changedSegments) {
		const newParts = groupedNewParts[unprotectString(segmentId)] || []
		const segmentPartInstances = _.sortBy(
			groupedPartInstances[unprotectString(segmentId)] || [],
			(p) => p.part._rank
		)

		// Ensure the PartInstance ranks are synced with their Parts
		const newPartsMap = normalizeArrayToMap(newParts, '_id')
		for (const partInstance of segmentPartInstances) {
			const part = newPartsMap.get(partInstance.part._id)
			if (part) {
				// We have a part and instance, so make sure the part isn't orphaned and sync the rank
				cache.PartInstances.update(partInstance._id, {
					$set: {
						'part._rank': part._rank,
					},
					$unset: {
						orphaned: 1,
					},
				})

				// Update local copy
				delete partInstance.orphaned
				partInstance.part._rank = part._rank
			} else if (!partInstance.orphaned) {
				partInstance.orphaned = 'deleted'
				cache.PartInstances.update(partInstance._id, {
					$set: {
						orphaned: 'deleted',
					},
				})
			}
		}

		const orphanedPartInstances = segmentPartInstances
			.map((p, i) => ({ rank: p.part._rank, orphaned: p.orphaned, instanceId: p._id, id: p.part._id }))
			.filter((p) => p.orphaned)

		if (orphanedPartInstances.length === 0) {
			// No orphans to position
			continue
		}

		logger.debug(
			`updatePartInstanceRanks: ${segmentPartInstances.length} partInstances with ${orphanedPartInstances.length} orphans in segment "${segmentId}"`
		)

		// If we have no instances, or no parts to base it on, then we can't do anything
		if (newParts.length === 0) {
			// position them all 0..n
			let i = 0
			for (const partInfo of orphanedPartInstances) {
				cache.PartInstances.update(partInfo.instanceId, { $set: { 'part._rank': i++ } })
			}
			continue
		}

		const oldPartIdsAndRanks =
			oldPartIdsAndRanks0 ?? cache.Parts.findFetch({ segmentId }).map((p) => ({ id: p._id, rank: p._rank }))

		const preservedPreviousParts = oldPartIdsAndRanks.filter((p) => newPartsMap.has(p.id))

		if (preservedPreviousParts.length === 0) {
			// position them all before the first
			const firstPartRank = newParts.length > 0 ? _.min(newParts, (p) => p._rank)._rank : 0
			let i = firstPartRank - orphanedPartInstances.length
			for (const partInfo of orphanedPartInstances) {
				cache.PartInstances.update(partInfo.instanceId, { $set: { 'part._rank': i++ } })
			}
		} else {
			// they need interleaving

			// compile the old order, and get a list of the ones that still remain in the new state
			const allParts = new Map<PartId, { rank: number; id: PartId; instanceId?: PartInstanceId }>()
			for (const oldPart of oldPartIdsAndRanks) allParts.set(oldPart.id, oldPart)
			for (const orphanedPart of orphanedPartInstances) allParts.set(orphanedPart.id, orphanedPart)

			// Now go through and update their ranks
			const remainingPreviousParts = _.sortBy(Array.from(allParts.values()), (p) => p.rank).filter(
				(p) => p.instanceId || newPartsMap.has(p.id)
			)
			for (let i = 0; i < remainingPreviousParts.length - 1; ) {
				// Find the range to process this iteration
				const beforePartIndex = i
				const afterPartIndex = remainingPreviousParts.findIndex((p, o) => o > i && !p.instanceId)

				if (afterPartIndex === beforePartIndex + 1) {
					// no dynamic parts in between
					i++
					continue
				} else if (afterPartIndex === -1) {
					// We will reach the end, so make sure we stop
					i = remainingPreviousParts.length
				} else {
					// next iteration should look from the next fixed point
					i = afterPartIndex
				}

				const firstDynamicIndex = beforePartIndex + 1
				const lastDynamicIndex = afterPartIndex === -1 ? remainingPreviousParts.length - 1 : afterPartIndex - 1

				// Calculate the rank change per part
				const dynamicPartCount = lastDynamicIndex - firstDynamicIndex + 1
				const basePartRank = newPartsMap.get(remainingPreviousParts[beforePartIndex].id)?._rank!
				const afterPartRank =
					afterPartIndex === -1
						? basePartRank + 1
						: newPartsMap.get(remainingPreviousParts[afterPartIndex].id)?._rank!
				const delta = (afterPartRank - basePartRank) / (dynamicPartCount + 1)

				let prevRank = basePartRank
				for (let o = firstDynamicIndex; o <= lastDynamicIndex; o++) {
					const newRank = (prevRank = prevRank + delta)

					const orphanedPart = remainingPreviousParts[o]
					if (orphanedPart.instanceId && orphanedPart.rank !== newRank) {
						cache.PartInstances.update(orphanedPart.instanceId, { $set: { 'part._rank': newRank } })
						updatedParts++
					}
				}
			}
		}
	}
	logger.debug(`updatePartRanks: ${updatedParts} PartInstances updated`)
}

export namespace ServerRundownAPI {
	/** Remove a RundownPlaylist and all its contents */
	export function removeRundownPlaylist(context: MethodContext, playlistId: RundownPlaylistId) {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const cache = waitForPromise(initCacheForRundownPlaylist(access.playlist))
		const result = removeRundownPlaylistInner(cache, playlistId)
		waitForPromise(cache.saveAllToDatabase())
		return result
	}
	/** Remove an individual rundown */
	export function removeRundown(context: MethodContext, rundownId: RundownId) {
		check(rundownId, String)
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
		const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(access.rundown._id))
		const result = removeRundownInner(cache, rundownId)
		waitForPromise(cache.saveAllToDatabase())
		return result
	}

	export function unsyncRundown(context: MethodContext, rundownId: RundownId): void {
		check(rundownId, String)
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
		const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(access.rundown._id))
		const result = unsyncRundownInner(cache, rundownId)
		waitForPromise(cache.saveAllToDatabase())
		return result
	}
	/** Resync all rundowns in a rundownPlaylist */
	export function resyncRundownPlaylist(
		context: MethodContext,
		playlistId: RundownPlaylistId
	): ReloadRundownPlaylistResponse {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		return innerResyncRundownPlaylist(access.playlist)
	}
	export function resyncRundown(context: MethodContext, rundownId: RundownId): TriggerReloadDataResponse {
		check(rundownId, String)
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
		return innerResyncRundown(access.rundown)
	}

	export function unsyncRundownInner(cache: CacheForRundownPlaylist, rundownId: RundownId): void {
		const span = profiler.startSpan('api.rundown.unsyncRundownInner')

		check(rundownId, String)
		logger.info('unsyncRundown ' + rundownId)

		let rundown = cache.Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		if (!rundown.orphaned) {
			cache.Rundowns.update(rundown._id, {
				$set: {
					orphaned: 'deleted',
				},
			})
		} else {
			logger.info(`Rundown "${rundownId}" was already unsynced`)
		}

		span?.end()
	}
	/** Remove a RundownPlaylist and all its contents */
	export function removeRundownPlaylistInner(cache: CacheForRundownPlaylist, playlistId: RundownPlaylistId) {
		check(playlistId, String)
		logger.info('removeRundownPlaylist ' + playlistId)

		const playlist = cache.RundownPlaylists.findOne(playlistId)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)
		if (playlist.active)
			throw new Meteor.Error(400, `Not allowed to remove an active RundownPlaylist "${playlistId}".`)

		removeRundownPlaylistFromCache(cache, playlist)
	}
	/** Remove an individual rundown */
	export function removeRundownInner(cache: CacheForRundownPlaylist, rundownId: RundownId) {
		check(rundownId, String)
		logger.info('removeRundown ' + rundownId)

		const rundown = cache.Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.playlistId) {
			const playlist = cache.RundownPlaylists.findOne(rundown.playlistId)
			if (playlist && playlist.active && playlist.currentPartInstanceId) {
				const partInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)
				if (partInstance && partInstance.rundownId === rundown._id) {
					throw new Meteor.Error(
						400,
						`Not allowed to remove an active Rundown "${rundownId}". (active part: "${partInstance._id}" in playlist "${playlist._id}")`
					)
				}
			}
		}

		removeRundownFromCache(cache, rundown)
	}
	/** Resync all rundowns in a rundownPlaylist */
	export function innerResyncRundownPlaylist(playlist: RundownPlaylist): ReloadRundownPlaylistResponse {
		logger.info('resyncRundownPlaylist ' + playlist._id)

		const response: ReloadRundownPlaylistResponse = {
			rundownsResponses: Rundowns.find({ playlistId: playlist._id })
				.fetch()
				.map((rundown) => {
					return {
						rundownId: rundown._id,
						response: innerResyncRundown(rundown),
					}
				}),
		}
		return response
	}
	export function resyncSegment(
		context: MethodContext,
		rundownId: RundownId,
		segmentId: SegmentId
	): TriggerReloadDataResponse {
		check(segmentId, String)
		rundownContentAllowWrite(context.userId, { rundownId })
		logger.info('resyncSegment ' + segmentId)
		const segment = Segments.findOne(segmentId)
		if (!segment) throw new Meteor.Error(404, `Segment "${segmentId}" not found!`)

		const rundown = Rundowns.findOne({ _id: segment.rundownId })
		if (!rundown) throw new Meteor.Error(404, `Rundown "${segment.rundownId}" not found!`)

		// Orphaned flag will be reset by the response update
		return IngestActions.reloadSegment(rundown, segment)
	}

	export function innerResyncRundown(rundown: Rundown): TriggerReloadDataResponse {
		logger.info('resyncRundown ' + rundown._id)

		// if (rundown.active) throw new Meteor.Error(400,`Not allowed to resync an active Rundown "${rundownId}".`)

		// Orphaned flag will be reset by the response update
		return IngestActions.reloadRundown(rundown)
	}

	/** Move a rundown manually (by a user in Sofie)  */
	export function moveRundown(
		context: MethodContext,
		/** The rundown to be moved */
		rundownId: RundownId,
		/** Which playlist to move into. If null, move into a (new) separate playlist */
		intoPlaylistId: RundownPlaylistId | null,
		/** The new rundowns in the new playlist */
		rundownsIdsInPlaylistInOrder: RundownId[]
	): void {
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)

		const rundown: Rundown = access.rundown
		const oldPlaylist: RundownPlaylist | null = access.playlist

		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (oldPlaylist && rundown.playlistId !== oldPlaylist._id)
			throw new Meteor.Error(
				500,
				`moveRundown: rundown.playlistId "${rundown.playlistId}" is not equal to oldPlaylist._id "${oldPlaylist._id}"`
			)

		let intoPlaylist: RundownPlaylist | null = null
		if (intoPlaylistId) {
			const access2 = RundownPlaylistContentWriteAccess.anyContent(context, intoPlaylistId)

			intoPlaylist = access2.playlist
			if (!intoPlaylist) throw new Meteor.Error(404, `Playlist "${intoPlaylistId}" not found!`)
		}

		const studio = Studios.findOne(rundown.studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${rundown.studioId}" of rundown "${rundown._id}" not found!`)

		if (intoPlaylist && intoPlaylist.studioId !== rundown.studioId) {
			throw new Meteor.Error(
				404,
				`Cannot move Rundown "${rundown._id}" into playlist "${intoPlaylist._id}" because they are in different studios ("${intoPlaylist.studioId}", "${rundown.studioId}")!`
			)
		}

		// Do a check if we're allowed to move out of currently playing playlist:
		if (oldPlaylist) {
			if (!allowedToMoveRundownOutOfPlaylist(oldPlaylist, rundown)) {
				throw new Meteor.Error(400, `Not allowed to move currently playing rundown!`)
			}
		}

		const peripheralDevice: PeripheralDevice | undefined =
			rundown.peripheralDeviceId && PeripheralDevices.findOne(rundown.peripheralDeviceId)

		if (intoPlaylist) {
			// Move into an existing playlist:

			if (intoPlaylist._id === oldPlaylist?._id) {
				// Move the rundown within the playlist

				const i = rundownsIdsInPlaylistInOrder.indexOf(rundownId)
				if (i === -1)
					throw new Meteor.Error(500, `RundownId "${rundownId}" not found in rundownsIdsInPlaylistInOrder`)

				const rundownIdBefore: RundownId | undefined = rundownsIdsInPlaylistInOrder[i - 1]
				const rundownIdAfter: RundownId | undefined = rundownsIdsInPlaylistInOrder[i + 1]

				const rundownBefore: Rundown | undefined = rundownIdBefore && Rundowns.findOne(rundownIdBefore)
				const rundownAfter: Rundown | undefined = rundownIdAfter && Rundowns.findOne(rundownIdAfter)

				let newRank: number | undefined = getRank(rundownBefore, rundownAfter)

				if (newRank === undefined) throw new Meteor.Error(500, `newRank is undefined`)

				RundownPlaylists.update(intoPlaylist._id, {
					$set: {
						rundownRanksAreSetInSofie: true,
					},
				})
				Rundowns.update(rundown._id, {
					$set: {
						_rank: newRank,
					},
				})
			} else {
				// Move into another playlist

				// Note: When moving into another playlist, the rundown is placed last.

				Rundowns.update(rundown._id, {
					$set: {
						playlistId: intoPlaylist._id,
						playlistIdIsSetInSofie: true,
						_rank: 99999, // The rank will be set later, in updateRundownsInPlaylist
					},
				})
				rundown.playlistId = intoPlaylist._id
				rundown.playlistIdIsSetInSofie = true

				// When updating the rundowns in the playlist, the newly moved rundown will be given it's proper _rank:
				const rundownPlaylistInfo = produceRundownPlaylistInfoFromRundown(studio, rundown, peripheralDevice)
				updateRundownsInPlaylist(rundownPlaylistInfo.rundownPlaylist, rundownPlaylistInfo.order, rundown)
			}
		} else {
			// Move into a new playlist:

			const playlist = defaultPlaylistForRundown(rundown, studio)
			RundownPlaylists.insert(playlist)

			Rundowns.update(rundown._id, {
				$set: {
					playlistId: playlist._id,
					playlistIdIsSetInSofie: true,
					_rank: 1,
				},
			})
		}

		if (oldPlaylist) {
			// Remove the old playlist if it's empty:
			removeEmptyPlaylists(oldPlaylist.studioId)
		}
	}
	/** Restore the order of rundowns in a playlist, giving control over the ordering back to the NRCS */
	export function restoreRundownsInPlaylistToDefaultOrder(context: MethodContext, playlistId: RundownPlaylistId) {
		const access = RundownPlaylistContentWriteAccess.anyContent(context, playlistId)
		if (!access.playlist) throw new Meteor.Error(404, `Playlist "${playlistId}" not found!`)

		const studio = Studios.findOne(access.playlist.studioId)
		if (!studio)
			throw new Meteor.Error(
				404,
				`Studio "${access.playlist.studioId}" of playlist "${access.playlist._id}" not found!`
			)

		RundownPlaylists.update(access.playlist._id, {
			$set: {
				rundownRanksAreSetInSofie: false,
			},
		})
		// Update local copy:
		access.playlist.rundownRanksAreSetInSofie = false

		// Update the _rank of the rundowns
		const order = produceRundownPlaylistRanks(studio, access.playlist._id)
		updateRundownsInPlaylist(access.playlist, order)
	}
}
export namespace ClientRundownAPI {
	export function rundownPlaylistNeedsResync(context: MethodContext, playlistId: RundownPlaylistId): string[] {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const playlist = access.playlist

		const rundowns = playlist.getRundowns()
		const errors = rundowns.map((rundown) => {
			if (!rundown.importVersions) return 'unknown'

			if (rundown.importVersions.core !== (PackageInfo.versionExtended || PackageInfo.version))
				return 'coreVersion'

			const showStyleVariant = ShowStyleVariants.findOne(rundown.showStyleVariantId)
			if (!showStyleVariant) return 'missing showStyleVariant'
			if (rundown.importVersions.showStyleVariant !== (showStyleVariant._rundownVersionHash || 0))
				return 'showStyleVariant'

			const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
			if (!showStyleBase) return 'missing showStyleBase'
			if (rundown.importVersions.showStyleBase !== (showStyleBase._rundownVersionHash || 0))
				return 'showStyleBase'

			const blueprint = Blueprints.findOne(showStyleBase.blueprintId)
			if (!blueprint) return 'missing blueprint'
			if (rundown.importVersions.blueprint !== (blueprint.blueprintVersion || 0)) return 'blueprint'

			const studio = Studios.findOne(rundown.studioId)
			if (!studio) return 'missing studio'
			if (rundown.importVersions.studio !== (studio._rundownVersionHash || 0)) return 'studio'
		})

		return _.compact(errors)
	}
	// Validate the blueprint config used for this rundown, to ensure that all the required fields are specified
	export function rundownPlaylistValidateBlueprintConfig(
		context: MethodContext,
		playlistId: RundownPlaylistId
	): RundownPlaylistValidateBlueprintConfigResult {
		check(playlistId, String)

		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const rundownPlaylist = access.playlist

		const studio = rundownPlaylist.getStudio()
		const studioBlueprint = Blueprints.findOne(studio.blueprintId)
		if (!studioBlueprint) throw new Meteor.Error(404, `Studio blueprint "${studio.blueprintId}" not found!`)

		const rundowns = rundownPlaylist.getRundowns()
		const uniqueShowStyleCompounds = _.uniq(
			rundowns,
			undefined,
			(rundown) => `${rundown.showStyleBaseId}-${rundown.showStyleVariantId}`
		)

		// Load all variants/compounds
		const { showStyleBases, showStyleVariants } = waitForPromiseObj({
			showStyleBases: asyncCollectionFindFetch(ShowStyleBases, {
				_id: { $in: uniqueShowStyleCompounds.map((r) => r.showStyleBaseId) },
			}),
			showStyleVariants: asyncCollectionFindFetch(ShowStyleVariants, {
				_id: { $in: uniqueShowStyleCompounds.map((r) => r.showStyleVariantId) },
			}),
		})
		const showStyleBlueprints = Blueprints.find({
			_id: { $in: _.uniq(_.compact(showStyleBases.map((c) => c.blueprintId))) },
		}).fetch()

		const showStyleBasesMap = normalizeArray(showStyleBases, '_id')
		const showStyleVariantsMap = normalizeArray(showStyleVariants, '_id')
		const showStyleBlueprintsMap = normalizeArray(showStyleBlueprints, '_id')

		const showStyleWarnings: RundownPlaylistValidateBlueprintConfigResult['showStyles'] = uniqueShowStyleCompounds.map(
			(rundown) => {
				const showStyleBase = showStyleBasesMap[unprotectString(rundown.showStyleBaseId)]
				const showStyleVariant = showStyleVariantsMap[unprotectString(rundown.showStyleVariantId)]
				const id = `${rundown.showStyleBaseId}-${rundown.showStyleVariantId}`
				if (!showStyleBase || !showStyleVariant) {
					return {
						id: id,
						name: `${showStyleBase ? showStyleBase.name : rundown.showStyleBaseId}-${
							rundown.showStyleVariantId
						}`,
						checkFailed: true,
						fields: [],
					}
				}

				const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
				if (!compound) {
					return {
						id: id,
						name: `${showStyleBase ? showStyleBase.name : rundown.showStyleBaseId}-${
							rundown.showStyleVariantId
						}`,
						checkFailed: true,
						fields: [],
					}
				}

				const blueprint = showStyleBlueprintsMap[unprotectString(compound.blueprintId)]
				if (!blueprint) {
					return {
						id: id,
						name: compound.name,
						checkFailed: true,
						fields: [],
					}
				} else {
					return {
						id: id,
						name: compound.name,
						checkFailed: false,
						fields: findMissingConfigs(blueprint.showStyleConfigManifest, compound.blueprintConfig),
					}
				}
			}
		)

		return {
			studio: findMissingConfigs(studioBlueprint.studioConfigManifest, studio.blueprintConfig),
			showStyles: showStyleWarnings,
		}
	}
}

class ServerRundownAPIClass extends MethodContextAPI implements NewRundownAPI {
	removeRundownPlaylist(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerRundownAPI.removeRundownPlaylist(this, playlistId))
	}
	resyncRundownPlaylist(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerRundownAPI.resyncRundownPlaylist(this, playlistId))
	}
	rundownPlaylistNeedsResync(playlistId: RundownPlaylistId) {
		return makePromise(() => ClientRundownAPI.rundownPlaylistNeedsResync(this, playlistId))
	}
	rundownPlaylistValidateBlueprintConfig(playlistId: RundownPlaylistId) {
		return makePromise(() => ClientRundownAPI.rundownPlaylistValidateBlueprintConfig(this, playlistId))
	}
	removeRundown(rundownId: RundownId) {
		return makePromise(() => ServerRundownAPI.removeRundown(this, rundownId))
	}
	resyncRundown(rundownId: RundownId) {
		return makePromise(() => ServerRundownAPI.resyncRundown(this, rundownId))
	}
	resyncSegment(rundownId: RundownId, segmentId: SegmentId) {
		return makePromise(() => ServerRundownAPI.resyncSegment(this, rundownId, segmentId))
	}
	unsyncRundown(rundownId: RundownId) {
		return makePromise(() => ServerRundownAPI.unsyncRundown(this, rundownId))
	}
	moveRundown(
		rundownId: RundownId,
		intoPlaylistId: RundownPlaylistId | null,
		rundownsIdsInPlaylistInOrder: RundownId[]
	) {
		return makePromise(() =>
			ServerRundownAPI.moveRundown(this, rundownId, intoPlaylistId, rundownsIdsInPlaylistInOrder)
		)
	}
	restoreRundownsInPlaylistToDefaultOrder(playlistId: RundownPlaylistId) {
		return makePromise(() => ServerRundownAPI.restoreRundownsInPlaylistToDefaultOrder(this, playlistId))
	}
}
registerClassToMeteorMethods(RundownAPIMethods, ServerRundownAPIClass, false)
