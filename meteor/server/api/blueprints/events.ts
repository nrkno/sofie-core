import { Meteor } from 'meteor/meteor'
import { getCurrentTime, Time, unprotectString, waitForPromise, waitForPromiseAll } from '../../../lib/lib'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { logger } from '../../../lib/logging'
import { IBlueprintExternalMessageQueueObj } from '@sofie-automation/blueprints-integration'
import { queueExternalMessages } from '../ExternalMessageQueue'
import { loadShowStyleBlueprint } from './cache'
import { RundownTimingEventContext, RundownDataChangedEventContext } from './context'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstance, PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { PieceInstances, PieceInstance } from '../../../lib/collections/PieceInstances'
import { profiler } from '../profiler'
import { CacheForPlayout } from '../playout/cache'
import { Studios } from '../../../lib/collections/Studios'
import { ReadonlyDeep } from 'type-fest'
import { asyncCollectionFindOne, asyncCollectionUpdate } from '../../lib/database'
import { getShowStyleCompoundForRundown } from '../showStyles'
import debounceFn, { DebouncedFunction } from 'debounce-fn'

const EVENT_WAIT_TIME = 500

async function getBlueprintAndDependencies(rundown: ReadonlyDeep<Rundown>) {
	const pShowStyle = getShowStyleCompoundForRundown(rundown)

	const [showStyle, studio, playlist, blueprint] = waitForPromiseAll([
		pShowStyle,
		asyncCollectionFindOne(Studios, rundown.studioId),
		asyncCollectionFindOne(RundownPlaylists, rundown.playlistId),
		pShowStyle.then((ss) => loadShowStyleBlueprint(ss).blueprint),
	])

	if (!studio) throw new Meteor.Error(404, `Studio "${rundown.studioId}" not found!`)
	if (!playlist) throw new Meteor.Error(404, `Playlist "${rundown.playlistId}" not found!`)

	return {
		rundown,
		showStyle,
		studio,
		playlist,
		blueprint,
	}
}

const partInstanceTimingDebounceFunctions = new Map<string, DebouncedFunction<[], void>>()

