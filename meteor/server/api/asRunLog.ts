import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { AsRunLogEventBase, AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'
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
	isProtectedString,
} from '../../lib/lib'
import { Rundown, Rundowns, RundownId } from '../../lib/collections/Rundowns'
import { Parts } from '../../lib/collections/Parts'
import { Pieces } from '../../lib/collections/Pieces'
import { logger } from '../../lib/logging'
import {
	IBlueprintExternalMessageQueueObj,
	IBlueprintAsRunLogEventContent,
} from 'tv-automation-sofie-blueprints-integration'
import { queueExternalMessages } from './ExternalMessageQueue'
import { getBlueprintOfRundown } from './blueprints/cache'
import { AsRunEventContext } from './blueprints/context'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { PartInstance, PartInstances, PartInstanceId } from '../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance, PieceInstanceId } from '../../lib/collections/PieceInstances'
import { CacheForRundownPlaylist } from '../DatabaseCaches'

const EVENT_WAIT_TIME = 500

export async function pushAsRunLogAsync(
	eventBase: AsRunLogEventBase,
	rehersal: boolean,
	timestamp?: Time
): Promise<AsRunLogEvent | null> {
	if (!timestamp) timestamp = getCurrentTime()

	let event: AsRunLogEvent = extendMandadory<AsRunLogEventBase, AsRunLogEvent>(eventBase, {
		_id: protectString(getHash(JSON.stringify(eventBase) + timestamp + '_' + rehersal)),
		timestamp: timestamp,
		rehersal: rehersal,
	})

	let result = await asyncCollectionUpsert(AsRunLog, event._id, event)
	if (result.insertedId) {
		return event
	} else {
		return null
	}
}
export function pushAsRunLog(eventBase: AsRunLogEventBase, rehersal: boolean, timestamp?: Time): AsRunLogEvent | null {
	let p = pushAsRunLogAsync(eventBase, rehersal, timestamp)

	return waitForPromise(p)
}

/**
 * Called after an asRun log event occurs
 * @param event
 */
function handleAsRunEvent(event: AsRunLogEvent): void {
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
						.catch((error) => logger.error(error))
				}
			}
		} catch (e) {
			logger.error(e)
		}
	}, EVENT_WAIT_TIME)
}

// Convenience functions:
export function reportRundownHasStarted(
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
				startedPlayback: timestamp,
			},
		})

		if (!playlist.startedPlayback) {
			cache.RundownPlaylists.update(playlist._id, {
				$set: {
					startedPlayback: timestamp,
				},
			})
		}

		const event = pushAsRunLog(
			{
				studioId: rundown.studioId,
				rundownId: rundown._id,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 'rundown',
			},
			!!playlist.rehearsal,
			timestamp
		)
		if (event) handleAsRunEvent(event)
	}
}

export function reportRundownDataHasChanged(
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

		const event = pushAsRunLog(
			{
				studioId: rundown.studioId,
				rundownId: rundown._id,
				content: IBlueprintAsRunLogEventContent.DATACHANGED,
				content2: 'rundown',
			},
			!!playlist.rehearsal,
			timestamp
		)
		if (event) handleAsRunEvent(event)
	}
}

export function reportPartHasStarted(cache: CacheForRundownPlaylist, partInstance: PartInstance, timestamp: Time) {
	if (partInstance) {
		cache.PartInstances.update(partInstance._id, {
			$set: {
				'part.startedPlayback': true,
				'part.stoppedPlayback': false,
				isTaken: true,
			},
			$push: {
				'part.timings.startedPlayback': timestamp,
			},
		})

		// TODO-PartInstance - pending new data flow
		cache.Parts.update(partInstance.part._id, {
			$set: {
				startedPlayback: true,
				stoppedPlayback: false,
			},
			$push: {
				'timings.startedPlayback': timestamp,
			},
		})

		const playlist = cache.RundownPlaylists.findOne(cache.containsDataFromPlaylist)
		if (playlist) {
			let event = pushAsRunLog(
				{
					studioId: playlist.studioId,
					rundownId: partInstance.rundownId,
					segmentId: partInstance.segmentId,
					partInstanceId: partInstance._id,
					content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
					content2: 'part',
				},
				!!playlist.rehearsal,
				timestamp
			)
			if (event) handleAsRunEvent(event)
		} else {
			logger.error(
				`RundownPlaylist "${cache.containsDataFromPlaylist}" not found in reportPartHasStarted "${partInstance._id}"`
			)
		}
	}
}
export function reportPartHasStopped(playlistId: RundownPlaylistId, partInstance: PartInstance, timestamp: Time) {
	const [playlist] = waitForPromiseAll([
		asyncCollectionFindOne(RundownPlaylists, playlistId),

		asyncCollectionUpdate(PartInstances, partInstance._id, {
			$set: {
				'part.stoppedPlayback': true,
			},
			$push: {
				'part.timings.stoppedPlayback': timestamp,
			},
		}),

		// TODO-PartInstance - pending new data flow
		asyncCollectionUpdate(Parts, partInstance.part._id, {
			$set: {
				stoppedPlayback: true,
			},
			$push: {
				'timings.stoppedPlayback': timestamp,
			},
		}),
	])
	// also update local object:
	partInstance.part.stoppedPlayback = true
	pushOntoPath(partInstance.part, 'timings.stoppedPlayback', timestamp)

	if (playlist) {
		let event = pushAsRunLog(
			{
				studioId: playlist.studioId,
				rundownId: partInstance.rundownId,
				segmentId: partInstance.segmentId,
				partInstanceId: partInstance._id,
				content: IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 'part',
			},
			!!playlist.rehearsal,
			timestamp
		)
		if (event) handleAsRunEvent(event)
		return event
	} else logger.error(`RundownPlaylist "${playlistId}" not found in reportPartHasStopped "${partInstance._id}"`)
}

