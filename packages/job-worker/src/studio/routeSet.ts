import { SwitchRouteSetProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithStudioPlayoutModel } from './lock'

export async function handleSwitchRouteSet(context: JobContext, data: SwitchRouteSetProps): Promise<void> {
	await runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		studioPlayoutModel.switchRouteSet(data.routeSetId, data.state)
	})
}
