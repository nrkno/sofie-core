import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExecutableAction, ReactivePlaylistActionContext } from '../../../lib/api/triggers/actionFactory'
import { DeviceActionId } from '../../../lib/api/triggers/MountedTriggers'

class GlobalTriggerManagerClass {
	private allDeviceActions = new Map<DeviceActionId, ExecutableAction>()
	private currentStudioContexts = new Map<StudioId, ReactivePlaylistActionContext>()

	setAction(actionId: DeviceActionId, action: ExecutableAction) {
		this.allDeviceActions.set(actionId, action)
	}

	deleteAction(actionId: DeviceActionId) {
		this.allDeviceActions.delete(actionId)
	}

	getAction(actionId: DeviceActionId): ExecutableAction | undefined {
		return this.allDeviceActions.get(actionId)
	}

	setStudioContext(studioId: StudioId, context: ReactivePlaylistActionContext) {
		this.currentStudioContexts.set(studioId, context)
	}

	deleteStudioContext(studioId: StudioId) {
		this.currentStudioContexts.delete(studioId)
	}

	getStudioContext(studioId: StudioId): ReactivePlaylistActionContext | undefined {
		return this.currentStudioContexts.get(studioId)
	}
}

export const GlobalTriggerManager = new GlobalTriggerManagerClass()
