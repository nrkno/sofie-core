import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { AsRunLogEventBase, AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'
import {
	getCurrentTime,
	Time,
	waitForPromise,
	waitForPromiseAll,
	asyncCollectionFindOne,
	asyncCollectionUpdate,
	extendMandadory,
	asyncCollectionUpsert,
	getHash,
	protectString,
} from '../../lib/lib'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { logger } from '../../lib/logging'
import {
	IBlueprintExternalMessageQueueObj,
	IBlueprintAsRunLogEventContent,
} from 'tv-automation-sofie-blueprints-integration'
import { queueExternalMessages } from './ExternalMessageQueue'
import { loadShowStyleBlueprint } from './blueprints/cache'
import { AsRunEventContext } from './blueprints/context'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { PartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance } from '../../lib/collections/PieceInstances'
import { CacheForRundownPlaylist, initReadOnlyCacheForRundownPlaylist } from '../DatabaseCaches'
import { profiler } from './profiler'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'

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

				const pShowStyleBase = asyncCollectionFindOne(ShowStyleBases, rundown.showStyleBaseId)

				const playlist = RundownPlaylists.findOne(rundown.playlistId)
				if (!playlist) throw new Meteor.Error(404, `Playlist "${rundown.playlistId}" not found!`)

				const showStyleBase = waitForPromise(pShowStyleBase)
				if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${rundown.showStyleBaseId}" not found!`)

				const { blueprint } = loadShowStyleBlueprint(showStyleBase)

				if (blueprint.onAsRunEvent) {
					const cache = waitForPromise(initReadOnlyCacheForRundownPlaylist(playlist))

					const context = new AsRunEventContext(rundown, cache, event)

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
		const span = profiler.startSpan('reportPartHasStarted')
		cache.PartInstances.update(partInstance._id, {
			$set: {
				isTaken: true,
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
		if (span) span.end()
	}
}
export function reportPartHasStopped(playlistId: RundownPlaylistId, partInstance: PartInstance, timestamp: Time) {
	const [playlist] = waitForPromiseAll([
		asyncCollectionFindOne(RundownPlaylists, playlistId),

		asyncCollectionUpdate(PartInstances, partInstance._id, {
			$set: {
				'timings.stoppedPlayback': timestamp,
			},
		}),
	])
	// also update local object:
	if (!partInstance.timings) partInstance.timings = {}
	partInstance.timings.stoppedPlayback = timestamp

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
				startedPlayback: timestamp,
				stoppedPlayback: 0,
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
							startedPlayback: timestamp,
							stoppedPlayback: 0,
						},
					}
			  )
			: (Promise.resolve() as Promise<any>),
	])

	// also update local object:
	pieceInstance.startedPlayback = timestamp
	pieceInstance.stoppedPlayback = 0

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
				stoppedPlayback: timestamp,
			},
		}),
	])

	// also update local object:
	pieceInstance.stoppedPlayback = timestamp

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
