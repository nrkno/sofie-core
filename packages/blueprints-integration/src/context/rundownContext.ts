import type { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type { TSR } from '../timeline'
import type { IBlueprintSegmentRundown } from '../documents'
import type { IUserNotesContext } from './baseContext'
import type { IPackageInfoContext } from './packageInfoContext'
import type { IShowStyleContext } from './showStyleContext'
import type { IBlueprintPlayoutDevice } from '../lib'

export interface IRundownContext extends IShowStyleContext {
	readonly rundownId: string
	readonly playlistId: string
	readonly rundown: Readonly<IBlueprintSegmentRundown>
}

export interface IRundownUserContext extends IUserNotesContext, IRundownContext {}

export interface IRundownActivationContext extends IRundownContext {
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
}

export interface ISegmentUserContext extends IUserNotesContext, IRundownContext, IPackageInfoContext {
	/** Display a notification to the user of an error */
	notifyUserError: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of an warning */
	notifyUserWarning: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
	/** Display a notification to the user of a note */
	notifyUserInfo: (message: string, params?: { [key: string]: any }, partExternalId?: string) => void
}
