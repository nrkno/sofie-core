import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { IBlueprintPostProcessSegmentLine } from 'tv-automation-sofie-blueprints-integration'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLine, SegmentLines, DBSegmentLine, SegmentLineNoteType, SegmentLineNote } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Segments, DBSegment, Segment } from '../../lib/collections/Segments'
import { saveIntoDb, fetchBefore, getRank, fetchAfter, getCurrentTime, getHash, asyncCollectionUpdate, waitForPromiseAll } from '../../lib/lib'
import { logger } from '../logging'
import { loadBlueprints, postProcessSegmentLineItems, SegmentContext } from './blueprints'
import { ServerPlayoutAPI, updateTimelineFromMosData } from './playout'
import { CachePrefix } from '../../lib/collections/RunningOrderDataCache'
import { updateStory, reloadRunningOrder } from './integration/mos'
import { PlayoutAPI } from '../../lib/api/playout'
import { Methods, setMeteorMethods, wrapMethods } from '../methods'
import { RunningOrderAPI } from '../../lib/api/runningOrder'
import { updateExpectedMediaItems } from './expectedMediaItems'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
const PackageInfo = require('../../package.json')

/**
 * After a Segment has beed removed, handle its contents
 * @param segmentId Id of the Segment
 * @param runningOrderId Id of the Running order
 */
export function afterRemoveSegment (segmentId: string, runningOrderId: string) {
	// Remove the segment lines:
	saveIntoDb(SegmentLines, {
		runningOrderId: runningOrderId,
		segmentId: segmentId
	},[],{
		remove (segmentLine) {
			removeSegmentLine(segmentLine.runningOrderId, segmentLine)
		}
	})
}
export function removeSegmentLine (roId: string, segmentLineOrId: DBSegmentLine | string, replacedBySegmentLine?: DBSegmentLine) {
	let segmentLineToRemove: DBSegmentLine | undefined = (
		_.isString(segmentLineOrId) ?
			SegmentLines.findOne(segmentLineOrId) :
			segmentLineOrId
	)
	if (segmentLineToRemove) {
		SegmentLines.remove(segmentLineToRemove._id)
		afterRemoveSegmentLine(segmentLineToRemove, replacedBySegmentLine)
		updateTimelineFromMosData(roId)

		if (replacedBySegmentLine) {
			SegmentLines.update({
				runningOrderId: segmentLineToRemove.runningOrderId,
				afterSegmentLine: segmentLineToRemove._id
			}, {
				$set: {
					afterSegmentLine: replacedBySegmentLine._id,
				}
			}, {
				multi: true
			})
		} else {
			SegmentLines.remove({
				runningOrderId: segmentLineToRemove.runningOrderId,
				afterSegmentLine: segmentLineToRemove._id
			})
		}
	}
}
export function afterRemoveSegmentLine (removedSegmentLine: DBSegmentLine, replacedBySegmentLine?: DBSegmentLine) {
	SegmentLineItems.remove({
		segmentLineId: removedSegmentLine._id
	})
	updateExpectedMediaItems(removedSegmentLine.runningOrderId, removedSegmentLine._id)

	let ro = RunningOrders.findOne(removedSegmentLine.runningOrderId)
	if (ro) {
		// If the replaced segment is next-to-be-played out,
		// instead make the next-to-be-played-out item the one in it's place
		if (
			ro.active &&
			ro.nextSegmentLineId === removedSegmentLine._id
		) {
			if (!replacedBySegmentLine) {
				let segmentLineBefore = fetchBefore(SegmentLines, {
					runningOrderId: removedSegmentLine.runningOrderId
				}, removedSegmentLine._rank)

				let nextSegmentLineInLine = fetchAfter(SegmentLines, {
					runningOrderId: removedSegmentLine.runningOrderId,
					_id: {$ne: removedSegmentLine._id}
				}, segmentLineBefore ? segmentLineBefore._rank : null)

				if (nextSegmentLineInLine) {
					replacedBySegmentLine = nextSegmentLineInLine
				}
			}
			ServerPlayoutAPI.roSetNext(ro._id, replacedBySegmentLine ? replacedBySegmentLine._id : null)
		}
	}
}
export function updateSegmentLines (runningOrderId: string) {
	let segmentLines0 = SegmentLines.find({runningOrderId: runningOrderId}, {sort: {_rank: 1}}).fetch()

	let segmentLines: Array<SegmentLine> = []
	let segmentLinesToInsert: {[id: string]: Array<SegmentLine>} = {}

	_.each(segmentLines0, (sl) => {
		if (sl.afterSegmentLine) {
			if (!segmentLinesToInsert[sl.afterSegmentLine]) segmentLinesToInsert[sl.afterSegmentLine] = []
			segmentLinesToInsert[sl.afterSegmentLine].push(sl)
		} else {
			segmentLines.push(sl)
		}
	})

	let hasAddedAnything = true
	while (hasAddedAnything) {
		hasAddedAnything = false

		_.each(segmentLinesToInsert, (sls, slId) => {

			let segmentLineBefore: SegmentLine | null = null
			let segmentLineAfter: SegmentLine | null = null
			let insertI = -1
			_.each(segmentLines, (sl, i) => {
				if (sl._id === slId) {
					segmentLineBefore = sl
					insertI = i + 1
				} else if (segmentLineBefore && !segmentLineAfter) {
					segmentLineAfter = sl
				}
			})

			if (segmentLineBefore) {

				if (insertI !== -1) {
					_.each(sls, (sl, i) => {
						let newRank = getRank(segmentLineBefore, segmentLineAfter, i, sls.length)

						if (sl._rank !== newRank) {
							sl._rank = newRank
							SegmentLines.update(sl._id, {$set: {_rank: sl._rank}})
						}
						segmentLines.splice(insertI, 0, sl)
						insertI++
						hasAddedAnything = true
					})
				}
				delete segmentLinesToInsert[slId]
			}
		})
	}

	return segmentLines
}
/**
 * Converts a segmentLine into a Segment
 * @param story MOS Sory
 * @param runningOrderId Running order id of the story
 * @param rank Rank of the story
 */
