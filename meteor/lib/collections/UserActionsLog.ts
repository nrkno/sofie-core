import { Time, registerCollection, TimeDuration } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { UserActionsLogItemId, OrganizationId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { UserActionsLogItemId }

export interface UserActionsLogItem {
	_id: UserActionsLogItemId

	organizationId: OrganizationId | null
	/** The user from which the action originated */
	userId: UserId | null
	/** The cliend address (IP-address) of the requester */
	clientAddress: string
	timestamp: Time
	method: string
	args: string
	context: string
	success?: boolean
	errorMessage?: string
	doneTime?: Time

	/** The time it took (within Core) to execute the action */
	executionTime?: TimeDuration
	/** The time it took for playout-gateway(s) to execute the timeline. */
	gatewayDuration?: TimeDuration[]
	/** The time playout-gateway(s) reported it took to resolve the timeline. */
	timelineResolveDuration?: TimeDuration[]
}

export const UserActionsLog = createMongoCollection<UserActionsLogItem, UserActionsLogItem>('userActionsLog')
registerCollection('UserActionsLog', UserActionsLog)

registerIndex(UserActionsLog, {
	organizationId: 1,
	timestamp: 1,
})
