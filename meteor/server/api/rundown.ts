import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../lib/check'
import { Rundowns, Rundown, DBRundown, RundownId } from '../../lib/collections/Rundowns'
import { Part, Parts, DBPart, PartId } from '../../lib/collections/Parts'
import { Pieces, Piece } from '../../lib/collections/Pieces'
import { AdLibPieces, AdLibPiece } from '../../lib/collections/AdLibPieces'
import { Segments, SegmentId } from '../../lib/collections/Segments'
import {
	saveIntoDb,
	getRank,
	getCurrentTime,
	asyncCollectionUpdate,
	waitForPromiseAll,
	getHash,
	literal,
	waitForPromise,
	unprotectObjectArray,
	protectString,
	unprotectString,
	makePromise
} from '../../lib/lib'
import { logger } from '../logging'
import { triggerUpdateTimelineAfterIngestData } from './playout/playout'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownAPI, RundownAPIMethods } from '../../lib/api/rundown'
import { updateExpectedMediaItemsOnPart } from './expectedMediaItems'
import { ShowStyleVariants, ShowStyleVariant, ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { Studios, Studio } from '../../lib/collections/Studios'
import { IngestRundown, BlueprintResultOrderedRundowns } from 'tv-automation-sofie-blueprints-integration'
import { StudioConfigContext } from './blueprints/context'
import { loadStudioBlueprints, loadShowStyleBlueprints } from './blueprints/cache'
import { PackageInfo } from '../coreSystem'
import { IngestActions } from './ingest/actions'
import { DBRundownPlaylist, RundownPlaylists, RundownPlaylistId, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { updateExpectedPlayoutItemsOnPart } from './ingest/expectedPlayoutItems'
import { PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PartInstances } from '../../lib/collections/PartInstances'
import { ReloadRundownPlaylistResponse, ReloadRundownResponse } from '../../lib/api/userActions'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess, StudioReadAccess } from '../security/studio'
import { RundownPlaylistContentWriteAccess, RundownPlaylistReadAccess } from '../security/rundownPlaylist'

export function selectShowStyleVariant (studio: Studio, ingestRundown: IngestRundown): { variant: ShowStyleVariant, base: ShowStyleBase } | null {
	if (!studio.supportedShowStyleBase.length) {
		logger.debug(`Studio "${studio._id}" does not have any supportedShowStyleBase`)
		return null
	}
	const showStyleBases = ShowStyleBases.find({ _id: { $in: studio.supportedShowStyleBase } }).fetch()
	let showStyleBase = _.first(showStyleBases)
	if (!showStyleBase) {
		logger.debug(`No showStyleBases matching with supportedShowStyleBase [${studio.supportedShowStyleBase}] from studio "${studio._id}"`)
		return null
	}

	const context = new StudioConfigContext(studio)

	const studioBlueprint = loadStudioBlueprints(studio)
	if (!studioBlueprint) throw new Meteor.Error(500, `Studio "${studio._id}" does not have a blueprint`)

	if (!studioBlueprint.blueprint.getShowStyleId) throw new Meteor.Error(500, `Studio "${studio._id}" blueprint missing property getShowStyleId`)

	const showStyleId: ShowStyleBaseId | null = protectString(studioBlueprint.blueprint.getShowStyleId(context, unprotectObjectArray(showStyleBases) as any, ingestRundown))
	if (showStyleId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned showStyleId = null`)
		return null
	}
	showStyleBase = _.find(showStyleBases, s => s._id === showStyleId)
	if (!showStyleBase) {
		logger.debug(`No ShowStyleBase found matching showStyleId "${showStyleId}", from studio "${studio._id}" blueprint`)
		return null
	}
	const showStyleVariants = ShowStyleVariants.find({ showStyleBaseId: showStyleBase._id }).fetch()
	if (!showStyleVariants.length) throw new Meteor.Error(500, `ShowStyleBase "${showStyleBase._id}" has no variants`)

	const showStyleBlueprint = loadShowStyleBlueprints(showStyleBase)
	if (!showStyleBlueprint) throw new Meteor.Error(500, `ShowStyleBase "${showStyleBase._id}" does not have a valid blueprint`)

	const variantId: ShowStyleVariantId | null = protectString(
		showStyleBlueprint.blueprint.getShowStyleVariantId(context, unprotectObjectArray(showStyleVariants) as any, ingestRundown)
	)
	if (variantId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned variantId = null in .getShowStyleVariantId`)
		return null
	} else {
		const showStyleVariant = _.find(showStyleVariants, s => s._id === variantId)
		if (!showStyleVariant) throw new Meteor.Error(404, `Blueprint returned variantId "${variantId}", which was not found!`)

		return {
			variant: showStyleVariant,
			base: showStyleBase
		}
	}
}

