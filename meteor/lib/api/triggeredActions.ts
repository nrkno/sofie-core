import { DBTriggeredActions, TriggeredActionId } from '../collections/TriggeredActions'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'

export interface NewTriggeredActionsAPI {
	createTriggeredActions(
		showStyleBaseId: ShowStyleBaseId,
		base?: Partial<Pick<DBTriggeredActions, 'triggers' | 'actions' | 'name'>>
	): Promise<TriggeredActionId>
	removeTriggeredActions(id: TriggeredActionId): Promise<void>
}

export enum TriggeredActionsAPIMethods {
	'removeTriggeredActions' = 'triggeredActions.removeTriggeredActions',
	'createTriggeredActions' = 'triggeredActions.createTriggeredActions',
}
