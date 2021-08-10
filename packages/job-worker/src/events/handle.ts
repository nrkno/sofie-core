import { PartInstanceTimingsProps, RundownDataChangedProps } from '@sofie-automation/corelib/dist/worker/events'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { RundownTimingEventContext } from '../blueprints/context'

async function getBlueprintAndDependencies(context: JobContext, rundown: ReadonlyDeep<DBRundown>) {
	const pShowStyle = context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)

	const [showStyle, playlist, blueprint] = await Promise.all([
		pShowStyle,
		context.directCollections.RundownPlaylists.findOne(rundown.playlistId),
		pShowStyle.then(async (ss) => context.getShowStyleBlueprint(ss._id)),
	])

	if (!playlist || playlist.studioId !== context.studioId)
		throw new Error(`Playlist "${rundown.playlistId}" not found!`)

	return {
		rundown,
		showStyle,
		playlist,
		blueprint: blueprint.blueprint,
	}
}

export async function handlePartInstanceTimings(context: JobContext, data: PartInstanceTimingsProps): Promise<void> {
	try {
		const timestamp = getCurrentTime()

		const partInstance = await context.directCollections.PartInstances.findOne(data.partInstanceId)
		if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)

		const rundown = await context.directCollections.Rundowns.findOne(partInstance.rundownId)
		if (!rundown || rundown.studioId !== context.studioId)
			throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

		const { showStyle, playlist, blueprint } = await getBlueprintAndDependencies(context, rundown)

		if (playlist._id !== data.playlistId)
			throw new Error(
				`PartInstance "${data.partInstanceId}" does not belong to RundownPlaylist "${data.playlistId}"!`
			)

		if (blueprint.onRundownTimingEvent) {
			// The the PartInstances(events) before and after the one we are processing
			const [previousPartInstance, nextPartInstance] = await Promise.all([
				context.directCollections.PartInstances.findOne(
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
				context.directCollections.PartInstances.findOne(
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

			const context2 = new RundownTimingEventContext(
				{
					name: rundown.name,
					identifier: `rundownId=${rundown._id},timestamp=${timestamp}`,
				},
				context.studio,
				context.getStudioBlueprintConfig(),
				showStyle,
				context.getShowStyleBlueprintConfig(showStyle),
				rundown,
				previousPartInstance,
				partInstance,
				nextPartInstance
			)

			try {
				const messages = await blueprint.onRundownTimingEvent(context2)
				queueExternalMessages(rundown, messages)
			} catch (error) {
				logger.error(error)
			}
		}
	} catch (e) {
		logger.error(`handlePartInstanceTimingEvent: ${e}`)
	}
}

export async function handleRundownDataHasChanged(_context: JobContext, _data: RundownDataChangedProps): Promise<void> {
	// TODO - implement
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
}
