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
	getHash,
	protectString,
	isProtectedString
} from '../../lib/lib'
import {
	Rundown,
	Rundowns,
	RundownId
} from '../../lib/collections/Rundowns'
import { Parts } from '../../lib/collections/Parts'
import { Pieces } from '../../lib/collections/Pieces'
import { logger } from '../../lib/logging'
import { IBlueprintExternalMessageQueueObj, IBlueprintAsRunLogEventContent } from 'tv-automation-sofie-blueprints-integration'
import { queueExternalMessages } from './ExternalMessageQueue'
import { getBlueprintOfRundown } from './blueprints/cache'
import { AsRunEventContext } from './blueprints/context'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { PartInstance, PartInstances, PartInstanceId } from '../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../lib/collections/PieceInstances'
import { CacheForRundownPlaylist } from '../DatabaseCaches'

const EVENT_WAIT_TIME = 500

export async function pushAsRunLogAsync (eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): Promise<AsRunLogEvent | null> {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = extendMandadory<AsRunLogEventBase, AsRunLogEvent>(eventBase, {
		_id: protectString(getHash(JSON.stringify(eventBase) + timestamp + '_' + rehersal)),
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
function handleAsRunEvent (event: AsRunLogEvent): void {
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
export function reportRundownHasStarted (
	cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	rundown: Rundown,
	timestamp?: Time
) {
	// Called when the first part in rundown starts playing

	if (!rundown) {
		logger.error(`rundown argument missing in reportRundownHasStarted`)
	} else if (!playlist) {
		logger.error(`playlist argument missing in reportRundownHasStarted`)
	} else {
		cache.Rundowns.update(rundown._id, {
			$set: {
				startedPlayback: timestamp
			}
		})

		if (!playlist.startedPlayback) {
			cache.RundownPlaylists.update(playlist._id, {
				$set: {
					startedPlayback: timestamp
				}
			})
		}

		const event = pushAsRunLog({
			studioId: rundown.studioId,
			rundownId: rundown._id,
			content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
			content2: 'rundown'
		}, !!playlist.rehearsal, timestamp)
		if (event) handleAsRunEvent(event)
	}
}

export function reportRundownDataHasChanged (
	_cache: CacheForRundownPlaylist,
	playlist: RundownPlaylist,
	rundown: Rundown
) {
	// Called when the data in rundown is changed

	if (!rundown) {
		logger.error(`rundown argument missing in reportRundownDataHasChanged`)
	} else if (!playlist) {
		logger.error(`playlist argument missing in reportRundownDataHasChanged`)
	} else {
		const timestamp = getCurrentTime()

		const event = pushAsRunLog({
			studioId: rundown.studioId,
			rundownId: rundown._id,
			content: IBlueprintAsRunLogEventContent.DATACHANGED,
			content2: 'rundown'
		}, !!playlist.rehearsal, timestamp)
		if (event) handleAsRunEvent(event)
	}
}
// export function reportSegmentHasStarted (segment: Segment, timestamp?: Time) {
// }
export function reportPartHasStarted (
	cache: CacheForRundownPlaylist,
	partInstance: PartInstance,
	timestamp: Time
) {
	if (partInstance) {

		cache.PartInstances.update(partInstance._id, {
			$set: {
				'part.startedPlayback': true,
				'part.stoppedPlayback': false,
				isTaken: true
			},
			$push: {
				'part.timings.startedPlayback': timestamp
			}
		})
		const rundown = cache.Rundowns.findOne(partInstance.rundownId)

		// TODO-PartInstance - pending new data flow
		cache.Parts.update(partInstance.part._id, {
			$set: {
				startedPlayback: true,
				stoppedPlayback: false,
			},
			$push: {
				'timings.startedPlayback': timestamp
			}
		})

		if (rundown) {
			const playlist = cache.RundownPlaylists.findOne(rundown.playlistId)
			if (!playlist) throw new Meteor.Error(500, `Playlist "${rundown.playlistId}" not found`)

			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:			rundown._id,
				segmentId:			partInstance.segmentId,
				partInstanceId:		partInstance._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'part'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleAsRunEvent(event)
		} else {
			logger.error(`Rundown "${partInstance.rundownId}" not found in reportPartHasStarted "${partInstance._id}"`)
		}
	}
}
export function reportPartHasStopped (partInstanceOrId: PartInstance | PartInstanceId , timestamp: Time) {

	let partInstance = (
		isProtectedString(partInstanceOrId) ?
		PartInstances.findOne(partInstanceOrId) :
		partInstanceOrId
	)
	if (partInstance) {
		let rundown: Rundown | undefined

		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(PartInstances, partInstance._id, {
				$set: {
					'part.stoppedPlayback': true,
				},
				$push: {
					'part.timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, partInstance.rundownId),

			// TODO-PartInstance - pending new data flow
			asyncCollectionUpdate(Parts, partInstance.part._id, {
				$set: {
					stoppedPlayback: true,
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			})
		])
		rundown = r[1]
		// also update local object:
		partInstance.part.stoppedPlayback = true
		pushOntoPath(partInstance.part, 'timings.stoppedPlayback', timestamp)

		if (rundown) {
			const playlist = rundown.getRundownPlaylist()
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:		rundown._id,
				segmentId:			partInstance.segmentId,
				partInstanceId:		partInstance._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'part'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleAsRunEvent(event)
			return event
		} else logger.error(`Rundown "${partInstance.rundownId}" not found in reportPartHasStarted "${partInstance._id}"`)
	} else logger.error(`PartInstance not found in reportPartHasStarted "${partInstanceOrId}"`)
}

export function reportPieceHasStarted (pieceInstanceOrId: PieceInstance | PieceInstanceId, timestamp: Time) {

	let pieceInstance = (
		isProtectedString(pieceInstanceOrId) ?
		PieceInstances.findOne(pieceInstanceOrId) :
		pieceInstanceOrId
	)
	if (pieceInstance) {
		let rundown: Rundown | undefined
		let partInstance: PartInstance | undefined
		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(PieceInstances, pieceInstance._id, {
				$set: {
					'piece.startedPlayback': timestamp,
					'piece.stoppedPlayback': 0
				},
				$push: {
					'piece.timings.startedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, pieceInstance.rundownId),
			asyncCollectionFindOne(PartInstances, pieceInstance.partInstanceId),

			// TODO-PartInstance - pending new data flow
			asyncCollectionUpdate(Pieces, pieceInstance.piece._id, {
				$set: {
					startedPlayback: timestamp,
					stoppedPlayback: 0
				},
				$push: {
					'timings.startedPlayback': timestamp
				}
			}),
		])
		rundown = r[1]
		partInstance = r[2]

		// also update local object:
		pieceInstance.piece.startedPlayback = timestamp
		pieceInstance.piece.stoppedPlayback = 0
		pushOntoPath(pieceInstance.piece, 'timings.startedPlayback', timestamp)

		if (!partInstance) {
			logger.error(`PartInstance "${pieceInstance.partInstanceId}" not found in reportPieceHasStarted "${pieceInstanceOrId}"`)
		} else if (!rundown) {
			logger.error(`Rundown "${pieceInstance.rundownId}" not found in reportPieceHasStarted "${pieceInstanceOrId}"`)
		} else {
			const playlist = rundown.getRundownPlaylist()
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:		rundown._id,
				segmentId:			partInstance.segmentId,
				partInstanceId:		partInstance._id,
				pieceInstanceId:	pieceInstance.piece._id,
				content:			IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 			'piece'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleAsRunEvent(event)
		}

	} else logger.error(`PieceInstance not found in reportPieceHasStarted "${pieceInstanceOrId}"`)
}
export function reportPieceHasStopped (pieceInstanceOrId: PieceInstance | PieceInstanceId, timestamp: Time) {

	let pieceInstance = (
		isProtectedString(pieceInstanceOrId) ?
		PieceInstances.findOne(pieceInstanceOrId) :
		pieceInstanceOrId
	)
	if (pieceInstance) {
		let rundown: Rundown
		let partInstance: PartInstance
		let r = waitForPromiseAll<any>([
			asyncCollectionUpdate(PieceInstances, pieceInstance._id, {
				$set: {
					'piece.stoppedPlayback': timestamp
				},
				$push: {
					'piece.timings.stoppedPlayback': timestamp
				}
			}),
			asyncCollectionFindOne(Rundowns, pieceInstance.rundownId),
			asyncCollectionFindOne(PartInstances, pieceInstance.partInstanceId),

			// TODO-PartInstance - pending new data flow
			asyncCollectionUpdate(Pieces, pieceInstance.piece._id, {
				$set: {
					stoppedPlayback: timestamp
				},
				$push: {
					'timings.stoppedPlayback': timestamp
				}
			})
		])
		rundown = r[1]
		partInstance = r[2]

		// also update local object:
		pieceInstance.piece.stoppedPlayback = timestamp
		pushOntoPath(pieceInstance.piece, 'timings.stoppedPlayback', timestamp)

		if (!partInstance) {
			logger.error(`PartInstance "${pieceInstance.partInstanceId}" not found in reportPieceHasStarted "${pieceInstanceOrId}"`)
		} else if (!rundown) {
			logger.error(`Rundown "${pieceInstance.rundownId}" not found in reportPieceHasStarted "${pieceInstanceOrId}"`)
		} else {
			const playlist = rundown.getRundownPlaylist()
			let event = pushAsRunLog({
				studioId:			rundown.studioId,
				rundownId:			rundown._id,
				segmentId:			partInstance.segmentId,
				partInstanceId:		partInstance._id,
				pieceInstanceId:	pieceInstance.piece._id,
				content:			IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 			'piece'
			}, !!playlist.rehearsal, timestamp)
			if (event) handleAsRunEvent(event)
		}

	} else logger.error(`piece not found in reportPieceHasStopped "${pieceInstanceOrId}"`)
}