function handlePartInstanceTimingEventInner(playlistId: RundownPlaylistId, partInstanceId: PartInstanceId): void {
	const span = profiler.startSpan('handlePartInstanceTimingEvent')
	try {
		const timestamp = getCurrentTime()

		const partInstance = PartInstances.findOne(partInstanceId)
		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

		const rundown = Rundowns.findOne(partInstance.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

		const { studio, showStyle, playlist, blueprint } = waitForPromise(getBlueprintAndDependencies(rundown))

		if (playlist._id !== playlistId)
			throw new Meteor.Error(
				404,
				`PartInstance "${partInstanceId}" does not belong to RundownPlaylist "${playlistId}"!`
			)

		if (blueprint.onRundownTimingEvent) {
			// The the PartInstances(events) before and after the one we are processing
			const [previousPartInstance, nextPartInstance] = waitForPromiseAll([
				asyncCollectionFindOne(
					PartInstances,
					{
						rundownId: partInstance.rundownId,
						playlistActivationId: partInstance.playlistActivationId,
						takeCount: { $lt: partInstance.takeCount },
					},
					{
						sort: {
							takeCount: -1,
						},
					}
				),
				asyncCollectionFindOne(
					PartInstances,
					{
						rundownId: partInstance.rundownId,
						playlistActivationId: partInstance.playlistActivationId,
						takeCount: { $gt: partInstance.takeCount },
					},
					{
						sort: {
							takeCount: 1,
						},
					}
				),
			])

			const context = new RundownTimingEventContext(
				{
					name: rundown.name,
					identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
				},
				studio,
				showStyle,
				rundown,
				previousPartInstance,
				partInstance,
				nextPartInstance
			)
			Promise.resolve(blueprint.onRundownTimingEvent(context))
				.then((messages: Array<IBlueprintExternalMessageQueueObj>) => {
					queueExternalMessages(rundown, messages)
				})
				.catch((error) => logger.error(error))
		}
	} catch (e) {
		logger.error(`handlePartInstanceTimingEvent: ${e}`)
	}
	span?.end()
}

function handlePartInstanceTimingEvent(playlistId: RundownPlaylistId, partInstanceId: PartInstanceId): void {
	// wait EVENT_WAIT_TIME, because blueprint.onAsRunEvent() it is likely for there to be a bunch of started and stopped events coming in at the same time
	// These blueprint methods are not time critical (meaning they do raw db operations), and can be easily delayed

	const funcId = `${playlistId}_${partInstanceId}`
	const cachedFunc = partInstanceTimingDebounceFunctions.get(funcId)
	if (cachedFunc) {
		cachedFunc()
	} else {
		const newFunc = debounceFn(
			Meteor.bindEnvironment(() => handlePartInstanceTimingEventInner(playlistId, partInstanceId)),
			{
				before: false,
				after: true,
				wait: EVENT_WAIT_TIME,
			}
		)
		partInstanceTimingDebounceFunctions.set(funcId, newFunc)
		newFunc()
	}
}
export function reportRundownDataHasChanged(playlist: ReadonlyDeep<RundownPlaylist>, rundown: ReadonlyDeep<Rundown>) {
	// Called when the data in rundown is changed

	if (!rundown) {
		logger.error(`rundown argument missing in reportRundownDataHasChanged`)
	} else if (!playlist) {
		logger.error(`playlist argument missing in reportRundownDataHasChanged`)
	} else {
		const timestamp = getCurrentTime()

		const { studio, showStyle, blueprint } = waitForPromise(getBlueprintAndDependencies(rundown))

		if (blueprint.onRundownDataChangedEvent) {
			const context = new RundownDataChangedEventContext(
				{
					name: rundown.name,
					identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
				},
				studio,
				showStyle,
				rundown
			)

			Promise.resolve(blueprint.onRundownDataChangedEvent(context))
				.then((messages: Array<IBlueprintExternalMessageQueueObj>) => {
					queueExternalMessages(rundown, messages)
				})
				.catch((error) => logger.error(error))
		}
	}
}

export function reportPartInstanceHasStarted(cache: CacheForPlayout, partInstance: PartInstance, timestamp: Time) {
	if (partInstance) {
		cache.PartInstances.update(partInstance._id, {
			$set: {
				isTaken: true,
				'timings.startedPlayback': timestamp,
			},
		})

		// Track on the playlist
		cache.Playlist.update((pl) => {
			if (!pl.rundownsStartedPlayback) pl.rundownsStartedPlayback = {}
			const rundownId = unprotectString(partInstance.rundownId)
			if (!pl.rundownsStartedPlayback[rundownId]) pl.rundownsStartedPlayback[rundownId] = timestamp
			if (!pl.startedPlayback) pl.startedPlayback = timestamp
			return pl
		})

		cache.deferAfterSave(() => {
			handlePartInstanceTimingEvent(cache.PlaylistId, partInstance._id)
		})
	}
}
export function reportPartHasStopped(playlistId: RundownPlaylistId, partInstance: PartInstance, timestamp: Time) {
	waitForPromise(
		asyncCollectionUpdate(PartInstances, partInstance._id, {
			$set: {
				'timings.stoppedPlayback': timestamp,
			},
		})
	)

	handlePartInstanceTimingEvent(playlistId, partInstance._id)
}

export function reportPieceHasStarted(
	playlist: ReadonlyDeep<RundownPlaylist>,
	pieceInstance: PieceInstance,
	timestamp: Time
) {
	waitForPromiseAll([
		asyncCollectionUpdate(PieceInstances, pieceInstance._id, {
			$set: {
				startedPlayback: timestamp,
				stoppedPlayback: 0,
			},
		}),

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		pieceInstance.infinite && playlist?.nextPartInstanceId
			? asyncCollectionUpdate(
					PieceInstances,
					{
						partInstanceId: playlist.nextPartInstanceId,
						'infinite.infiniteInstanceId': pieceInstance.infinite.infiniteInstanceId,
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

	handlePartInstanceTimingEvent(playlist._id, pieceInstance.partInstanceId)
}
export function reportPieceHasStopped(
	playlist: ReadonlyDeep<RundownPlaylist>,
	pieceInstance: PieceInstance,
	timestamp: Time
) {
	PieceInstances.update(pieceInstance._id, {
		$set: {
			stoppedPlayback: timestamp,
		},
	})

	handlePartInstanceTimingEvent(playlist._id, pieceInstance.partInstanceId)
}
