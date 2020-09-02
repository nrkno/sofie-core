import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Rundown, RundownHoldState, RundownId } from '../../../lib/collections/Rundowns'
import { Parts, Part, PartId } from '../../../lib/collections/Parts'
import { getCurrentTime, Time, clone, literal, waitForPromise, protectString } from '../../../lib/lib'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { DBSegment, Segments, Segment } from '../../../lib/collections/Segments'
import { RundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstance, DBPartInstance, PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { PieceInstance, PieceInstances } from '../../../lib/collections/PieceInstances'
import { TSR } from 'tv-automation-sofie-blueprints-integration'
import { CacheForRundownPlaylist, CacheForPlayout } from '../../DatabaseCaches'
import { AdLibPieces } from '../../../lib/collections/AdLibPieces'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { IngestDataCache } from '../../../lib/collections/IngestDataCache'
import { ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { ExpectedPlayoutItems } from '../../../lib/collections/ExpectedPlayoutItems'
import { AdLibActions } from '../../../lib/collections/AdLibActions'
import { RundownPlaylistContentWriteAccess } from '../../security/rundownPlaylist'
import { MethodContext } from '../../../lib/api/methods'
import { MongoQuery } from '../../../lib/typings/meteor'
import { RundownBaselineAdLibActions } from '../../../lib/collections/RundownBaselineAdLibActions'
import { isAnySyncFunctionsRunning } from '../../codeControl'
import { Pieces } from '../../../lib/collections/Pieces'
import { RundownBaselineObjs } from '../../../lib/collections/RundownBaselineObjs'
import { profiler } from '../profiler'

/**
 * Reset the rundown:
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export function resetRundown(cache: CacheForRundownPlaylist, rundown: Rundown) {
	logger.info('resetRundown ' + rundown._id)
	// Remove all dunamically inserted pieces (adlibs etc)

	// Note: After the RundownPlaylist (R19) update, the playhead is no longer affected in this operation,
	// since that isn't tied to the rundown anymore.

	cache.Parts.remove({
		rundownId: rundown._id,
		dynamicallyInsertedAfterPartId: { $exists: true },
	})

	cache.Parts.update(
		{
			rundownId: rundown._id,
		},
		{
			$unset: {
				duration: 1,
				startedPlayback: 1,
				taken: 1,
				timings: 1,
				stoppedPlayback: 1,
			},
		}
	)

	// Mask all instances as reset
	cache.PartInstances.update(
		{
			rundownId: rundown._id,
		},
		{
			$set: {
				reset: true,
			},
		}
	)
	cache.PieceInstances.update(
		{
			rundownId: rundown._id,
		},
		{
			$set: {
				reset: true,
			},
		}
	)
}

/**
 * Reset the rundownPlaylist (all of the rundowns within the playlist):
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export function resetRundownPlaylist(cache: CacheForPlayout) {
	logger.info('resetRundownPlaylist ' + cache.Playlist.doc._id)

	const removedPartInstanceIds = cache.PartInstances.remove({
		rehearsal: true,
	})
	cache.PieceInstances.remove({
		partInstanceId: { $in: removedPartInstanceIds },
	})

	cache.PartInstances.update(
		{},
		{
			$set: {
				reset: true,
			},
		}
	)
	cache.PieceInstances.update(
		{},
		{
			$set: {
				reset: true,
			},
		}
	)

	cache.Parts.remove({
		dynamicallyInsertedAfterPartId: { $exists: true },
	})

	cache.Parts.update(
		{},
		{
			$unset: {
				duration: 1,
				startedPlayback: 1,
				timings: 1,
				stoppedPlayback: 1,
				taken: 1,
			},
		}
	)

	resetRundownPlaylistPlayhead(cache)
}
function resetRundownPlaylistPlayhead(cache: CacheForPlayout) {
	logger.info('resetRundownPlayhead ' + cache.Playlist.doc._id)

	cache.Playlist.update({
		$set: {
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
		},
		$unset: {
			startedPlayback: 1,
			previousPersistentState: 1,
		},
	})

	cache.Rundowns.update(
		{},
		{
			$unset: {
				startedPlayback: 1,
			},
		}
	)

	if (cache.Playlist.doc.active) {
		// put the first on queue:
		const firstPart = selectNextPart(cache.Playlist.doc, null, getAllOrderedPartsFromCache(cache))
		setNextPart(cache, firstPart?.part ?? null)
	} else {
		setNextPart(cache, null)
	}
}

export interface SelectNextPartResult {
	part: Part
	index: number
	consumesNextSegmentId?: boolean
}

export function selectNextPart(
	rundownPlaylist: Pick<RundownPlaylist, 'nextSegmentId' | 'loop'>,
	previousPartInstance: PartInstance | null,
	parts: Part[]
): SelectNextPartResult | undefined {
	const span = profiler.startSpan('selectNextPart')
	const findFirstPlayablePart = (
		offset: number,
		condition?: (part: Part) => boolean
	): SelectNextPartResult | undefined => {
		// Filter to after and find the first playabale
		for (let index = offset; index < parts.length; index++) {
			const part = parts[index]
			if (part.isPlayable() && (!condition || condition(part))) {
				return { part, index }
			}
		}
		return undefined
	}

	let offset = 0
	if (previousPartInstance) {
		const currentIndex = parts.findIndex((p) => p._id === previousPartInstance.part._id)
		// TODO - choose something better for next?
		if (currentIndex !== -1) {
			offset = currentIndex + 1
		}
	}

	let nextPart = findFirstPlayablePart(offset)

	if (rundownPlaylist.nextSegmentId) {
		// No previous part, or segment has changed
		if (!previousPartInstance || (nextPart && previousPartInstance.segmentId !== nextPart.part.segmentId)) {
			// Find first in segment
			const nextPart2 = findFirstPlayablePart(0, (part) => part.segmentId === rundownPlaylist.nextSegmentId)
			if (nextPart2) {
				// If matched matched, otherwise leave on auto
				nextPart = {
					...nextPart2,
					consumesNextSegmentId: true,
				}
			}
		}
	}

	// TODO - rundownPlaylist.loop

	// Filter to after and find the first playabale
	const res = nextPart || findFirstPlayablePart(offset)
	if (span) span.end()
	return res
}
export function setNextPart(
	cache: CacheForPlayout,
	rawNextPart: Part | DBPartInstance | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
) {
	const span = profiler.startSpan('setNextPart')
	const { currentPartInstance, nextPartInstance } = getSelectedPartInstancesFromCache(cache)

	const movingToNewSegment =
		!currentPartInstance || !rawNextPart || rawNextPart.segmentId !== currentPartInstance.segmentId

	const newNextPartInstance = rawNextPart && 'part' in rawNextPart ? rawNextPart : null
	let newNextPart = rawNextPart && 'part' in rawNextPart ? null : rawNextPart

	const oldNextPartInstance = !nextPartInstance?.isTaken ? nextPartInstance : undefined

	if (newNextPart || newNextPartInstance) {
		if ((newNextPart && newNextPart.invalid) || (newNextPartInstance && newNextPartInstance.part.invalid)) {
			throw new Meteor.Error(400, 'Part is marked as invalid, cannot set as next.')
		}

		const rundownIds = getRundownIDsFromCache(cache)
		if (newNextPart && !rundownIds.includes(newNextPart.rundownId)) {
			throw new Meteor.Error(
				409,
				`Part "${newNextPart._id}" of rundown "${newNextPart.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
			)
		} else if (newNextPartInstance && !rundownIds.includes(newNextPartInstance.rundownId)) {
			throw new Meteor.Error(
				409,
				`PartInstance "${newNextPartInstance._id}" of rundown "${newNextPartInstance.rundownId}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
			)
		}

		if (newNextPart) {
			if (currentPartInstance && newNextPart._id === currentPartInstance.part._id) {
				throw new Meteor.Error(402, 'Not allowed to Next the currently playing Part')
			}

			// If this is a part being copied, then reset and reload it (so that we copy the new, not old data)
			// TODO-PartInstances - pending new data flow
			resetPart(cache, newNextPart)
			const partId = newNextPart._id
			newNextPart = cache.Parts.findOne(partId) as Part
			if (!newNextPart) {
				throw new Meteor.Error(409, `Part "${partId}" could not be reloaded after reset`)
			}
		} else if (newNextPartInstance) {
			if (currentPartInstance && newNextPartInstance._id === currentPartInstance._id) {
				throw new Meteor.Error(402, 'Not allowed to Next the currently playing Part')
			}
		}

		const nextPart = newNextPartInstance ? newNextPartInstance.part : newNextPart!

		// create new instance
		let newInstanceId: PartInstanceId
		if (newNextPartInstance) {
			newInstanceId = newNextPartInstance._id
			syncPlayheadInfinitesForNextPartInstance(cache)
		} else if (nextPartInstance && nextPartInstance.part._id === nextPart._id) {
			// Re-use existing
			newInstanceId = nextPartInstance._id
			syncPlayheadInfinitesForNextPartInstance(cache)
		} else {
			// Create new isntance
			newInstanceId = protectString<PartInstanceId>(`${nextPart._id}_${Random.id()}`)
			const newTakeCount = currentPartInstance ? currentPartInstance.takeCount + 1 : 0 // Increment
			cache.PartInstances.insert({
				_id: newInstanceId,
				takeCount: newTakeCount,
				rundownId: nextPart.rundownId,
				segmentId: nextPart.segmentId,
				part: nextPart,
				rehearsal: !!cache.Playlist.doc.rehearsal,
			})

			const possiblePieces = waitForPromise(fetchPiecesThatMayBeActiveForPart(cache, nextPart))
			const newPieceInstances = getPieceInstancesForPart(
				cache,
				currentPartInstance,
				nextPart,
				possiblePieces,
				newInstanceId,
				false
			)
			for (const pieceInstance of newPieceInstances) {
				cache.PieceInstances.insert(pieceInstance)
			}
		}

		// reset any previous instances of this part
		cache.PartInstances.update(
			{
				_id: { $ne: newInstanceId },
				rundownId: nextPart.rundownId,
				'part._id': nextPart._id,
				reset: { $ne: true },
			},
			{
				$set: {
					reset: true,
				},
			}
		)
		cache.PieceInstances.update(
			{
				partInstanceId: { $ne: newInstanceId },
				rundownId: nextPart.rundownId,
				'piece.partId': nextPart._id,
				reset: { $ne: true },
			},
			{
				$set: {
					reset: true,
				},
			}
		)

		cache.Playlist.update({
			$set: literal<Partial<RundownPlaylist>>({
				nextPartInstanceId: newInstanceId,
				nextPartManual: !!setManually,
				nextTimeOffset: nextTimeOffset || null,
			}),
		})
	} else {
		// Set to null

		cache.Playlist.update({
			$set: literal<Partial<RundownPlaylist>>({
				nextPartInstanceId: null,
				nextPartManual: !!setManually,
				nextTimeOffset: null,
			}),
		})
	}

	// Remove any instances which havent been taken
	if (oldNextPartInstance) {
		cache.PartInstances.remove({
			_id: oldNextPartInstance._id,
		})
		cache.PieceInstances.remove({
			partInstanceId: oldNextPartInstance._id,
		})

		if (oldNextPartInstance.part.dynamicallyInsertedAfterPartId) {
			// TODO-PartInstances - pending new data flow
			cache.Parts.remove({
				_id: oldNextPartInstance.part._id,
			})
		}
	}

	if (movingToNewSegment && cache.Playlist.doc.nextSegmentId) {
		// TODO - shouldnt this be done on take? this will have a bug where once the segment is set as next, another call to ensure the next is correct will change it
		cache.Playlist.update({
			$unset: {
				nextSegmentId: 1,
			},
		})
	}

	if (span) span.end()
}
export function setNextSegment(cache: CacheForPlayout, nextSegment: Segment | null) {
	const span = profiler.startSpan('setNextSegment')
	const acceptableRundowns = getRundownIDsFromCache(cache)
	if (nextSegment) {
		if (acceptableRundowns.indexOf(nextSegment.rundownId) === -1) {
			throw new Meteor.Error(
				409,
				`Segment "${nextSegment._id}" not part of RundownPlaylist "${cache.Playlist.doc._id}"`
			)
		}

		// Just run so that errors will be thrown if something wrong:
		const partsInSegment = cache.Parts.findFetch({ segmentId: nextSegment._id })
		if (!partsInSegment.find((p) => p.isPlayable())) {
			throw new Meteor.Error(400, 'Segment contains no valid parts')
		}

		cache.Playlist.update({
			$set: {
				nextSegmentId: nextSegment._id,
			},
		})
	} else {
		cache.Playlist.update({
			$unset: {
				nextSegmentId: 1,
			},
		})
	}
	if (span) span.end()
}

function resetPart(cache: CacheForPlayout, part: Part): void {
	cache.Parts.update(
		{
			_id: part._id,
		},
		{
			$unset: {
				duration: 1,
				startedPlayback: 1,
				taken: 1,
				stoppedPlayback: 1,
			},
		}
	)

	// remove parts that have been dynamically queued for after this part (queued adLibs)
	removeDynamicallyInsertedPartsAfter(cache, [part._id])
}

export function removeDynamicallyInsertedPartsAfter(cache: CacheForPlayout, afterPartIds: PartId[]): void {
	// TODO-PartInstances pending new data flow

	const removedPartIds = cache.Parts.remove({
		dynamicallyInsertedAfterPartId: { $in: afterPartIds },
	})
	if (removedPartIds.length > 0) {
		removeDynamicallyInsertedPartsAfter(cache, removedPartIds)
	}
}

export function onPartHasStoppedPlaying(cache: CacheForPlayout, partInstance: PartInstance, stoppedPlayingTime: Time) {
	const lastStartedPlayback = partInstance.part.getLastStartedPlayback()
	if (partInstance.part.startedPlayback && lastStartedPlayback && lastStartedPlayback > 0) {
		cache.PartInstances.update(partInstance._id, {
			$set: {
				'part.duration': stoppedPlayingTime - lastStartedPlayback,
			},
		})

		// TODO-PartInstance - pending new data flow
		cache.Parts.update(partInstance.part._id, {
			$set: {
				duration: stoppedPlayingTime - lastStartedPlayback,
			},
		})
	} else {
		// logger.warn(`Part "${part._id}" has never started playback on rundown "${rundownId}".`)
	}
}

export function substituteObjectIds(
	rawEnable: TSR.Timeline.TimelineEnable,
	idMap: { [oldId: string]: string | undefined }
) {
	const replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return `#${idMap[id] || id}`
		})
	}

	const enable = clone(rawEnable)

	for (const key of _.keys(enable)) {
		if (typeof enable[key] === 'string') {
			enable[key] = replaceIds(enable[key])
		}
	}

	return enable
}
export function prefixAllObjectIds<T extends TimelineObjGeneric>(
	objList: T[],
	prefix: string,
	ignoreOriginal?: boolean
): T[] {
	const getUpdatePrefixedId = (o: T) => {
		let id = o.id
		if (!ignoreOriginal) {
			if (!o.originalId) {
				o.originalId = o.id
			}
			id = o.originalId
		}
		return prefix + id
	}

	const idMap: { [oldId: string]: string | undefined } = {}
	_.each(objList, (o) => {
		idMap[o.id] = getUpdatePrefixedId(o)
	})

	return objList.map((rawObj) => {
		const obj = clone(rawObj)

		obj.id = getUpdatePrefixedId(obj)
		obj.enable = substituteObjectIds(obj.enable, idMap)

		if (typeof obj.inGroup === 'string') {
			obj.inGroup = idMap[obj.inGroup] || obj.inGroup
		}

		return obj
	})
}

/**
 * time in ms before an autotake when we don't accept takes/updates
 */
const AUTOTAKE_UPDATE_DEBOUNCE = 5000
const AUTOTAKE_TAKE_DEBOUNCE = 1000

export function isTooCloseToAutonext(currentPartInstance: PartInstance | undefined, isTake?: boolean) {
	if (!currentPartInstance || !currentPartInstance.part.autoNext) return false

	const debounce = isTake ? AUTOTAKE_TAKE_DEBOUNCE : AUTOTAKE_UPDATE_DEBOUNCE

	const start = currentPartInstance.part.getLastStartedPlayback()
	const offset = currentPartInstance.part.getLastPlayOffset()
	if (start !== undefined && offset !== undefined && currentPartInstance.part.expectedDuration) {
		// date.now - start = playback duration, duration + offset gives position in part
		const playbackDuration = getCurrentTime() - start + offset

		// If there is an auto next planned
		if (Math.abs(currentPartInstance.part.expectedDuration - playbackDuration) < debounce) {
			return true
		}
	}

	return false
}

export function getSegmentsAndPartsFromCache(
	cache: CacheForPlayout
): {
	segments: Segment[]
	parts: Part[]
} {
	const rundowns = getRundownsFromCache(cache)
	return getRundownsSegmentsAndPartsFromCache(cache, rundowns)
}
export function getAllOrderedPartsFromCache(cache: CacheForPlayout): Part[] {
	const { parts } = getSegmentsAndPartsFromCache(cache)
	return parts
}
/** Get all rundowns in a playlist */
export function getRundownsFromCache(cache: CacheForPlayout) {
	return cache.Rundowns.findFetch(
		{},
		{
			sort: {
				_rank: 1,
				_id: 1,
			},
		}
	)
}
export function getRundownIDsFromCache(cache: CacheForPlayout) {
	return getRundownsFromCache(cache).map((r) => r._id)
}
/** Get all pieces in a part */
export function getAllPiecesFromCache(cache: CacheForRundownPlaylist, part: Part) {
	return cache.Pieces.findFetch({
		rundownId: part.rundownId,
		partId: part._id,
	})
}
/** Get all adlib pieces in a part */
export function getAllAdLibPiecesFromCache(cache: CacheForRundownPlaylist, part: Part) {
	return cache.AdLibPieces.findFetch(
		{
			rundownId: part.rundownId,
			partId: part._id,
		},
		{
			sort: {
				_rank: 1,
				name: 1,
			},
		}
	)
}
// export function getStudioFromCache(cache: CacheForRundownPlaylist, playlist: RundownPlaylist) {
// 	if (!playlist.studioId) throw new Meteor.Error(500, 'RundownPlaylist is not in a studio!')
// 	let studio = cache.activationCache.getStudio()
// 	if (studio) {
// 		return studio
// 	} else {
// 		throw new Meteor.Error(404, 'Studio "' + playlist.studioId + '" not found!')
// 	}
// }
export function getSelectedPartInstancesFromCache(
	cache: CacheForPlayout
): {
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
	previousPartInstance: PartInstance | undefined
} {
	const playlist = cache.Playlist.doc

	return {
		currentPartInstance: playlist.currentPartInstanceId
			? cache.PartInstances.findOne(playlist.currentPartInstanceId)
			: undefined,
		nextPartInstance: playlist.nextPartInstanceId
			? cache.PartInstances.findOne(playlist.nextPartInstanceId)
			: undefined,
		previousPartInstance: playlist.previousPartInstanceId
			? cache.PartInstances.findOne(playlist.previousPartInstanceId)
			: undefined,
	}
}

export function removeRundownPlaylistFromCache(cache: CacheForRundownPlaylist, playlist: RundownPlaylist) {
	const allRundowns = cache.Rundowns.findFetch({ playlistId: playlist._id })
	allRundowns.forEach((rundown) => removeRundownFromCache(cache, rundown))

	cache.RundownPlaylists.remove(playlist._id)
}
export function removeRundownFromCache(cache: CacheForRundownPlaylist, rundown: Rundown) {
	cache.Rundowns.remove(rundown._id)
	if (rundown.playlistId) {
		// Check if any other rundowns in the playlist are left
		if (
			cache.Rundowns.findFetch({
				playlistId: rundown.playlistId,
			}).length === 0
		) {
			// No other rundowns left, remove the playlist as well then:
			cache.RundownPlaylists.remove(rundown.playlistId)
		}
	}
	cache.Segments.remove({ rundownId: rundown._id })
	cache.Parts.remove({ rundownId: rundown._id })
	cache.PartInstances.remove({ rundownId: rundown._id })
	cache.Pieces.remove({ startRundownId: rundown._id })
	cache.PieceInstances.remove({ rundownId: rundown._id })
	cache.RundownBaselineObjs.remove({ rundownId: rundown._id })

	cache.defer(() => {
		// These are not present in the cache because they do not directly affect output.
		AdLibActions.remove({ rundownId: rundown._id })
		AdLibPieces.remove({ rundownId: rundown._id })
		ExpectedMediaItems.remove({ rundownId: rundown._id })
		ExpectedPlayoutItems.remove({ rundownId: rundown._id })
		IngestDataCache.remove({ rundownId: rundown._id })
		RundownBaselineAdLibPieces.remove({ rundownId: rundown._id })

		// These might only partly be present in the cache, this should make sure they are properly removed:
		Segments.remove({ rundownId: rundown._id })
		Parts.remove({ rundownId: rundown._id })
		PartInstances.remove({ rundownId: rundown._id })
		Pieces.remove({ startRundownId: rundown._id })
		PieceInstances.remove({ rundownId: rundown._id })
		RundownBaselineAdLibActions.remove({ rundownId: rundown._id })
		RundownBaselineObjs.remove({ rundownId: rundown._id })
	})
}

/** Get all piece instances in a part instance */
export function getAllPieceInstancesFromCache(cache: CacheForPlayout, partInstance: PartInstance): PieceInstance[] {
	return cache.PieceInstances.findFetch({
		rundownId: partInstance.rundownId,
		partInstanceId: partInstance._id,
	})
}

export function touchRundownPlaylistsInCache(cache: CacheForPlayout) {
	if (!Meteor.isServer) throw new Meteor.Error('The "remove" method is available server-side only (sorry)')
	if (getCurrentTime() - cache.Playlist.doc.modified > 3600 * 1000) {
		const m = getCurrentTime()
		cache.Playlist.update({ $set: { modified: m } })
	}
}

export function getRundownsSegmentsAndPartsFromCache(
	cache: CacheForPlayout,
	rundowns: Rundown[]
): { segments: Segment[]; parts: Part[] } {
	const rundownIds = rundowns.map((i) => i._id)

	const segments = RundownPlaylist._sortSegments(
		cache.Segments.findFetch(
			{
				rundownId: {
					$in: rundownIds,
				},
			},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		rundowns
	)

	const parts = RundownPlaylist._sortPartsInner(
		cache.Parts.findFetch(
			{
				rundownId: {
					$in: rundownIds,
				},
			},
			{
				sort: {
					rundownId: 1,
					_rank: 1,
				},
			}
		),
		segments
	)

	return {
		segments: segments,
		parts: parts,
	}
}

export function checkAccessAndGetPlaylist(context: MethodContext, playlistId: RundownPlaylistId): RundownPlaylist {
	const access = RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
	return playlist
}
export function triggerGarbageCollection() {
	Meteor.setTimeout(() => {
		// Trigger a manual garbage collection:
		if (global.gc) {
			// This is only avaialble of the flag --expose_gc
			// This can be done in prod by: node --expose_gc main.js
			// or when running Meteor in development, set set SERVER_NODE_OPTIONS=--expose_gc

			if (!isAnySyncFunctionsRunning()) {
				// by passing true, we're triggering the "full" collection
				// @ts-ignore (typings not avaiable)
				global.gc(true)
			}
		}
	}, 500)
}
