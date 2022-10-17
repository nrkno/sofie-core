import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBTriggeredActions } from '../collections/TriggeredActions'

export interface NewTriggeredActionsAPI {
	createTriggeredActions(
		showStyleBaseId: ShowStyleBaseId | null,
		base?: Partial<Pick<DBTriggeredActions, '_rank' | 'triggersWithOverrides' | 'actionsWithOverrides' | 'name'>>
	): Promise<TriggeredActionId>
	removeTriggeredActions(id: TriggeredActionId): Promise<void>
}

export enum TriggeredActionsAPIMethods {
	'removeTriggeredActions' = 'triggeredActions.removeTriggeredActions',
	'createTriggeredActions' = 'triggeredActions.createTriggeredActions',
}
