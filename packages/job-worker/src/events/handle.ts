import { PartInstanceTimingsProps, RundownDataChangedProps } from '@sofie-automation/corelib/dist/worker/events'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { logger } from '../logging'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ReadonlyDeep } from 'type-fest'
import { RundownTimingEventContext } from '../blueprints/context'
import { IBlueprintExternalMessageQueueObj } from '@sofie-automation/blueprints-integration'
import { protectString, unDeepString } from '@sofie-automation/corelib/dist/protectedString'
import _ = require('underscore')
import { getRandomId, omit, removeNullyProperties } from '@sofie-automation/corelib/dist/lib'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { ICollection, MongoModifier } from '../db'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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
				await queueExternalMessages(context.directCollections.ExternalMessageQueue, rundown, playlist, messages)
			} catch (error) {
				logger.error(`Error in onRundownTimingEvent: ${error}`)
			}
		}
	} catch (e) {
		logger.error(`handlePartInstanceTimingEvent: ${e}`)
	}
}

export async function queueExternalMessages(
	// context: JobContext,
	collection: ICollection<ExternalMessageQueueObj>,
	rundown: ReadonlyDeep<DBRundown>,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	messages: Array<IBlueprintExternalMessageQueueObj>
): Promise<void> {
	await Promise.allSettled(
		_.compact(messages).map(async (message) => {
			try {
				// check the output:
				if (!message.type) throw new Error('attribute .type missing!')
				if (!message.receiver) throw new Error('attribute .receiver missing!')
				if (!message.message) throw new Error('attribute .message missing!')

				// Save the output into the message queue, for later processing:
				if (message._id) {
					// Overwrite an existing message
					const messageId: ExternalMessageQueueObjId = protectString(message._id)

					const existingMessage = await collection.findOne(messageId)
					if (!existingMessage) throw new Error(`ExternalMessage ${message._id} not found!`)
					if (existingMessage.studioId !== rundown.studioId)
						throw new Error(`ExternalMessage ${message._id} is not in the right studio!`)
					if (existingMessage.rundownId !== rundown._id)
						throw new Error(`ExternalMessage ${message._id} is not in the right rundown!`)

					if (!playlist.rehearsal) {
						const m: MongoModifier<ExternalMessageQueueObj> = {
							$set: {
								...omit(message, '_id'),
							},
						}
						if (message.queueForLaterReason === undefined) {
							m.$unset = {
								queueForLaterReason: 1,
							}
						}
						await collection.update(existingMessage._id, m)
						// trigger sending message handled by watching the collection
					}
				} else {
					const now = getCurrentTime()
					let message2: ExternalMessageQueueObj = {
						_id: getRandomId(),

						...omit(message, '_id'),

						studioId: unDeepString(rundown.studioId),
						rundownId: rundown._id,

						created: now,
						tryCount: 0,
						expires: now + 35 * 24 * 3600 * 1000, // 35 days
						manualRetry: false,
					}
					message2 = removeNullyProperties(message2)
					if (!playlist.rehearsal) {
						// Don't save the message when running rehearsals
						await collection.insertOne(message2)
						// trigger sending message handled by watching the collection
					}
				}
			} catch (e) {
				logger.error(`Failed to save ExternalMessage: ${e} (${JSON.stringify(message)})`)
			}
		})
	)
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
