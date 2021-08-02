import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CacheForPlayout } from '../playout/cache'
import { Time } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { JobContext } from '../jobs'
import { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

// const EVENT_WAIT_TIME = 500

// async function getBlueprintAndDependencies(rundown: ReadonlyDeep<Rundown>) {
// 	const pShowStyle = getShowStyleCompoundForRundown(rundown)

// 	const [showStyle, studio, playlist, blueprint] = await Promise.all([
// 		pShowStyle,
// 		Studios.findOneAsync(rundown.studioId),
// 		RundownPlaylists.findOneAsync(rundown.playlistId),
// 		pShowStyle.then(async (ss) => loadShowStyleBlueprint(ss)),
// 	])

// 	if (!studio) throw new Meteor.Error(404, `Studio "${rundown.studioId}" not found!`)
// 	if (!playlist) throw new Meteor.Error(404, `Playlist "${rundown.playlistId}" not found!`)

// 	return {
// 		rundown,
// 		showStyle,
// 		studio,
// 		playlist,
// 		blueprint: blueprint.blueprint,
// 	}
// }

// const partInstanceTimingDebounceFunctions = new Map<string, DebouncedFunction<[], void>>()

// async function handlePartInstanceTimingEventInner(
// 	playlistId: RundownPlaylistId,
// 	partInstanceId: PartInstanceId
// ): Promise<void> {
// 	const span = profiler.startSpan('handlePartInstanceTimingEvent')
// 	try {
// 		const timestamp = getCurrentTime()

// 		const partInstance = await PartInstances.findOneAsync(partInstanceId)
// 		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

// 		const rundown = await Rundowns.findOneAsync(partInstance.rundownId)
// 		if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

// 		const { studio, showStyle, playlist, blueprint } = await getBlueprintAndDependencies(rundown)

// 		if (playlist._id !== playlistId)
// 			throw new Meteor.Error(
// 				404,
// 				`PartInstance "${partInstanceId}" does not belong to RundownPlaylist "${playlistId}"!`
// 			)

// 		if (blueprint.onRundownTimingEvent) {
// 			// The the PartInstances(events) before and after the one we are processing
// 			const [previousPartInstance, nextPartInstance] = await Promise.all([
// 				PartInstances.findOneAsync(
// 					{
// 						rundownId: partInstance.rundownId,
// 						playlistActivationId: partInstance.playlistActivationId,
// 						takeCount: { $lt: partInstance.takeCount },
// 					},
// 					{
// 						sort: {
// 							takeCount: -1,
// 						},
// 					}
// 				),
// 				PartInstances.findOneAsync(
// 					{
// 						rundownId: partInstance.rundownId,
// 						playlistActivationId: partInstance.playlistActivationId,
// 						takeCount: { $gt: partInstance.takeCount },
// 					},
// 					{
// 						sort: {
// 							takeCount: 1,
// 						},
// 					}
// 				),
// 			])

// 			const context = new RundownTimingEventContext(
// 				{
// 					name: rundown.name,
// 					identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
// 				},
// 				studio,
// 				showStyle,
// 				rundown,
// 				previousPartInstance,
// 				partInstance,
// 				nextPartInstance
// 			)

// 			try {
// 				const messages = await blueprint.onRundownTimingEvent(context)
// 				queueExternalMessages(rundown, messages)
// 			} catch (error) {
// 				logger.error(error)
// 			}
// 		}
// 	} catch (e) {
// 		logger.error(`handlePartInstanceTimingEvent: ${e}`)
// 	}
// 	span?.end()
// }

function handlePartInstanceTimingEvent(_playlistId: RundownPlaylistId, _partInstanceId: PartInstanceId): void {
	// TODO
	// 	// wait EVENT_WAIT_TIME, because blueprint.onAsRunEvent() it is likely for there to be a bunch of started and stopped events coming in at the same time
	// 	// These blueprint methods are not time critical (meaning they do raw db operations), and can be easily delayed
	// 	const funcId = `${playlistId}_${partInstanceId}`
	// 	const cachedFunc = partInstanceTimingDebounceFunctions.get(funcId)
	// 	if (cachedFunc) {
	// 		cachedFunc()
	// 	} else {
	// 		const newFunc = debounceFn(
	// 			Meteor.bindEnvironment(() => {
	// 				handlePartInstanceTimingEventInner(playlistId, partInstanceId).catch((e) => {
	// 					let msg = `Error in handlePartInstanceTimingEvent "${funcId}": "${e.toString()}"`
	// 					if (e.stack) msg += '\n' + e.stack
	// 					logger.error(msg)
	// 					throw e
	// 				})
	// 			}),
	// 			{
	// 				before: false,
	// 				after: true,
	// 				wait: EVENT_WAIT_TIME,
	// 			}
	// 		)
	// 		partInstanceTimingDebounceFunctions.set(funcId, newFunc)
	// 		newFunc()
	// 	}
}
// export function reportRundownDataHasChanged(
// 	playlist: ReadonlyDeep<RundownPlaylist>,
// 	rundown: ReadonlyDeep<Rundown>
// ): void {
// 	Meteor.defer(async () => {
// 		try {
// 			// Called when the data in rundown is changed

// 			if (!rundown) {
// 				logger.error(`rundown argument missing in reportRundownDataHasChanged`)
// 			} else if (!playlist) {
// 				logger.error(`playlist argument missing in reportRundownDataHasChanged`)
// 			} else {
// 				const timestamp = getCurrentTime()

// 				const { studio, showStyle, blueprint } = await getBlueprintAndDependencies(rundown)

// 				if (blueprint.onRundownDataChangedEvent) {
// 					const context = new RundownDataChangedEventContext(
// 						{
// 							name: rundown.name,
// 							identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
// 						},
// 						studio,
// 						showStyle,
// 						rundown
// 					)

// 					try {
// 						const messages = await blueprint.onRundownDataChangedEvent(context)
// 						queueExternalMessages(rundown, messages)
// 					} catch (error) {
// 						logger.error(error)
// 					}
// 				}
// 			}
// 		} catch (e) {
// 			logger.error(`reportRundownDataHasChanged: ${e}`)
// 		}
// 	})
// }

export function reportPartInstanceHasStarted(
	cache: CacheForPlayout,
	partInstance: DBPartInstance,
	timestamp: Time
): void {
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
			if (!pl.rundownsStartedPlayback[rundownId] && !partInstance.part.untimed)
				pl.rundownsStartedPlayback[rundownId] = timestamp
			if (!pl.startedPlayback && !partInstance.part.untimed) pl.startedPlayback = timestamp
			return pl
		})

		cache.deferAfterSave(() => {
			// Run in the background, we don't want to hold onto the lock to do this
			// TODO hack
			// Meteor.setTimeout(() => {
			// 	handlePartInstanceTimingEvent(cache.PlaylistId, partInstance._id)
			// }, LOW_PRIO_DEFER_TIME)
		})
	}
}
export async function reportPartInstanceHasStopped(
	context: JobContext,
	playlistId: RundownPlaylistId,
	partInstance: DBPartInstance,
	timestamp: Time
): Promise<void> {
	await context.directCollections.PartInstances.update(partInstance._id, {
		$set: {
			'timings.stoppedPlayback': timestamp,
		},
	})

	handlePartInstanceTimingEvent(playlistId, partInstance._id)
}

export async function reportPieceHasStarted(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	pieceInstance: PieceInstance,
	timestamp: Time
): Promise<void> {
	await Promise.all([
		context.directCollections.PieceInstances.update(pieceInstance._id, {
			$set: {
				startedPlayback: timestamp,
				stoppedPlayback: 0,
			},
		}),

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		pieceInstance.infinite && playlist?.nextPartInstanceId
			? context.directCollections.PieceInstances.update(
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
			: null,
	])

	handlePartInstanceTimingEvent(playlist._id, pieceInstance.partInstanceId)
}
export async function reportPieceHasStopped(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	pieceInstance: PieceInstance,
	timestamp: Time
): Promise<void> {
	await context.directCollections.PieceInstances.update(pieceInstance._id, {
		$set: {
			stoppedPlayback: timestamp,
		},
	})

	handlePartInstanceTimingEvent(playlist._id, pieceInstance.partInstanceId)
}
