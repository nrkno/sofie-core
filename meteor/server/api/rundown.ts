import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { Segments, DBSegment, Segment } from '../../lib/collections/Segments'
import {
	saveIntoDb,
	fetchBefore,
	getRank,
	fetchAfter,
	getCurrentTime,
	getHash,
	asyncCollectionUpdate,
	waitForPromiseAll
} from '../../lib/lib'
import { logger } from '../logging'
import {
	postProcessSegmentLineItems,
	SegmentContext
} from './blueprints'
import { ServerPlayoutAPI, updateTimelineFromMosData } from './playout'
import { CachePrefix } from '../../lib/collections/RundownDataCache'
import { updateStory, reloadRundown } from './integration/mos'
import { PlayoutAPI } from '../../lib/api/playout'
import { Methods, setMeteorMethods } from '../methods'
import { RundownAPI } from '../../lib/api/rundown'
import { updateExpectedMediaItems } from './expectedMediaItems'
import { ShowStyleVariants, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { Blueprints } from '../../lib/collections/Blueprints'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'
import { SegmentLineNote, NoteType } from '../../lib/api/notes'
import { IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { StudioConfigContext } from './blueprints/context'
import { loadStudioBlueprints, loadShowStyleBlueprints } from './blueprints/cache'
const PackageInfo = require('../../package.json')

export function selectShowStyleVariant (studio: StudioInstallation, ingestRundown: IngestRundown): { variant: ShowStyleVariant, base: ShowStyleBase } | null {
	const showStyleBases = ShowStyleBases.find({ _id: { $in: studio.supportedShowStyleBase }}).fetch()
	let showStyleBase = _.first(showStyleBases)
	if (!showStyleBase) {
		return null
	}

	const context = new StudioConfigContext(studio)

	const studioBlueprint = loadStudioBlueprints(studio)
	if (studioBlueprint) {
		const showStyleId = studioBlueprint.getShowStyleId(context, showStyleBases, ingestRundown)
		showStyleBase = _.find(showStyleBases, s => s._id === showStyleId)
		if (showStyleId === null || !showStyleBase) {
			return null
		}
	}

	const showStyleVariants = ShowStyleVariants.find({ showStyleBaseId: showStyleBase._id }).fetch()
	let showStyleVariant = _.first(showStyleVariants)
	if (!showStyleVariant) {
		throw new Meteor.Error(404, `ShowStyleBase "${showStyleBase._id}" has no variants`)
	}

	const showStyleBlueprint = loadShowStyleBlueprints(showStyleBase)
	if (!showStyleBlueprint) {
		throw new Meteor.Error(404, `ShowStyleBase "${showStyleBase._id}" does not have a valid blueprint`)
	}

	const variantId = showStyleBlueprint.getShowStyleVariantId(context, showStyleVariants, ingestRundown)
	showStyleVariant = _.find(showStyleVariants, s => s._id === variantId)
	if (variantId === null || !showStyleVariant) {
		return null
	}

	return {
		variant: showStyleVariant,
		base: showStyleBase
	}
}

/**
 * After a Segment has beed removed, handle its contents
 * @param segmentId Id of the Segment
 * @param rundownId Id of the Rundown
 */
export function afterRemoveSegment (segmentId: string, rundownId: string) {
	// Remove the segment lines:
	saveIntoDb(SegmentLines, {
		rundownId: rundownId,
		segmentId: segmentId
	},[],{
		remove (segmentLine) {
			removeSegmentLine(segmentLine.rundownId, segmentLine)
		}
	})
}
export function removeSegmentLine (rundownId: string, segmentLineOrId: DBSegmentLine | string, replacedBySegmentLine?: DBSegmentLine) {
	let segmentLineToRemove: DBSegmentLine | undefined = (
		_.isString(segmentLineOrId) ?
			SegmentLines.findOne(segmentLineOrId) :
			segmentLineOrId
	)
	if (segmentLineToRemove) {
		SegmentLines.remove(segmentLineToRemove._id)
		afterRemoveSegmentLine(segmentLineToRemove, replacedBySegmentLine)
		updateTimelineFromMosData(rundownId)

		if (replacedBySegmentLine) {
			SegmentLines.update({
				rundownId: segmentLineToRemove.rundownId,
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
				rundownId: segmentLineToRemove.rundownId,
				afterSegmentLine: segmentLineToRemove._id
			})
		}
	}
}
export function afterRemoveSegmentLine (removedSegmentLine: DBSegmentLine, replacedBySegmentLine?: DBSegmentLine) {
	// TODO - what about adlibs?
	SegmentLineItems.remove({
		segmentLineId: removedSegmentLine._id
	})
	updateExpectedMediaItems(removedSegmentLine.rundownId, removedSegmentLine._id)

	let rundown = Rundowns.findOne(removedSegmentLine.rundownId)
	if (rundown) {
		// If the replaced segment is next-to-be-played out,
		// instead make the next-to-be-played-out item the one in it's place
		if (
			rundown.active &&
			rundown.nextSegmentLineId === removedSegmentLine._id
		) {
			if (!replacedBySegmentLine) {
				let segmentLineBefore = fetchBefore(SegmentLines, {
					rundownId: removedSegmentLine.rundownId
				}, removedSegmentLine._rank)

				let nextSegmentLineInLine = fetchAfter(SegmentLines, {
					rundownId: removedSegmentLine.rundownId,
					_id: {$ne: removedSegmentLine._id}
				}, segmentLineBefore ? segmentLineBefore._rank : null)

				if (nextSegmentLineInLine) {
					replacedBySegmentLine = nextSegmentLineInLine
				}
			}
			ServerPlayoutAPI.rundownSetNext(rundown._id, replacedBySegmentLine ? replacedBySegmentLine._id : null)
		}
	}
}
export function updateSegmentLines (rundownId: string) {
	let segmentLines0 = SegmentLines.find({rundownId: rundownId}, {sort: {_rank: 1}}).fetch()

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
 * @param rundownId Rundown id of the story
 * @param rank Rank of the story
 */
export function convertToSegment (segmentLine: SegmentLine, rank: number): DBSegment {
	// let slugParts = (story.Slug || '').toString().split(';')
	let slugParts = segmentLine.title.split(';')

	return {
		_id: segmentId(segmentLine.rundownId, segmentLine.title, rank),
		rundownId: segmentLine.rundownId,
		_rank: rank,
		externalId: 'N/A', // to be removed?
		name: slugParts[0],
		// number: (story.Number ? story.Number.toString() : '')
	}
	// logger.debug('story.Number', story.Number)
}
export function segmentId (rundownId: string, storySlug: string, rank: number): string {
	let slugParts = storySlug.split(';')
	let id = rundownId + '_' + slugParts[0] + '_' + rank
	return getHash(id)
}
export function updateSegments (rundownId: string) {
	// using SegmentLines, determine which segments are to be created
	// let segmentLines = SegmentLines.find({rundownId: rundownId}, {sort: {_rank: 1}}).fetch()
	let segmentLines = updateSegmentLines(rundownId)

	let prevSlugParts: string[] = []
	let segment: DBSegment
	let segments: Array<DBSegment> = []
	let rankSegment = 0
	let segmentLineUpdates: {[id: string]: Partial<DBSegmentLine>} = {}
	_.each(segmentLines, (segmentLine: SegmentLine) => {
		let slugParts = segmentLine.title.split(';')

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
		rundownId: rundownId
	}, segments, {
		afterInsert (segment) {
			logger.info('inserted segment ' + segment._id)
		},
		afterUpdate (segment) {
			logger.info('updated segment ' + segment._id)
		},
		afterRemove (segment) {
			logger.info('removed segment ' + segment._id)
			afterRemoveSegment(segment._id, segment.rundownId)
		}
	})
}
export function updateAffectedSegmentLines (rundown: Rundown, affectedSegmentLineIds: Array<string>) {

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
		changed = changed || updateWithinSegment(rundown, segmentId )
	})

	if (changed) {
		updateTimelineFromMosData(rundown._id, affectedSegmentLineIds)
	}
}
function updateWithinSegment (rundown: Rundown, segmentId: string): boolean {
	let segment = Segments.findOne(segmentId)
	if (!segment) throw new Meteor.Error(404, 'Segment "' + segmentId + '" not found!')

	let segmentLines = rundown.getSegmentLines({
		segmentId: segment._id
	})

	let changed = false
	_.each(segmentLines, (segmentLine) => {
		changed = changed || updateSegmentLine(rundown, segmentLine)
	})

	runPostProcessBlueprint(rundown, segment)

	return changed
}
function updateSegmentLine (rundown: Rundown, segmentLine: SegmentLine): boolean {
	// TODO: determine that the data source is MOS, and THEN call updateStory:
	let story = rundown.fetchCache(CachePrefix.INGEST_PART + segmentLine._id)
	if (story) {
		return updateStory(rundown, segmentLine, story)
	} else {
		logger.warn('Unable to update segmentLine "' + segmentLine._id + '", story cache not found')
		return false
	}
}
export function runPostProcessBlueprint (rundown: Rundown, segment: Segment) {
	// let showStyleBase = rundown.getShowStyleBase()

	// const segmentLines = segment.getSegmentLines()
	// if (segmentLines.length === 0) {
	// 	return undefined
	// }

	// const firstSegmentLine = segmentLines.sort((a, b) => b._rank = a._rank)[0]

	// const context = new SegmentContext(rundown, segment)
	// context.handleNotesExternally = true

	// let resultSli: SegmentLineItem[] | undefined = undefined
	// let resultSlUpdates: IBlueprintPostProcessSegmentLine[] | undefined = undefined
	// let notes: SegmentLineNote[] = []
	// try {
	// 	const blueprints = loadShowStyleBlueprints(showStyleBase)
	// 	let result = blueprints.getSegmentPost(context)
	// 	resultSli = postProcessSegmentLineItems(context, result.segmentLineItems, 'post-process', firstSegmentLine._id)
	// 	resultSlUpdates = result.segmentLineUpdates // TODO - validate/filter/tidy?
	// 	notes = context.getNotes()
	// } catch (e) {
	// 	logger.error(e.stack ? e.stack : e.toString())
	// 	// throw e
	// 	notes = [{
	// 		type: SegmentLineNoteType.ERROR,
	// 		origin: {
	// 			name: '',
	// 			rundownId: context.rundown._id,
	// 			segmentId: segment._id,
	// 			segmentLineId: '',
	// 		},
	// 		message: 'Internal Server Error'
	// 	}]
	// 	resultSli = undefined
	// }

	// const slIds = segmentLines.map(sl => sl._id)

	// let changedSli: {
	// 	added: number,
	// 	updated: number,
	// 	removed: number
	// } = {
	// 	added: 0,
	// 	updated: 0,
	// 	removed: 0
	// }
	// if (notes) {
	// 	Segments.update(segment._id, {$set: {
	// 		notes: notes,
	// 	}})
	// }
	// if (resultSli) {

	// 	if (resultSli) {
	// 		resultSli.forEach(sli => {
	// 			sli.fromPostProcess = true
	// 		})
	// 	}

	// 	changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
	// 		rundownId: rundown._id,
	// 		segmentLineId: { $in: slIds },
	// 		fromPostProcess: true,
	// 	}, resultSli || [], {
	// 		afterInsert (segmentLineItem) {
	// 			logger.debug('PostProcess: inserted segmentLineItem ' + segmentLineItem._id)
	// 			logger.debug(segmentLineItem)
	// 		},
	// 		afterUpdate (segmentLineItem) {
	// 			logger.debug('PostProcess: updated segmentLineItem ' + segmentLineItem._id)
	// 		},
	// 		afterRemove (segmentLineItem) {
	// 			logger.debug('PostProcess: deleted segmentLineItem ' + segmentLineItem._id)
	// 		}
	// 	})
	// }
	// if (resultSlUpdates) {
	// 	// At the moment this only affects the UI, so doesnt need to report 'anythingChanged'

	// 	let ps = resultSlUpdates.map(sl => asyncCollectionUpdate(SegmentLines, {
	// 		_id: sl._id,
	// 		rundownId: rundown._id
	// 	}, {
	// 		$set: {
	// 			displayDurationGroup: sl.displayDurationGroup || ''
	// 		}
	// 	}))
	// 	waitForPromiseAll(ps)
	// }

	// // if anything was changed
	// const anythingChanged = (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
	// if (anythingChanged) {
	// 	_.each(slIds, (slId) => {
	// 		updateExpectedMediaItems(rundown._id, slId)
	// 	})
	// }
	// return anythingChanged
	return false
}
export function reloadRundownData (rundown: Rundown) {
	// TODO: determine that the rundown is Mos-driven, then call the function
	return reloadRundown(rundown)
}
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

		const si = StudioInstallations.findOne(rundown.studioInstallationId)
		if (!si) return 'missing studioInstallation'
		if (rundown.importVersions.studioInstallation !== (si._rundownVersionHash || 0)) return 'studioInstallation'

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
