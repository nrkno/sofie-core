import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import {
	AsRunLogEventBase,
	AsRunLog,
	AsRunLogEvent
} from '../../lib/collections/AsRunLog'
import {
	getCurrentTime,
	Time,
	waitForPromise,
	pushOntoPath,
	waitForPromiseAll,
	asyncCollectionFindOne,
	asyncCollectionUpdate,
	extendMandadory,
	asyncCollectionUpsert,
	getHash
} from '../../lib/lib'
import {
	Rundown,
	Rundowns
} from '../../lib/collections/Rundowns'
import { Part, Parts } from '../../lib/collections/Parts'
import { Piece, Pieces } from '../../lib/collections/Pieces'
import { logger } from '../../lib/logging'
import { IBlueprintExternalMessageQueueObj, IBlueprintAsRunLogEventContent } from 'tv-automation-sofie-blueprints-integration'
import { queueExternalMessages } from './ExternalMessageQueue'
import { getBlueprintOfRundown } from './blueprints/cache'
import { AsRunEventContext } from './blueprints/context'
import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists';

const EVENT_WAIT_TIME = 500

export async function pushAsRunLogAsync (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): Promise<AsRunLogEvent | null> {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = extendMandadory<AsRunLogEventBase, AsRunLogEvent>(eventBase, {
		_id: getHash(JSON.stringify(eventBase) + timestamp + '_' + rehersal),
		timestamp: timestamp,
		rehersal: rehersal
	})

	let result = await asyncCollectionUpsert(AsRunLog, event._id, event)
	if (result.insertedId) {
		return event
	} else {
		return null
	}
}
export function pushAsRunLog (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): AsRunLogEvent | null {
	let p = pushAsRunLogAsync(eventBase, rehersal, timestamp)

	return waitForPromise(p)
}

/**
 * Called after an asRun log event occurs
 * @param event
 */
function handleEvent (event: AsRunLogEvent): void {
	// wait EVENT_WAIT_TIME, because blueprint.onAsRunEvent() might depend on events that
	// might havent been reported yet
	Meteor.setTimeout(() => {
		try {
			if (event.rundownId) {

				const rundown = Rundowns.findOne(event.rundownId)
				if (!rundown) throw new Meteor.Error(404, `Rundown "${event.rundownId}" not found!`)

				const { blueprint } = getBlueprintOfRundown(rundown)

				if (blueprint.onAsRunEvent) {
					const context = new AsRunEventContext(rundown, undefined, event)

					Promise.resolve(blueprint.onAsRunEvent(context))
					.then((messages: Array<IBlueprintExternalMessageQueueObj>) => {

						queueExternalMessages(rundown, messages)
					})
					.catch(error => logger.error(error))
				}

			}
		} catch (e) {
			logger.error(e)
		}
	}, EVENT_WAIT_TIME)
}

// Convenience functions:

export function reportRundownHasStarted (playlistOrId: RundownPlaylist | string, rundownOrId: Rundown | string, timestamp?: Time) {
	// Called when the first part in rundown starts playing

	const rundown = (
		_.isString(rundownOrId) ?
		Rundowns.findOne(rundownOrId) :
		rundownOrId
	)
	const playlist = (
		_.isString(playlistOrId) ?
		RundownPlaylists.findOne(playlistOrId) :
		playlistOrId
	)
	if (rundown && playlist) {
		Rundowns.update(rundown._id, {
			$set: {
				startedPlayback: timestamp
			}
		})

		if (!playlist.startedPlayback) {
			RundownPlaylists.update(playlist._id, {
				$set: {
					startedPlayback: timestamp
				}
			})
		}

		// also update local object:
		rundown.startedPlayback = timestamp

		const event = pushAsRunLog({
			studioId: rundown.studioId,
			rundownId: rundown._id,
			content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
			content2: 'rundown'
		}, !!playlist.rehearsal, timestamp)
		if (event) handleEvent(event)
	} else if (playlist)
		logger.error(`rundown not found in reportRundownHasStarted "${rundownOrId}"`)
	else
		logger.error(`playlist not found in reportRundownHasStarted "${playlistOrId}"`)
}
// export function reportSegmentHasStarted (segment: Segment, timestamp?: Time) {
// }
export function reportPartHasStarted (partOrId: Part | string , timestamp: Time) {

	let part = (
		_.isString(partOrId) ?
		Parts.findOne(partOrId) :
		partOrId
	)
	if (part) {
		let rundown: Rundown | undefined
		let playlist: RundownPlaylist

		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(Parts, part._id, {
				$set: {
					startedPlayback: true,
					stoppedPlayback: false,
				},
				$push: {
					'timings.startedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, part.rundownId)
		])
		rundown = r[1]
		playlist = rundown.getRundownPlaylist()
		// also update local object:
		part.startedPlayback = true
		part.stoppedPlayback = false
		pushOntoPath(part, 'timings.startedPlayback', timestamp)

		if (rundown && playlist) {
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:		rundown._id,
				segmentId:			part.segmentId,
				partId:		part._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'part'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleEvent(event)
		} else if (!rundown)
			logger.error(`rundown "${part.rundownId}" not found in reportPartHasStarted "${part._id}"`)
		else
			logger.error(`rundown playlist "${rundown.playlistId}" not found in reportPartHasStarted "${part._id}"`)
	} else logger.error(`part not found in reportPartHasStarted "${partOrId}"`)
}
export function reportPartHasStopped (partOrId: Part | string , timestamp: Time) {

	let part = (
		_.isString(partOrId) ?
		Parts.findOne(partOrId) :
		partOrId
	)
	if (part) {
		let rundown: Rundown | undefined

		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(Parts, part._id, {
				$set: {
					stoppedPlayback: true,
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, part.rundownId)
		])
		rundown = r[1]
		// also update local object:
		part.stoppedPlayback = true
		pushOntoPath(part, 'timings.stoppedPlayback', timestamp)

		if (rundown) {
			const playlist = rundown.getRundownPlaylist()
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:		rundown._id,
				segmentId:			part.segmentId,
				partId:		part._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'part'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleEvent(event)
			return event
		} else logger.error(`rundown "${part.rundownId}" not found in reportPartHasStopped "${part._id}"`)
	} else logger.error(`part not found in reportPartHasStopped "${partOrId}"`)
}

export function reportPieceHasStarted (pieceOrId: Piece | string, timestamp: Time) {

	let piece = (
		_.isString(pieceOrId) ?
		Pieces.findOne(pieceOrId) :
		pieceOrId
	)
	if (piece) {

		let rundown: Rundown | undefined
		let part: Part | undefined
		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(Pieces, piece._id, {
				$set: {
					startedPlayback: timestamp,
					stoppedPlayback: 0
				},
				$push: {
					'timings.startedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, piece.rundownId),
			asyncCollectionFindOne(Parts, piece.partId)
		])
		rundown = r[1]
		part = r[2]
		const playlist = rundown.getRundownPlaylist()
		// also update local object:
		piece.startedPlayback = timestamp
		piece.stoppedPlayback = 0
		pushOntoPath(piece, 'timings.startedPlayback', timestamp)

		if (rundown && part) {
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:		rundown._id,
				segmentId:			part.segmentId,
				partId:		piece.partId,
				pieceId:	piece._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'piece'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleEvent(event)
		} else if (part) {
			logger.error(`Part "${piece.partId}" not found in reportPieceHasStarted "${piece._id}"`)
		} else {
			logger.error(`Rundown "${piece.rundownId}" not found in reportPieceHasStarted "${piece._id}"`)
		}

	} else logger.error(`piece not found in reportPieceHasStarted "${pieceOrId}"`)
}
export function reportPieceHasStopped (pieceOrId: Piece | string, timestamp: Time) {

	let piece = (
		_.isString(pieceOrId) ?
		Pieces.findOne(pieceOrId) :
		pieceOrId
	)
	if (piece) {

		let rundown: Rundown | undefined
		let part: Part | undefined
		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(Pieces, piece._id, {
				$set: {
					stoppedPlayback: timestamp
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, piece.rundownId),
			asyncCollectionFindOne(Parts, piece.partId)
		])
		rundown = r[1]
		part = r[2]
		const playlist = rundown.getRundownPlaylist()
		// also update local object:
		piece.stoppedPlayback = timestamp
		pushOntoPath(piece, 'timings.stoppedPlayback', timestamp)

		if (rundown && part) {
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:		rundown._id,
				segmentId:			part.segmentId,
				partId:		piece.partId,
				pieceId:	piece._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'piece'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleEvent(event)
		}  else if (part) {
			logger.error(`Part "${piece.partId}" not found in reportPieceHasStopped "${piece._id}"`)
		} else {
			logger.error(`Rundown "${piece.rundownId}" not found in reportPieceHasStopped "${piece._id}"`)
		}

	} else logger.error(`piece not found in reportPieceHasStopped "${pieceOrId}"`)
}
