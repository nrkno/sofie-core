import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { Part, Parts, DBPart } from '../../lib/collections/Parts'
import { Piece, Pieces } from '../../lib/collections/Pieces'
import { Segments, DBSegment, Segment } from '../../lib/collections/Segments'
import {
	saveIntoDb,
	fetchBefore,
	getRank,
	fetchAfter,
	getCurrentTime,
	getHash
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

	if (!studioBlueprint.getShowStyleId) throw new Meteor.Error(500, `Studio "${studio._id}" blueprint missing property getShowStyleId`)

	const showStyleId = studioBlueprint.getShowStyleId(context, showStyleBases, ingestRundown)
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

	const variantId = showStyleBlueprint.getShowStyleVariantId(context, showStyleVariants, ingestRundown)
	if (variantId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned variantId = null`)
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
 * After a Segment has beed removed, handle its contents
 * @param segmentId Id of the Segment
 * @param rundownId Id of the Rundown
 */
export function afterRemoveSegment (segmentId: string, rundownId: string) {
	// Remove the parts:
	saveIntoDb(Parts, {
		rundownId: rundownId,
		segmentId: segmentId
	},[],{
		remove (part) {
			removePart(part.rundownId, part)
		}
	})
}
export function removePart (rundownId: string, partOrId: DBPart | string, replacedByPart?: DBPart) {
	let partToRemove: DBPart | undefined = (
		_.isString(partOrId) ?
			Parts.findOne(partOrId) :
			partOrId
	)
	if (partToRemove) {
		Parts.remove(partToRemove._id)
		afterRemovePart(partToRemove, replacedByPart)
		triggerUpdateTimelineAfterIngestData(rundownId)

		if (replacedByPart) {
			Parts.update({
				rundownId: partToRemove.rundownId,
				afterPart: partToRemove._id
			}, {
				$set: {
					afterPart: replacedByPart._id,
				}
			}, {
				multi: true
			})
		} else {
			Parts.remove({
				rundownId: partToRemove.rundownId,
				afterPart: partToRemove._id
			})
		}
	}
}
export function afterRemovePart (removedPart: DBPart, replacedByPart?: DBPart) {
	// TODO - what about adlibs?
	Pieces.remove({
		partId: removedPart._id
	})
	updateExpectedMediaItemsOnPart(removedPart.rundownId, removedPart._id)

	let rundown = Rundowns.findOne(removedPart.rundownId)
	if (rundown) {
		// If the replaced segment is next-to-be-played out,
		// instead make the next-to-be-played-out item the one in it's place
		if (
			rundown.active &&
			rundown.nextPartId === removedPart._id
		) {
			if (!replacedByPart) {
				let partBefore = fetchBefore(Parts, {
					rundownId: removedPart.rundownId
				}, removedPart._rank)

				let nextPartInLine = fetchAfter(Parts, {
					rundownId: removedPart.rundownId,
					_id: { $ne: removedPart._id }
				}, partBefore ? partBefore._rank : null)

				if (nextPartInLine) {
					replacedByPart = nextPartInLine
				}
			}
			ServerPlayoutAPI.setNextPart(rundown._id, replacedByPart ? replacedByPart._id : null)
		}
	}
}
export function updateParts (rundownId: string) {
	let parts0 = Parts.find({ rundownId: rundownId }, { sort: { _rank: 1 } }).fetch()

	let parts: Array<Part> = []
	let partsToInsert: {[id: string]: Array<Part>} = {}

	_.each(parts0, (part) => {
		if (part.afterPart) {
			if (!partsToInsert[part.afterPart]) partsToInsert[part.afterPart] = []
			partsToInsert[part.afterPart].push(part)
		} else {
			parts.push(part)
		}
	})

	let hasAddedAnything = true
	while (hasAddedAnything) {
		hasAddedAnything = false

		_.each(partsToInsert, (sls, partId) => {

			let partBefore: Part | null = null
			let partAfter: Part | null = null
			let insertI = -1
			_.each(parts, (part, i) => {
				if (part._id === partId) {
					partBefore = part

					insertI = i + 1
				} else if (partBefore && !partAfter) {
					partAfter = part

				}
			})

			if (partBefore) {

				if (insertI !== -1) {
					_.each(sls, (part, i) => {
						let newRank = getRank(partBefore, partAfter, i, sls.length)

						if (part._rank !== newRank) {
							part._rank = newRank
							Parts.update(part._id, { $set: { _rank: part._rank } })
						}
						parts.splice(insertI, 0, part)
						insertI++
						hasAddedAnything = true
					})
				}
				delete partsToInsert[partId]
			}
		})
	}

	return parts
}
// /**
//  * Converts a part into a Segment
//  * @param story MOS Sory
//  * @param rundownId Rundown id of the story
//  * @param rank Rank of the story
//  */
// export function convertToSegment (part: Part, rank: number): DBSegment {
// 	// let slugParts = (story.Slug || '').toString().split(';')
// 	let slugParts = part.title.split(';')

// 	return {
// 		_id: segmentId(part.rundownId, part.title, rank),
// 		rundownId: part.rundownId,
// 		_rank: rank,
// 		externalId: 'N/A', // to be removed?
// 		name: slugParts[0],
// 		// number: (story.Number ? story.Number.toString() : '')
// 	}
// 	// logger.debug('story.Number', story.Number)
// }
// export function segmentId (rundownId: string, storySlug: string, rank: number): string {
// 	let slugParts = storySlug.split(';')
// 	let id = rundownId + '_' + slugParts[0] + '_' + rank
// 	return getHash(id)
// }
// export function updateAffectedParts (rundown: Rundown, affectedPartIds: Array<string>) {

// 	// Update the affected segments:
// 	let affectedSegmentIds = _.uniq(
// 		_.map(
// 			Parts.find({ // fetch assigned segmentIds
// 				_id: {$in: affectedPartIds}
// 			}).fetch(),
// 			part => part.segmentId
// 		)
// 	)

// 	let changed = false
// 	_.each(affectedSegmentIds, (segmentId) => {
// 		changed = changed || reCreateSegment(rundown._id, segmentId)
// 	})

// 	if (changed) {
// 		updateTimelineFromMosData(rundown._id, affectedPartIds)
// 	}
// }
/**
 * Removes a Segment from the database
 * @param story The story to be inserted
 * @param rundownId The Rundown id to insert into
 * @param rank The rank (position) to insert at
 */
export function removeSegment (segmentId: string, rundownId: string) {
	Segments.remove(segmentId)
	afterRemoveSegment(segmentId, rundownId)
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
	export function resyncRundown (rundownId: string) {
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

		Meteor.call(PlayoutAPI.methods.reloadData, rundownId, false)
	}
	export function unsyncRundown (rundownId: string) {
		check(rundownId, String)
		logger.info('unsyncRundown ' + rundownId)

		let rundown = Rundowns.findOne(rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)

		Rundowns.update(rundown._id, {$set: {
			unsynced: true,
			unsyncedTime: getCurrentTime()
		}})
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
