import { Meteor } from 'meteor/meteor'
import { getCurrentTime } from '../../../lib/lib'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { logger } from '../../../lib/logging'
import { queueExternalMessages } from '../ExternalMessageQueue'
import { loadShowStyleBlueprint } from './cache'
import { RundownTimingEventContext } from './context'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { PartInstanceId, PartInstances } from '../../../lib/collections/PartInstances'
import { profiler } from '../profiler'
import { Studios } from '../../../lib/collections/Studios'
import { ReadonlyDeep } from 'type-fest'
import { getShowStyleCompoundForRundown } from '../showStyles'
import debounceFn, { DebouncedFunction } from 'debounce-fn'

const EVENT_WAIT_TIME = 500

async function getBlueprintAndDependencies(rundown: ReadonlyDeep<Rundown>) {
	const pShowStyle = getShowStyleCompoundForRundown(rundown)

	const [showStyle, studio, playlist, blueprint] = await Promise.all([
		pShowStyle,
		Studios.findOneAsync(rundown.studioId),
		RundownPlaylists.findOneAsync(rundown.playlistId),
		pShowStyle.then(async (ss) => loadShowStyleBlueprint(ss)),
	])

	if (!studio) throw new Meteor.Error(404, `Studio "${rundown.studioId}" not found!`)
	if (!playlist) throw new Meteor.Error(404, `Playlist "${rundown.playlistId}" not found!`)

	return {
		rundown,
		showStyle,
		studio,
		playlist,
		blueprint: blueprint.blueprint,
	}
}

const partInstanceTimingDebounceFunctions = new Map<string, DebouncedFunction<[], void>>()

async function handlePartInstanceTimingEventInner(
	playlistId: RundownPlaylistId,
	partInstanceId: PartInstanceId
): Promise<void> {
	const span = profiler.startSpan('handlePartInstanceTimingEvent')
	try {
		const timestamp = getCurrentTime()

		const partInstance = await PartInstances.findOneAsync(partInstanceId)
		if (!partInstance) throw new Meteor.Error(404, `PartInstance "${partInstanceId}" not found!`)

		const rundown = await Rundowns.findOneAsync(partInstance.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Rundown "${partInstance.rundownId}" not found!`)

		const { studio, showStyle, playlist, blueprint } = await getBlueprintAndDependencies(rundown)

		if (playlist._id !== playlistId)
			throw new Meteor.Error(
				404,
				`PartInstance "${partInstanceId}" does not belong to RundownPlaylist "${playlistId}"!`
			)

		if (blueprint.onRundownTimingEvent) {
			// The the PartInstances(events) before and after the one we are processing
			const [previousPartInstance, nextPartInstance] = await Promise.all([
				PartInstances.findOneAsync(
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
				PartInstances.findOneAsync(
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

			try {
				const messages = await blueprint.onRundownTimingEvent(context)
				queueExternalMessages(rundown, messages)
			} catch (error) {
				logger.error(error)
			}
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
			Meteor.bindEnvironment(() => {
				handlePartInstanceTimingEventInner(playlistId, partInstanceId).catch((e) => {
					let msg = `Error in handlePartInstanceTimingEvent "${funcId}": "${e.toString()}"`
					if (e.stack) msg += '\n' + e.stack
					logger.error(msg)
					throw e
				})
			}),
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