export interface RundownPlaylistAndOrder {
	rundownPlaylist: DBRundownPlaylist
	order: BlueprintResultOrderedRundowns
}

export function produceRundownPlaylistInfo (studio: Studio, currentRundown: DBRundown, peripheralDevice: PeripheralDevice | undefined): RundownPlaylistAndOrder {

	const studioBlueprint = loadStudioBlueprints(studio)
	if (!studioBlueprint) throw new Meteor.Error(500, `Studio "${studio._id}" does not have a blueprint`)

	if (currentRundown.playlistExternalId && studioBlueprint.blueprint.getRundownPlaylistInfo) {

		// Note: We have to use the ExternalId of the playlist here, since we actually don't know the id of the playlist yet
		const allRundowns = Rundowns.find({ playlistExternalId: currentRundown.playlistExternalId }).fetch()

		if (!_.find(allRundowns, (rd => rd._id === currentRundown._id))) throw new Meteor.Error(500, `produceRundownPlaylistInfo: currentRundown ("${currentRundown._id}") not found in collection!`)

		const playlistInfo = studioBlueprint.blueprint.getRundownPlaylistInfo(
			allRundowns
		)
		if (!playlistInfo) throw new Meteor.Error(500, `blueprint.getRundownPlaylistInfo() returned null for externalId "${currentRundown.playlistExternalId}"`)

		const playlistId: RundownPlaylistId = protectString(getHash(playlistInfo.playlist.externalId))

		const existingPlaylist = RundownPlaylists.findOne(playlistId)

		const playlist = _.extend(existingPlaylist || {}, _.omit(literal<DBRundownPlaylist>({
			_id: playlistId,
			externalId: playlistInfo.playlist.externalId,
			studioId: studio._id,
			name: playlistInfo.playlist.name,
			expectedStart: playlistInfo.playlist.expectedStart,
			expectedDuration: playlistInfo.playlist.expectedDuration,

			created: existingPlaylist ? existingPlaylist.created : getCurrentTime(),
			modified: getCurrentTime(),

			peripheralDeviceId: peripheralDevice ? peripheralDevice._id : protectString(''),

			currentPartInstanceId: null,
			nextPartInstanceId: null,
			previousPartInstanceId: null
		}), [ 'currentPartInstanceId', 'nextPartInstanceId', 'previousPartInstanceId', 'created' ])) as DBRundownPlaylist

		let order = playlistInfo.order
		if (!order) {
			// If no order is provided, fall back to sort the rundowns by their name:
			const rundownsInPlaylist = Rundowns.find({
				playlistExternalId: playlist.externalId
			}, {
				sort: {
					name: 1
				}
			}).fetch()
			order = _.object(rundownsInPlaylist.map((i, index) => [i._id, index + 1]))
		}

		return {
			rundownPlaylist: playlist,
			order: order
		}
	} else {
		// It's a rundown that "doesn't have a playlist", so we jsut make one up:
		const playlistId: RundownPlaylistId = protectString(getHash(unprotectString(currentRundown._id)))

		const existingPlaylist = RundownPlaylists.findOne(playlistId)

		const playlist = _.extend(existingPlaylist || {}, _.omit(literal<DBRundownPlaylist>({
			_id: playlistId,
			externalId: currentRundown.externalId,
			studioId: studio._id,
			name: currentRundown.name,
			expectedStart: currentRundown.expectedStart,
			expectedDuration: currentRundown.expectedDuration,

			created: existingPlaylist ? existingPlaylist.created : getCurrentTime(),
			modified: getCurrentTime(),

			peripheralDeviceId: peripheralDevice ? peripheralDevice._id : protectString(''),

			currentPartInstanceId: null,
			nextPartInstanceId: null,
			previousPartInstanceId: null
		}), [ 'currentPartInstanceId', 'nextPartInstanceId', 'previousPartInstanceId' ])) as DBRundownPlaylist

		return {
			rundownPlaylist: playlist,
			order: _.object([[currentRundown._id, 1]])
		}
	}
}

