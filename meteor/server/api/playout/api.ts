import { registerClassToMeteorMethods, MeteorDebugMethods } from '../../methods'
import { NewPlayoutAPI, PlayoutAPIMethods } from '../../../lib/api/playout'
import { ServerPlayoutAPI } from './playout'
import { getCurrentTime } from '../../../lib/lib'
import { logger } from '../../logging'
import { MethodContextAPI } from '../../../lib/api/methods'
import { QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { StudioContentWriteAccess } from '../../security/studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

class ServerPlayoutAPIClass extends MethodContextAPI implements NewPlayoutAPI {
	async updateStudioBaseline(studioId: StudioId): Promise<string | false> {
		await StudioContentWriteAccess.baseline(this, studioId)

		const res = await QueueStudioJob(StudioJobs.UpdateStudioBaseline, studioId, undefined)
		return res.complete
	}
	async shouldUpdateStudioBaseline(studioId: StudioId) {
		const access = await StudioContentWriteAccess.baseline(this, studioId)

		return ServerPlayoutAPI.shouldUpdateStudioBaseline(access)
	}
}
registerClassToMeteorMethods(PlayoutAPIMethods, ServerPlayoutAPIClass, false)

// Temporary methods
MeteorDebugMethods({
	debug__printTime: () => {
		const now = getCurrentTime()
		logger.debug(new Date(now))
		return now
	},
})
