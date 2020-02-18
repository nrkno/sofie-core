import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Part, Parts, DBPart } from '../../lib/collections/Parts'
import { Pieces, Piece } from '../../lib/collections/Pieces'
import { AdLibPieces, AdLibPiece } from '../../lib/collections/AdLibPieces'
import { Segments } from '../../lib/collections/Segments'
import {
	saveIntoDb,
	fetchBefore,
	getRank,
	fetchAfter,
	getCurrentTime,
	asyncCollectionUpdate,
	waitForPromiseAll
} from '../../lib/lib'
import { logger } from '../logging'
import { ServerPlayoutAPI, triggerUpdateTimelineAfterIngestData } from './playout/playout'
import { PlayoutAPI } from '../../lib/api/playout'
import { Methods, setMeteorMethods } from '../methods'
import { RundownAPI } from '../../lib/api/rundown'
import { updateExpectedMediaItemsOnPart } from './expectedMediaItems'
import { ShowStyleVariants, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { Studios, Studio } from '../../lib/collections/Studios'
import { IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { StudioConfigContext } from './blueprints/context'
import { loadStudioBlueprints, loadShowStyleBlueprints } from './blueprints/cache'
import { PackageInfo } from '../coreSystem'
import { UpdateNext } from './ingest/updateNext'
import { UserActionAPI } from '../../lib/api/userActions'
import { IngestActions } from './ingest/actions'
import { ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { updateExpectedPlayoutItemsOnPart } from './ingest/expectedPlayoutItems'

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

	const showStyleId = studioBlueprint.blueprint.getShowStyleId(context, showStyleBases, ingestRundown)
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

	const variantId = showStyleBlueprint.blueprint.getShowStyleVariantId(context, showStyleVariants, ingestRundown)
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

/**
 * Removes Segments from the database
 * @param rundownId The Rundown id to remove from
 * @param segmentIds The Segment ids to be removed
 */
export function removeSegments (rundownId: string, segmentIds: string[]): number {
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
export function afterRemoveSegments (rundownId: string, segmentIds: string[]) {
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
 * @param skipEnsure For when caller is handling state changes themselves.
 */
export function afterRemoveParts (rundownId: string, removedParts: DBPart[], skipEnsure?: boolean) {
	saveIntoDb(Parts, {
		rundownId: rundownId,
		dynamicallyInserted: true,
		afterPart: { $in: _.map(removedParts, p => p._id) }
	}, [], {
		afterRemoveAll (parts) {
			// Do the same for any affected dynamicallyInserted Parts
			afterRemoveParts(rundownId, parts, skipEnsure)
		}
	})

	// Clean up all the db parts that belong to the removed Parts
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

	const rundown = Rundowns.findOne(rundownId)
	if (rundown && rundown.active && !skipEnsure) {
		// Ensure the next-part is still valid
		UpdateNext.ensureNextPartIsValid(rundown)
	}
}
/**
 * After Pieces have been removed, handle the contents.
 * This will NOT trigger an update of the timeline
 * @param rundownId Id of the Rundown
 * @param removedPieces The pieces that have been removed
 */
export function afterRemovePieces (rundownId: string, removedPieces: Array<Piece | AdLibPiece>) {
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
export function updatePartRanks (rundownId: string): Array<Part> {
	const allSegments = Segments.find({ rundownId: rundownId }, { sort: { _rank: 1 } }).fetch()
	const allParts = Parts.find({ rundownId: rundownId }, { sort: { _rank: 1 } }).fetch()

	logger.debug(`updatePartRanks (${allParts.length} parts, ${allSegments.length} segments)`)

	const rankedParts: Array<Part> = []
	const partsToPutAfter: {[id: string]: Array<Part>} = {}

	_.each(allParts, (part) => {
		if (part.afterPart) {
			if (!partsToPutAfter[part.afterPart]) partsToPutAfter[part.afterPart] = []
			partsToPutAfter[part.afterPart].push(part)
		} else {
			rankedParts.push(part)
		}
	})

	// Sort the parts by segment, then rank
	const segmentRanks: {[segmentId: string]: number} = {}
	_.each(allSegments, seg => {
		segmentRanks[seg._id] = seg._rank
	})
	rankedParts.sort((a, b) => {
		let compareRanks = (ar: number, br: number) => {
			if (ar === br) {
				return 0
			} else if (ar < br) {
				return -1
			} else {
				return 1
			}
		}

		if (a.segmentId === b.segmentId) {
			return compareRanks(a._rank, b._rank)
		} else {
			const aRank = segmentRanks[a.segmentId] || -1
			const bRank = segmentRanks[b.segmentId] || -1
			return compareRanks(aRank, bRank)
		}
	})

	let ps: Array<Promise<any>> = []
	// Ensure that the parts are all correctly rannnnked
	_.each(rankedParts, (part, newRank) => {
		if (part._rank !== newRank) {
			ps.push(asyncCollectionUpdate(Parts, part._id, { $set: { _rank: newRank } }))
			// Update in place, for the upcoming algorithm
			part._rank = newRank
		}
	})
	logger.debug(`updatePartRanks: ${ps.length} parts updated`)

	let hasAddedAnything = true
	while (hasAddedAnything) {
		hasAddedAnything = false

		_.each(partsToPutAfter, (dynamicParts, partId) => {

			let partBefore: Part | null = null
			let partAfter: Part | null = null
			let insertI = -1
			_.each(rankedParts, (part, i) => {
				if (part._id === partId) {
					partBefore = part

					insertI = i + 1
				} else if (partBefore && !partAfter) {
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
						}

						rankedParts.splice(insertI, 0, dynamicPart)
						insertI++
						hasAddedAnything = true
					})
				}
				delete partsToPutAfter[partId]
			} else {
				// TODO - part is invalid and should be deleted/warned about
			}
		})
	}

	waitForPromiseAll(ps)

	return rankedParts
}

export namespace ServerRundownAPI {
	export function removeRundown (rundownId: string) {
		check(rundownId, String)
		logger.info('removeRundown ' + rundownId)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		if (rundown.active) throw new Meteor.Error(400,`Not allowed to remove an active Rundown "${rundownId}".`)

		rundown.remove()
	}
	export function resyncRundown (rundownId: string): UserActionAPI.ReloadRundownResponse {
		check(rundownId, String)
		logger.info('resyncRundown ' + rundownId)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
		// if (rundown.active) throw new Meteor.Error(400,`Not allowed to resync an active Rundown "${rundownId}".`)
		Rundowns.update(rundown._id, {
			$set: {
				unsynced: false
			}
		})

		return IngestActions.reloadRundown(rundown)
	}
	export function unsyncRundown (rundownId: string): void {
		check(rundownId, String)
		logger.info('unsyncRundown ' + rundownId)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		if (!rundown.unsynced) {
			Rundowns.update(rundown._id, {$set: {
				unsynced: true,
				unsyncedTime: getCurrentTime()
			}})
		} else {
			logger.info(`Rundown "${rundownId}" was already unsynced`)
		}
	}
}
export namespace ClientRundownAPI {
	export function rundownNeedsUpdating (rundownId: string) {
		check(rundownId, String)
		// logger.info('rundownNeedsUpdating ' + rundownId)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
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

		return undefined
	}
}

let methods: Methods = {}
methods[RundownAPI.methods.removeRundown] = (rundownId: string) => {
	return ServerRundownAPI.removeRundown(rundownId)
}
methods[RundownAPI.methods.resyncRundown] = (rundownId: string) => {
	return ServerRundownAPI.resyncRundown(rundownId)
}
methods[RundownAPI.methods.unsyncRundown] = (rundownId: string) => {
	return ServerRundownAPI.unsyncRundown(rundownId)
}
methods[RundownAPI.methods.rundownNeedsUpdating] = (rundownId: string) => {
	return ClientRundownAPI.rundownNeedsUpdating(rundownId)
}
// Apply methods:
setMeteorMethods(methods)
