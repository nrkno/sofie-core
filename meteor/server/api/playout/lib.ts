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
	toc
} from '../../../lib/lib'
import { TimelineObjGeneric } from '../../../lib/collections/Timeline'
import { loadCachedIngestSegment } from '../ingest/ingestCache'
import { updateSegmentsFromIngestData } from '../ingest/rundownInput'
import { updateSourceLayerInfinitesAfterPart } from './infinites'
import { Studios } from '../../../lib/collections/Studios'
import { DBSegment, Segments } from '../../../lib/collections/Segments'

/**
 * Reset the rundown:
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export function resetRundown (rundown: Rundown) {
	logger.info('resetRundown ' + rundown._id)
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
		setNextPart(rundown, _.first(parts) || null)
	} else {
		setNextPart(rundown, null)
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
	setManually?: boolean,
	nextTimeOffset?: number | undefined
) {
	let ps: Array<Promise<any>> = []
	if (nextPart) {

		if (nextPart.rundownId !== rundown._id) throw new Meteor.Error(409, `Part "${nextPart._id}" not part of rundown "${rundown._id}"`)
		if (nextPart._id === rundown.currentPartId) {
			throw new Meteor.Error(402, 'Not allowed to Next the currently playing Part')
		}
		if (nextPart.invalid) {
			throw new Meteor.Error(400, 'Part is marked as invalid, cannot set as next.')
		}
		if (nextPart.floated) {
			throw new Meteor.Error(400, 'Part is marked as floated, cannot set as next.')
		}

		ps.push(resetPart(nextPart))

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

	waitForPromiseAll(ps)
}

function resetPart (part: DBPart): Promise<void> {
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
		// rundownId: part.rundownId,
		partId: part._id
	}, {
		$unset: {
			startedPlayback: 1,
			userDuration: 1,
			disabled: 1,
			hidden: 1
		}
	}, {
		multi: true
	}))
	// remove parts that have been dynamically queued for after this part (queued adLibs)
	ps.push(asyncCollectionRemove(Parts, {
		rundownId: part.rundownId,
		afterPart: part._id,
		dynamicallyInserted: true
	}))

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

	const replaceIds = (str: string) => {
		return str.replace(/#([a-zA-Z0-9_]+)/g, (m) => {
			const id = m.substr(1, m.length - 1)
			return `#${idMap[id] || id}`
		})
	}

	return objList.map(i => {
		const o = clone(i)
		o.id = getUpdatePrefixedId(o)

		for (const key of _.keys(o.enable)) {
			if (typeof o.enable[key] === 'string') {
				o.enable[key] = replaceIds(o.enable[key])
			}
		}

		if (typeof o.inGroup === 'string') {
			o.inGroup = idMap[o.inGroup] || o.inGroup
		}

		return o
	})
}
