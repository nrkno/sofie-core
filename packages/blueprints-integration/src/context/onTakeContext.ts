import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { IBlueprintPlayoutDevice, IEventContext, IShowStyleUserContext, TSR, Time } from '..'
import { IPartAndPieceActionContext } from './partsAndPieceActionContext'

/**
 * Context in which 'current' is the partInstance we're leaving, and 'next' is the partInstance we're taking
 */
export interface IOnTakeContext extends IPartAndPieceActionContext, IShowStyleUserContext, IEventContext {
	/** Inform core that a take out of the taken partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>
	/**
	 * Prevent the take.
	 * All modifications to the pieceInstances and partInstance done through this context will be persisted,
	 * but the next part will not be taken.
	 */
	abortTake(): void

	/** Misc actions */
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
}