/**
 * Removes Segments from the database
 * @param rundownId The Rundown id to remove from
 * @param segmentIds The Segment ids to be removed
 */
export function removeSegments (rundownId: RundownId, segmentIds: SegmentId[]): number {
	logger.debug('removeSegments', rundownId, segmentIds)
	const count = Segments.remove({
		_id: { $in: segmentIds },
		rundownId: rundownId
	})
	if (count > 0) {
		afterRemoveSegments(rundownId, segmentIds)
	}
	return count
}
/**
 * After Segments have been removed, handle the contents.
 * This will trigger an update of the timeline
 * @param rundownId Id of the Rundown
 * @param segmentIds Id of the Segments
 */
export function afterRemoveSegments (rundownId: RundownId, segmentIds: SegmentId[]) {
	// Remove the parts:
	saveIntoDb(Parts, {
		rundownId: rundownId,
		segmentId: { $in: segmentIds }
	},[],{
		afterRemoveAll (parts) {
			afterRemoveParts(rundownId, parts)
		}
	})

	triggerUpdateTimelineAfterIngestData(rundownId, segmentIds)
}

/**
 * After Parts have been removed, handle the contents.
 * This will NOT trigger an update of the timeline
 * @param rundownId Id of the Rundown
 * @param removedParts The parts that have been removed
 */
export function afterRemoveParts (rundownId: RundownId, removedParts: DBPart[]) {
	saveIntoDb(Parts, {
		rundownId: rundownId,
		dynamicallyInserted: true,
		afterPart: { $in: _.map(removedParts, p => p._id) }
	}, [], {
		afterRemoveAll (parts) {
			// Do the same for any affected dynamicallyInserted Parts
			afterRemoveParts(rundownId, parts)
		}
	})

	// Clean up all the db items that belong to the removed Parts
	// TODO - is there anything else to remove?

	ExpectedPlayoutItems.remove({
		rundownId: rundownId,
		partId: { $in: _.map(removedParts, p => p._id) }
	})

	saveIntoDb<Piece, Piece>(Pieces, {
		rundownId: rundownId,
		partId: { $in: _.map(removedParts, p => p._id) }
	}, [], {
		afterRemoveAll (pieces) {
			afterRemovePieces(rundownId, pieces)
		}
	})
	saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
		rundownId: rundownId,
		partId: { $in: _.map(removedParts, p => p._id) }
	}, [], {
		afterRemoveAll (pieces) {
			afterRemovePieces(rundownId, pieces)
		}
	})
	_.each(removedParts, part => {
		// TODO - batch?
		updateExpectedMediaItemsOnPart(part.rundownId, part._id)
		updateExpectedPlayoutItemsOnPart(part.rundownId, part._id)
	})
}
/**
 * After Pieces have been removed, handle the contents.
 * This will NOT trigger an update of the timeline
 * @param rundownId Id of the Rundown
 * @param removedPieces The pieces that have been removed
 */
export function afterRemovePieces (rundownId: RundownId, removedPieces: Array<Piece | AdLibPiece>) {
	ExpectedPlayoutItems.remove({
		rundownId: rundownId,
		pieceId: { $in: _.map(removedPieces, p => p._id) }
	})
}
/**
 * Update the ranks of all parts.
 * Uses the ranks to determine order within segments, and then updates part ranks based on segment ranks.
 * Adlib/dynamic parts get assigned ranks based on the rank of what they are told to be after
 * @param rundownId
 */
