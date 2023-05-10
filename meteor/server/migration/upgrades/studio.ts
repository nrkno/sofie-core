import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { BlueprintValidateConfigForStudioResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'
import { Studio } from '../../../lib/collections/Studios'
import { profiler } from '../../api/profiler'
import { Studios } from '../../collections'
import { logger } from '../../logging'
import { QueueStudioJob } from '../../worker/worker'

export async function validateConfigForStudio(studioId: StudioId): Promise<BlueprintValidateConfigForStudioResult> {
	const studio = (await Studios.findOneAsync(studioId, {
		fields: {
			_id: 1,
		},
	})) as Pick<Studio, '_id'> | undefined
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintValidateConfigForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}

export async function runUpgradeForStudio(studioId: StudioId): Promise<void> {
	logger.info(`Running upgrade for Studio "${studioId}"`)
	const studio = (await Studios.findOneAsync(studioId, {
		fields: {
			_id: 1,
		},
	})) as Pick<Studio, '_id'> | undefined
	if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)

	const queuedJob = await QueueStudioJob(StudioJobs.BlueprintUpgradeForStudio, studioId, undefined)

	const span = profiler.startSpan('queued-job')
	try {
		const res = await queuedJob.complete
		// explicitly await before returning
		return res
	} finally {
		span?.end()
	}
}