export function convertToSegment (segmentLine: SegmentLine, rank: number): DBSegment {
	// let slugParts = (story.Slug || '').toString().split(';')
	let slugParts = segmentLine.slug.split(';')

	return {
		_id: segmentId(segmentLine.runningOrderId, segmentLine.slug, rank),
		runningOrderId: segmentLine.runningOrderId,
		_rank: rank,
		mosId: 'N/A', // to be removed?
		name: slugParts[0],
		// number: (story.Number ? story.Number.toString() : '')
	}
	// logger.debug('story.Number', story.Number)
}
export function segmentId (roId: string, storySlug: string, rank: number): string {
	let slugParts = storySlug.split(';')
	let id = roId + '_' + slugParts[0] + '_' + rank
	return getHash(id)
}
export function updateSegments (runningOrderId: string) {
	// using SegmentLines, determine which segments are to be created
	// let segmentLines = SegmentLines.find({runningOrderId: runningOrderId}, {sort: {_rank: 1}}).fetch()
	let segmentLines = updateSegmentLines(runningOrderId)

	let prevSlugParts: string[] = []
	let segment: DBSegment
	let segments: Array<DBSegment> = []
	let rankSegment = 0
	let segmentLineUpdates: {[id: string]: Partial<DBSegmentLine>} = {}
	_.each(segmentLines, (segmentLine: SegmentLine) => {
		let slugParts = segmentLine.slug.split(';')

		if (slugParts[0] !== prevSlugParts[0]) {
			segment = convertToSegment(segmentLine, rankSegment++)
			segments.push(segment)
		}
		if (segmentLine.segmentId !== segment._id) {
			logger.debug(segmentLine)
			logger.debug(segmentLine._id + ' old segmentId: ' + segmentLine.segmentId + ', new: ' + segment._id )
			segmentLineUpdates[segmentLine._id] = { segmentId: segment._id }
		}

		prevSlugParts = slugParts
	})

	// Update SegmentLines:
	_.each(segmentLineUpdates, (modifier, id: string) => {

		logger.info('added SegmentLine to segment ' + modifier['segmentId'])
		SegmentLines.update(id, {$set: modifier})
	})
	// Update Segments:
	saveIntoDb(Segments, {
		runningOrderId: runningOrderId
	}, segments, {
		afterInsert (segment) {
			logger.info('inserted segment ' + segment._id)
		},
		afterUpdate (segment) {
			logger.info('updated segment ' + segment._id)
		},
		afterRemove (segment) {
			logger.info('removed segment ' + segment._id)
			afterRemoveSegment(segment._id, segment.runningOrderId)
		}
	})
}
export function updateAffectedSegmentLines (ro: RunningOrder, affectedSegmentLineIds: Array<string>) {

	// Update the affected segments:
	let affectedSegmentIds = _.uniq(
		_.pluck(
			SegmentLines.find({ // fetch assigned segmentIds
				_id: {$in: affectedSegmentLineIds} // _.pluck(affectedSegmentLineIds, '_id')}
			}).fetch(),
		'segmentId')
	)

	let changed = false
	_.each(affectedSegmentIds, (segmentId) => {
		changed = changed || updateWithinSegment(ro, segmentId )
	})

	if (changed) {
		updateTimelineFromMosData(ro._id, affectedSegmentLineIds)
	}
}
function updateWithinSegment (ro: RunningOrder, segmentId: string): boolean {
	let segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, 'Segment "' + segmentId + '" not found!')

	let segmentLines = ro.getSegmentLines({
		segmentId: segment._id
	})

	let changed = false
	_.each(segmentLines, (segmentLine) => {
		changed = changed || updateSegmentLine(ro, segmentLine)
	})

	runPostProcessBlueprint(ro, segment)

	return changed
}
function updateSegmentLine (ro: RunningOrder, segmentLine: SegmentLine): boolean {
	// TODO: determine that the data source is MOS, and THEN call updateStory:
	let story = ro.fetchCache(CachePrefix.FULLSTORY + segmentLine._id)
	if (story) {
		return updateStory(ro, segmentLine, story)
	} else {
		logger.warn('Unable to update segmentLine "' + segmentLine._id + '", story cache not found')
		return false
	}
}
export function runPostProcessBlueprint (ro: RunningOrder, segment: Segment) {
	let showStyleBase = ro.getShowStyleBase()

	const segmentLines = segment.getSegmentLines()
	if (segmentLines.length === 0) {
		return undefined
	}

	const firstSegmentLine = segmentLines.sort((a, b) => b._rank = a._rank)[0]

	const context = new SegmentContext(ro, segment)
	context.handleNotesExternally = true

	let resultSli: SegmentLineItem[] | undefined = undefined
	let resultSlUpdates: IBlueprintPostProcessSegmentLine[] | undefined = undefined
	let notes: SegmentLineNote[] = []
	try {
		const blueprints = loadBlueprints(showStyleBase)
		let result = blueprints.getSegmentPost(context)
		resultSli = postProcessSegmentLineItems(context, result.segmentLineItems, 'post-process', firstSegmentLine._id)
		resultSlUpdates = result.segmentLineUpdates // TODO - validate/filter/tidy?
		notes = context.getNotes()
	} catch (e) {
		logger.error(e.stack ? e.stack : e.toString())
		// throw e
		notes = [{
			type: SegmentLineNoteType.ERROR,
			origin: {
				name: '',
				roId: context.runningOrder._id,
				segmentId: segment._id,
				segmentLineId: '',
			},
			message: 'Internal Server Error'
		}]
		resultSli = undefined
	}

	const slIds = segmentLines.map(sl => sl._id)

	let changedSli: {
		added: number,
		updated: number,
		removed: number
	} = {
		added: 0,
		updated: 0,
		removed: 0
	}
	if (notes) {
		Segments.update(segment._id, {$set: {
			notes: notes,
		}})
	}
	if (resultSli) {

		if (resultSli) {
			resultSli.forEach(sli => {
				sli.fromPostProcess = true
			})
		}

		changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			runningOrderId: ro._id,
			segmentLineId: { $in: slIds },
			fromPostProcess: true,
		}, resultSli || [], {
			afterInsert (segmentLineItem) {
				logger.debug('PostProcess: inserted segmentLineItem ' + segmentLineItem._id)
				logger.debug(segmentLineItem)
			},
			afterUpdate (segmentLineItem) {
				logger.debug('PostProcess: updated segmentLineItem ' + segmentLineItem._id)
			},
			afterRemove (segmentLineItem) {
				logger.debug('PostProcess: deleted segmentLineItem ' + segmentLineItem._id)
			}
		})
	}
	if (resultSlUpdates) {
		// At the moment this only affects the UI, so doesnt need to report 'anythingChanged'

		let ps = resultSlUpdates.map(sl => asyncCollectionUpdate(SegmentLines, {
			_id: sl._id,
			runningOrderId: ro._id
		}, {
			$set: {
				displayDurationGroup: sl.displayDurationGroup || ''
			}
		}))
		waitForPromiseAll(ps)
	}

	// if anything was changed
	const anythingChanged = (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
	if (anythingChanged) {
		_.each(slIds, (slId) => {
			updateExpectedMediaItems(ro._id, slId)
		})
	}
	return anythingChanged
}
export function reloadRunningOrderData (runningOrder: RunningOrder) {
	// TODO: determine that the runningOrder is Mos-driven, then call the function
	return reloadRunningOrder(runningOrder)
}
/**
 * Removes a Segment from the database
 * @param story The story to be inserted
 * @param runningOrderId The Running order id to insert into
 * @param rank The rank (position) to insert at
 */