export function reportPieceHasStarted(playlistId: RundownPlaylistId, pieceInstance: PieceInstance, timestamp: Time) {
	const playlist = RundownPlaylists.findOne(playlistId)

	const [partInstance] = waitForPromiseAll([
		asyncCollectionFindOne(PartInstances, pieceInstance.partInstanceId),

		asyncCollectionUpdate(PieceInstances, pieceInstance._id, {
			$set: {
				'piece.startedPlayback': timestamp,
				'piece.stoppedPlayback': 0,
			},
			$push: {
				'piece.timings.startedPlayback': timestamp,
			},
		}),

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		// TODO-INSTANCES - do we need to be careful of re-entering the origin?
		pieceInstance.infinite && playlist?.nextPartInstanceId
			? asyncCollectionUpdate(
					PieceInstances,
					{
						partInstanceId: playlist.nextPartInstanceId,
						'infinite.infinitePieceId': pieceInstance.infinite.infinitePieceId,
					},
					{
						$set: {
							'piece.startedPlayback': timestamp,
							'piece.stoppedPlayback': 0,
						},
						$push: {
							'piece.timings.startedPlayback': timestamp,
						},
					}
			  )
			: (Promise.resolve() as Promise<any>),

		// TODO-PartInstance - pending new data flow
		asyncCollectionUpdate(Pieces, pieceInstance.piece._id, {
			$set: {
				startedPlayback: timestamp,
				stoppedPlayback: 0,
			},
			$push: {
				'timings.startedPlayback': timestamp,
			},
		}),
	])

	// also update local object:
	pieceInstance.piece.startedPlayback = timestamp
	pieceInstance.piece.stoppedPlayback = 0
	pushOntoPath(pieceInstance.piece, 'timings.startedPlayback', timestamp)

	if (!partInstance) {
		logger.error(
			`PartInstance "${pieceInstance.partInstanceId}" not found in reportPieceHasStarted "${pieceInstance._id}"`
		)
	} else if (!playlist) {
		logger.error(`RundownPlaylist "${playlistId}" not found in reportPieceHasStarted "${pieceInstance._id}"`)
	} else {
		let event = pushAsRunLog(
			{
				studioId: playlist.studioId,
				rundownId: pieceInstance.rundownId,
				segmentId: partInstance.segmentId,
				partInstanceId: partInstance._id,
				pieceInstanceId: pieceInstance._id,
				content: IBlueprintAsRunLogEventContent.STARTEDPLAYBACK,
				content2: 'piece',
			},
			!!playlist.rehearsal,
			timestamp
		)
		if (event) handleAsRunEvent(event)
	}
}
export function reportPieceHasStopped(playlistId: RundownPlaylistId, pieceInstance: PieceInstance, timestamp: Time) {
	const playlist = RundownPlaylists.findOne(playlistId)

	const [partInstance] = waitForPromiseAll([
		asyncCollectionFindOne(PartInstances, pieceInstance.partInstanceId),

		asyncCollectionUpdate(PieceInstances, pieceInstance._id, {
			$set: {
				'piece.stoppedPlayback': timestamp,
			},
			$push: {
				'piece.timings.stoppedPlayback': timestamp,
			},
		}),

		// TODO-PartInstance - pending new data flow
		asyncCollectionUpdate(Pieces, pieceInstance.piece._id, {
			$set: {
				stoppedPlayback: timestamp,
			},
			$push: {
				'timings.stoppedPlayback': timestamp,
			},
		}),
	])

	// also update local object:
	pieceInstance.piece.stoppedPlayback = timestamp
	pushOntoPath(pieceInstance.piece, 'timings.stoppedPlayback', timestamp)

	if (!partInstance) {
		logger.error(
			`PartInstance "${pieceInstance.partInstanceId}" not found in reportPieceHasStopped "${pieceInstance._id}"`
		)
	} else if (!playlist) {
		logger.error(`RundownPlaylist "${playlistId}" not found in reportPieceHasStopped "${pieceInstance._id}"`)
	} else {
		let event = pushAsRunLog(
			{
				studioId: playlist.studioId,
				rundownId: pieceInstance.rundownId,
				segmentId: partInstance.segmentId,
				partInstanceId: partInstance._id,
				pieceInstanceId: pieceInstance._id,
				content: IBlueprintAsRunLogEventContent.STOPPEDPLAYBACK,
				content2: 'piece',
			},
			!!playlist.rehearsal,
			timestamp
		)
		if (event) handleAsRunEvent(event)
	}
}
