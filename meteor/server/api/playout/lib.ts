import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState, DBRundown } from '../../../lib/collections/Rundowns'
import { Pieces } from '../../../lib/collections/Pieces'
import { Parts, DBPart, Part } from '../../../lib/collections/Parts'
import {
	asyncCollectionUpdate,
	getCurrentTime,
	waitForPromiseAll,
	asyncCollectionRemove,
	Time,
	pushOntoPath,
	clone,
	toc,
	fetchAfter,
	asyncCollectionFindFetch
} from '../../../lib/lib'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import { loadCachedIngestSegment } from '../ingest/ingestCache'
import { updateSegmentsFromIngestData } from '../ingest/rundownInput'
import { updateSourceLayerInfinitesAfterPart } from './infinites'
import { Studios } from '../../../lib/collections/Studios'
import { DBSegment, Segments, Segment } from '../../../lib/collections/Segments'
import { TimelineEnable } from 'superfly-timeline'
import { afterRemoveParts } from '../rundown'
import { Settings } from '../../../lib/Settings'

/**
 * Reset the rundown:
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export function resetRundown (rundown: Rundown) {
	logger.info('resetRundown ' + rundown._id)

	if (rundown.active && rundown.currentPartId && !Settings.allowUnsafeResets) {
		throw new Meteor.Error(500, `Not able to reset active rundown "${rundown._id}"`)
	}

	// Remove all dunamically inserted pieces (adlibs etc)
	Pieces.remove({
		rundownId: rundown._id,
		dynamicallyInserted: true
	})

	Parts.remove({
		rundownId: rundown._id,
		dynamicallyInserted: true
	})

	Parts.update({
		rundownId: rundown._id
	}, {
		$unset: {
			duration: 1,
			previousPartEndState: 1,
			startedPlayback: 1,
			taken: 1,
			timings: 1,
			runtimeArguments: 1,
			stoppedPlayback: 1
		}
	}, { multi: true })

	const dirtyParts = Parts.find({
		rundownId: rundown._id,
		dirty: true
	}).fetch()
	dirtyParts.forEach(part => {
		refreshPart(rundown, part)
		Parts.update(part._id, {$unset: {
			dirty: 1
		}})
	})

	// Reset all pieces that were modified for holds
	Pieces.update({
		rundownId: rundown._id,
		extendOnHold: true,
		infiniteId: { $exists: true },
	}, {
		$unset: {
			infiniteId: 0,
			infiniteMode: 0,
		}
	}, { multi: true })

	// Reset any pieces that were modified by inserted adlibs
	Pieces.update({
		rundownId: rundown._id,
		originalInfiniteMode: { $exists: true }
	}, {
		$rename: {
			originalInfiniteMode: 'infiniteMode'
		}
	}, { multi: true })

	Pieces.update({
		rundownId: rundown._id
	}, {
		$unset: {
			playoutDuration: 1,
			startedPlayback: 1,
			userDuration: 1,
			definitelyEnded: 1,
			stoppedPlayback: 1,
			disabled: 1,
			hidden: 1
		}
	}, { multi: true })

	// ensure that any removed infinites are restored
	updateSourceLayerInfinitesAfterPart(rundown)

	resetRundownPlayhead(rundown)
}
function resetRundownPlayhead (rundown: Rundown) {
	logger.info('resetRundownPlayhead ' + rundown._id)
	let parts = rundown.getParts()

	Rundowns.update(rundown._id, {
		$set: {
			previousPartId: null,
			currentPartId: null,
			holdState: RundownHoldState.NONE,
		}, $unset: {
			startedPlayback: 1,
			previousPersistentState: 1
		}
	})
	// Also update locally:
	rundown.previousPartId = null
	rundown.currentPartId = null
	rundown.holdState = RundownHoldState.NONE
	delete rundown.startedPlayback
	delete rundown.previousPersistentState


	if (rundown.active) {
		// put the first on queue:
		const part = rundown.getParts().find(p => !p.invalid)
		if (part) {
			setNextPart(rundown, part, null)
		}
	} else {
		setNextPart(rundown, null, null)
	}
}
export function getPreviousPartForSegment (rundownId: string, dbSegment: DBSegment): Part | undefined {
	const prevSegment = Segments.findOne({
		rundownId: rundownId,
		_rank: { $lt: dbSegment._rank }
	}, { sort: { _rank: -1 } })
	if (prevSegment) {
		return Parts.findOne({
			rundownId: rundownId,
			segmentId: prevSegment._id,
		}, { sort: { _rank: -1 } })
	}
	return undefined
}
function getPreviousPart (dbPart: DBPart) {
	return Parts.findOne({
		rundownId: dbPart.rundownId,
		_rank: { $lt: dbPart._rank }
	}, { sort: { _rank: -1 } })
}
export function refreshPart (dbRundown: DBRundown, dbPart: DBPart) {
	const ingestSegment = loadCachedIngestSegment(dbRundown._id, dbRundown.externalId, dbPart.segmentId, dbPart.segmentId)

	const studio = Studios.findOne(dbRundown.studioId)
	if (!studio) throw new Meteor.Error(404, `Studio ${dbRundown.studioId} was not found`)
	const rundown = new Rundown(dbRundown)

	updateSegmentsFromIngestData(studio, rundown, [ingestSegment])

	const segment = Segments.findOne(dbPart.segmentId)
	if (!segment) throw new Meteor.Error(404, `Segment ${dbPart.segmentId} was not found`)

	const prevPart = getPreviousPartForSegment(dbRundown._id, segment)
	updateSourceLayerInfinitesAfterPart(rundown, prevPart)
}
export function setNextPart (
	rundown: Rundown,
	nextPart: DBPart | null,
	currentPart: DBPart | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined,
	skipRunResetPart?: boolean
	) {
	let ps: Array<Promise<any>> = []
	const movingToNewSegment = (
		!currentPart ||
		!nextPart ||
		nextPart.segmentId !== currentPart.segmentId
	)
	if (nextPart) {

		if (nextPart.rundownId !== rundown._id) throw new Meteor.Error(409, `Part "${nextPart._id}" not part of rundown "${rundown._id}"`)
		if (nextPart._id === rundown.currentPartId) {
			throw new Meteor.Error(402, 'Not allowed to Next the currently playing Part')
		}
		if (nextPart.invalid) {
			throw new Meteor.Error(400, 'Part is marked as invalid, cannot set as next.')
		}

		if (!skipRunResetPart) {
			ps.push(resetPart(nextPart, rundown))
		}

		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$set: {
				nextPartId: nextPart._id,
				nextPartManual: !!setManually,
				nextTimeOffset: nextTimeOffset || null
			}
		}))
		rundown.nextPartId = nextPart._id
		rundown.nextPartManual = !!setManually
		rundown.nextTimeOffset = nextTimeOffset || null

		ps.push(asyncCollectionUpdate(Parts, nextPart._id, {
			$push: {
				'timings.next': getCurrentTime()
			}
		}))
	} else {
		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$set: {
				nextPartId: null,
				nextPartManual: !!setManually
			}
		}))
		rundown.nextPartId = null
		rundown.nextPartManual = !!setManually
	}
	if (movingToNewSegment && rundown.nextSegmentId) {
		ps.push(asyncCollectionUpdate(Rundowns, rundown._id, {
			$unset: {
				nextSegmentId: 1
			}
		}))
		delete rundown.nextSegmentId
	}

	waitForPromiseAll(ps)
}
export function setNextSegment (
	rundown: Rundown,
	nextSegment: Segment | null
) {
	if (nextSegment) {

		if (nextSegment.rundownId !== rundown._id) throw new Meteor.Error(409, `Segment "${nextSegment._id}" not part of rundown "${rundown._id}"`)

		// Just run so that errors will be thrown if something wrong:
		getNextPartSegment(nextSegment.getParts(), true)

		Rundowns.update(rundown._id, {
			$set: {
				nextSegmentId: nextSegment._id,
			}
		})
		rundown.nextSegmentId = nextSegment._id

	} else {
		Rundowns.update(rundown._id, {
			$unset: {
				nextSegmentId: 1
			}
		})
		delete rundown.nextSegmentId
	}
}
export function getNextPart (
	rundown: Rundown,
	partsInRundown: Part[],
	takePart: Part
): Part | undefined {

	const partAfter = fetchAfter(partsInRundown, {
		invalid: { $ne: true }
	}, takePart._rank)

	if (
		rundown.nextSegmentId && (
			!partAfter ||
			partAfter.segmentId !== takePart.segmentId
		)
	) {

		const segment = Segments.findOne({ _id: rundown.nextSegmentId })

		const partsInSegment = _.filter(partsInRundown, p => p.segmentId === rundown.nextSegmentId)

		const nextPart = getNextPartSegment(
			partsInSegment,
			false
		)
		if (nextPart && segment && !segment.isHidden) {
			return nextPart
		} // else: return the normally next
	}

	if (!partAfter) return

	const segment = Segments.findOne({ _id: partAfter.segmentId })
	if (segment && !segment.isHidden) {
		return partAfter
	}

	return getNextPart(rundown, partsInRundown, partAfter)
}
export function getNextPartSegment (
	partsInSegment: Part[],
	throwOnNoFound?: boolean
): Part | undefined {
	const firstvalidPartInSegment = _.find(partsInSegment, p => !p.invalid)

	if (throwOnNoFound) {
		if (!partsInSegment.length) throw new Meteor.Error(400, 'Segment is empty')
		if (!firstvalidPartInSegment) throw new Meteor.Error(400, 'Segment contains no valid parts')
		if (firstvalidPartInSegment.invalid) throw new Meteor.Error(400, 'Internal error: invalid part selected')
	}
	return firstvalidPartInSegment

}

function resetPart (part: DBPart, rundown: DBRundown): Promise<void> {
	let ps: Array<Promise<any>> = []


	ps.push(asyncCollectionUpdate(Parts, {
		// rundownId: part.rundownId,
		_id: part._id
	}, {
		$unset: {
			duration: 1,
			previousPartEndState: 1,
			startedPlayback: 1,
			taken: 1,
			runtimeArguments: 1,
			dirty: 1,
			stoppedPlayback: 1
		}
	}))
	ps.push(asyncCollectionUpdate(Pieces, {
		rundownId: part.rundownId,
		partId: part._id
	}, {
		$unset: {
			startedPlayback: 1,
			userDuration: 1,
			definitelyEnded: 1,
			disabled: 1,
			hidden: 1
		}
	}, {
		multi: true
	}))

	// Remove parts that have been dynamically queued for after this part (queued adLibs)
	let afterPartsToRemove = Parts.find({
		rundownId: part.rundownId,
		afterPart: part._id,
		dynamicallyInserted: true
	}).fetch()
	if (rundown.active && rundown.currentPartId) {
		// Don't remove a currently playing part:
		afterPartsToRemove = afterPartsToRemove.filter(part => part._id !== rundown.currentPartId)
	}
	if (afterPartsToRemove.length) {
		ps.push(asyncCollectionRemove(Parts, {
			_id: { $in: afterPartsToRemove.map(p => p._id) }
		}))
		ps.push(asyncCollectionRemove(Pieces, {
			rundownId: part.rundownId,
			partId: { $in: afterPartsToRemove.map(p => p._id) },
		}))
	}

	// Remove all pieces that have been dynamically created (such as adLib pieces)
	ps.push(asyncCollectionRemove(Pieces, {
		rundownId: part.rundownId,
		partId: part._id,
		dynamicallyInserted: true
	}))

	// Reset any pieces that were modified by inserted adlibs
	ps.push(asyncCollectionUpdate(Pieces, {
		rundownId: part.rundownId,
		partId: part._id,
		originalInfiniteMode: { $exists: true }
	}, {
		$rename: {
			originalInfiniteMode: 'infiniteMode'
		}
	}, {
		multi: true
	}))

	let isDirty = part.dirty || false

	if (isDirty) {
		return new Promise((resolve, reject) => {
			const rundown = Rundowns.findOne(part.rundownId)
			if (!rundown) throw new Meteor.Error(404, `Rundown "${part.rundownId}" not found!`)

			Promise.all(ps)
			.then(() => {
				refreshPart(rundown, part)
				resolve()
			}).catch((e) => reject())
		})
	} else {
		const rundown = Rundowns.findOne(part.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${part.rundownId}" not found!`)
		const prevPart = getPreviousPart(part)


		return Promise.all(ps)
		.then(() => {
			updateSourceLayerInfinitesAfterPart(rundown, prevPart)
			// do nothing
		})
	}
}
export function onPartHasStoppedPlaying (part: Part, stoppedPlayingTime: Time) {
	const lastStartedPlayback = part.getLastStartedPlayback()
	if (part.startedPlayback && lastStartedPlayback && lastStartedPlayback > 0) {
		Parts.update(part._id, {
			$set: {
				duration: stoppedPlayingTime - lastStartedPlayback
			}
		})
		part.duration = stoppedPlayingTime - lastStartedPlayback
		pushOntoPath(part, 'timings.stoppedPlayback', stoppedPlayingTime)
	} else {
		// logger.warn(`Part "${part._id}" has never started playback on rundown "${rundownId}".`)
	}
}

export function substituteObjectIds (rawEnable: TimelineEnable, idMap: { [oldId: string]: string | undefined }) {
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
export function prefixAllObjectIds<T extends TimelineObjGeneric> (objList: T[], prefix: string, ignoreOriginal?: boolean): T[] {
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
	_.each(objList, o => {
		idMap[o.id] = getUpdatePrefixedId(o)
	})

	return objList.map(rawObj => {
		const obj = clone(rawObj)

		obj.id = getUpdatePrefixedId(obj)
		obj.enable = substituteObjectIds(obj.enable, idMap)

		if (typeof obj.inGroup === 'string') {
			obj.inGroup = idMap[obj.inGroup] || obj.inGroup
		}

		return obj
	})
}