export function removeSegment (segmentId: string, runningOrderId: string) {
	Segments.remove(segmentId)
	afterRemoveSegment(segmentId, runningOrderId)
}

export namespace ServerRunningOrderAPI {
	export function removeRunningOrder (runningOrderId: string) {
		check(runningOrderId, String)
		logger.info('removeRunningOrder ' + runningOrderId)

		let ro = RunningOrders.findOne(runningOrderId)
		if (!ro) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found!`)
		if (ro.active) throw new Meteor.Error(400,`Not allowed to remove an active RunningOrder "${runningOrderId}".`)

		ro.remove()
	}
	export function resyncRunningOrder (runningOrderId: string) {
		check(runningOrderId, String)
		logger.info('resyncRunningOrder ' + runningOrderId)

		let ro = RunningOrders.findOne(runningOrderId)
		if (!ro) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found!`)
		// if (ro.active) throw new Meteor.Error(400,`Not allowed to resync an active RunningOrder "${runningOrderId}".`)
		RunningOrders.update(ro._id, {
			$set: {
				unsynced: false
			}
		})

		Meteor.call(PlayoutAPI.methods.reloadData, runningOrderId, false)
	}
	export function unsyncRunningOrder (runningOrderId: string) {
		check(runningOrderId, String)
		logger.info('unsyncRunningOrder ' + runningOrderId)

		let ro = RunningOrders.findOne(runningOrderId)
		if (!ro) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found!`)

		RunningOrders.update(ro._id, {$set: {
			unsynced: true,
			unsyncedTime: getCurrentTime()
		}})
	}
}
export namespace ClientRunningOrderAPI {
	export function runningOrderNeedsUpdating (runningOrderId: string) {
		check(runningOrderId, String)
		logger.info('runningOrderNeedsUpdating ' + runningOrderId)

		let ro = RunningOrders.findOne(runningOrderId)
		if (!ro) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found!`)
		if (!ro.importVersions) return 'unknown'

		if (ro.importVersions.core !== PackageInfo.version) return 'coreVersion'

		const showStyleVariant = ShowStyleVariants.findOne(ro.showStyleVariantId)
		if (!showStyleVariant) return 'missing showStyleVariant'
		if (ro.importVersions.showStyleVariant !== (showStyleVariant._runningOrderVersionHash || 0)) return 'showStyleVariant'

		const showStyleBase = ShowStyleBases.findOne(ro.showStyleBaseId)
		if (!showStyleBase) return 'missing showStyleBase'
		if (ro.importVersions.showStyleBase !== (showStyleBase._runningOrderVersionHash || 0)) return 'showStyleBase'

		const blueprint = Blueprints.findOne(showStyleBase.blueprintId)
		if (!blueprint) return 'missing blueprint'
		if (ro.importVersions.blueprint !== (blueprint.blueprintVersion || 0)) return 'blueprint'

		const si = StudioInstallations.findOne(ro.studioInstallationId)
		if (!si) return 'missing studioInstallation'
		if (ro.importVersions.studioInstallation !== (si._runningOrderVersionHash || 0)) return 'studioInstallation'

		return undefined
	}
}

let methods: Methods = {}
methods[RunningOrderAPI.methods.removeRunningOrder] = (roId: string) => {
	return ServerRunningOrderAPI.removeRunningOrder(roId)
}
methods[RunningOrderAPI.methods.resyncRunningOrder] = (roId: string) => {
	return ServerRunningOrderAPI.resyncRunningOrder(roId)
}
methods[RunningOrderAPI.methods.unsyncRunningOrder] = (roId: string) => {
	return ServerRunningOrderAPI.unsyncRunningOrder(roId)
}
methods[RunningOrderAPI.methods.runningOrderNeedsUpdating] = (roId: string) => {
	return ClientRunningOrderAPI.runningOrderNeedsUpdating(roId)
}
// Apply methods:
setMeteorMethods(wrapMethods(methods))