export function updatePartRanks (rundown: Rundown): Array<Part> {
	// TODO-PartInstance this will need to consider partInstances that have no backing part at some point, or do we not care about their rank?

	const pSegmentsAndParts = rundown.getSegmentsAndParts()

	const { segments, parts: orgParts } = waitForPromise(pSegmentsAndParts)

	logger.debug(`updatePartRanks (${orgParts.length} parts, ${segments.length} segments)`)

	const parts: Array<Part> = []
	const partsToPutAfter: {[partId: string]: Array<Part>} = {}

	_.each(orgParts, (part) => {
		const afterPart: string | undefined = unprotectString(part.afterPart)
		if (afterPart) {
			if (!partsToPutAfter[afterPart]) partsToPutAfter[afterPart] = []
			partsToPutAfter[afterPart].push(part)
		} else {
			parts.push(part)
		}
	})

	let ps: Array<Promise<any>> = []

	// Update _rank and save to database:
	let newRank = 0
	let prevSegmentId: SegmentId = protectString('')
	_.each(parts, (part) => {
		if (part.segmentId !== prevSegmentId) {
			newRank = 0
			prevSegmentId = part.segmentId
		}
		if (part._rank !== newRank) {
			ps.push(asyncCollectionUpdate(Parts, part._id, { $set: { _rank: newRank } }))
			// Update in place, for the upcoming algorithm
			part._rank = newRank
		}
		newRank++
	})
	logger.debug(`updatePartRanks: ${ps.length} parts updated`)

	// Insert the parts that are to be put after other parts:
	let hasAddedAnything = true
	while (hasAddedAnything) {
		hasAddedAnything = false

		_.each(partsToPutAfter, (dynamicParts, insertAfterPartId0) => {
			const insertAfterPartId: PartId = protectString(insertAfterPartId0)

			let partBefore: Part | null = null
			let partAfter: Part | null = null
			let insertI = -1
			_.each(parts, (part, i) => {
				if (part._id === insertAfterPartId) {
					partBefore = part

					insertI = i + 1
				} else if (
					partBefore &&
					part.segmentId === partBefore.segmentId &&
					!partAfter
				) {
					partAfter = part
				}
			})

			if (partBefore) {

				if (insertI !== -1) {
					_.each(dynamicParts, (dynamicPart, i) => {
						const newRank = getRank(partBefore, partAfter, i, dynamicParts.length)

						if (dynamicPart._rank !== newRank) {
							dynamicPart._rank = newRank
							ps.push(asyncCollectionUpdate(Parts, dynamicPart._id, { $set: { _rank: dynamicPart._rank } }))
							ps.push(asyncCollectionUpdate(PartInstances, {
								'part._id': dynamicPart._id,
								reset: { $ne: true }
							}, { $set: { 'part._rank': dynamicPart._rank } }))
						}

						parts.splice(insertI, 0, dynamicPart)
						insertI++
						hasAddedAnything = true
					})
				}
				delete partsToPutAfter[insertAfterPartId0]
			} else {
				// TODO - part is invalid and should be deleted/warned about
			}
		})
	}
	waitForPromiseAll(ps)

	return parts
}

export namespace ServerRundownAPI {
	/** Remove a RundownPlaylist and all its contents */
	export function removeRundownPlaylist (context: MethodContext, playlistId: RundownPlaylistId) {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		return innerRemoveRundownPlaylist(access.playlist)
	}
	/** Remove an individual rundown */
	export function removeRundown (context: MethodContext, rundownId: RundownId) {
		check(rundownId, String)
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
		return innerRemoveRundown(access.rundown)
	}
	/** Resync all rundowns in a rundownPlaylist */
	export function resyncRundownPlaylist (context: MethodContext, playlistId: RundownPlaylistId): ReloadRundownPlaylistResponse {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		return innerResyncRundownPlaylist(access.playlist)
	}
	export function resyncRundown (context: MethodContext, rundownId: RundownId): ReloadRundownResponse {
		check(rundownId, String)
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
		return innerResyncRundown(access.rundown)
	}
	export function unsyncRundown (context: MethodContext, rundownId: RundownId): void {
		check(rundownId, String)
		const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
		return innerUnsyncRundown(access.rundown)
	}
}
/** Remove a RundownPlaylist and all its contents */
export function innerRemoveRundownPlaylist (playlist: RundownPlaylist) {
	logger.info('removeRundownPlaylist ' + playlist._id)
	if (playlist.active) throw new Meteor.Error(400,`Not allowed to remove an active RundownPlaylist "${playlist._id}".`)

	playlist.remove()
}
/** Remove an individual rundown */
export function innerRemoveRundown (rundown: Rundown) {
	logger.info('removeRundown ' + rundown._id)

	if (rundown.playlistId) {
		const playlist = RundownPlaylists.findOne(rundown.playlistId)
		if (playlist && playlist.active && playlist.currentPartInstanceId) {
			const partInstance = PartInstances.findOne(playlist.currentPartInstanceId)
			if (partInstance && partInstance.rundownId === rundown._id) {
				throw new Meteor.Error(400,`Not allowed to remove an active Rundown "${rundown._id}". (active part: "${partInstance._id}" in playlist "${playlist._id}")`)
			}
		}
	}
	rundown.remove()
}
/** Resync all rundowns in a rundownPlaylist */
export function innerResyncRundownPlaylist (playlist: RundownPlaylist): ReloadRundownPlaylistResponse {
	logger.info('resyncRundownPlaylist ' + playlist._id)

	const response: ReloadRundownPlaylistResponse = {
		rundownsResponses: playlist.getRundowns().map(rundown => {
			return {
				rundownId: rundown._id,
				response: innerResyncRundown(rundown)
			}
		})
	}
	return response
}
export function innerResyncRundown (rundown: Rundown): ReloadRundownResponse {
	logger.info('resyncRundown ' + rundown._id)

	// if (rundown.active) throw new Meteor.Error(400,`Not allowed to resync an active Rundown "${rundownId}".`)

	Rundowns.update(rundown._id, {
		$set: {
			unsynced: false
		}
	})

	return IngestActions.reloadRundown(rundown)
}
export function innerUnsyncRundown (rundown: Rundown): void {
	logger.info('unsyncRundown ' + rundown._id)

	if (!rundown.unsynced) {
		Rundowns.update(rundown._id, {$set: {
			unsynced: true,
			unsyncedTime: getCurrentTime()
		}})
	} else {
		logger.info(`Rundown "${rundown._id}" was already unsynced`)
	}
}
export namespace ClientRundownAPI {
	export function rundownPlaylistNeedsResync (context: MethodContext, playlistId: RundownPlaylistId): string[] {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const playlist = access.playlist

		const rundowns = playlist.getRundowns()
		const errors = rundowns.map(rundown => {
			if (!rundown.importVersions) return 'unknown'

			if (rundown.importVersions.core !== PackageInfo.version) return 'coreVersion'

			const showStyleVariant = ShowStyleVariants.findOne(rundown.showStyleVariantId)
			if (!showStyleVariant) return 'missing showStyleVariant'
			if (rundown.importVersions.showStyleVariant !== (showStyleVariant._rundownVersionHash || 0)) return 'showStyleVariant'

			const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
			if (!showStyleBase) return 'missing showStyleBase'
			if (rundown.importVersions.showStyleBase !== (showStyleBase._rundownVersionHash || 0)) return 'showStyleBase'

			const blueprint = Blueprints.findOne(showStyleBase.blueprintId)
			if (!blueprint) return 'missing blueprint'
			if (rundown.importVersions.blueprint !== (blueprint.blueprintVersion || 0)) return 'blueprint'

			const studio = Studios.findOne(rundown.studioId)
			if (!studio) return 'missing studio'
			if (rundown.importVersions.studio !== (studio._rundownVersionHash || 0)) return 'studio'
		})

		return _.compact(errors)
	}
}

class ServerRundownAPIClass extends MethodContextAPI implements NewRundownAPI {
	removeRundownPlaylist (playlistId: RundownPlaylistId) {
		return makePromise(() => ServerRundownAPI.removeRundownPlaylist(this, playlistId))
	}
	resyncRundownPlaylist (playlistId: RundownPlaylistId) {
		return makePromise(() => ServerRundownAPI.resyncRundownPlaylist(this, playlistId))
	}
	rundownPlaylistNeedsResync (playlistId: RundownPlaylistId) {
		return makePromise(() => ClientRundownAPI.rundownPlaylistNeedsResync(this, playlistId))
	}
	removeRundown (rundownId: RundownId) {
		return makePromise(() => ServerRundownAPI.removeRundown(this, rundownId))
	}
	resyncRundown (rundownId: RundownId) {
		return makePromise(() => ServerRundownAPI.resyncRundown(this, rundownId))
	}
	unsyncRundown (rundownId: RundownId) {
		return makePromise(() => ServerRundownAPI.unsyncRundown(this, rundownId))
	}
}
registerClassToMeteorMethods(RundownAPIMethods, ServerRundownAPIClass, false)
