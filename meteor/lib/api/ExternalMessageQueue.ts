import { ExternalMessageQueueObjId } from '../collections/ExternalMessageQueue'

export interface NewExternalMessageQueueAPI {
	remove (messageId: ExternalMessageQueueObjId): Promise<void>
	toggleHold (messageId: ExternalMessageQueueObjId): Promise<void>
	retry (messageId: ExternalMessageQueueObjId): Promise<void>
	setRunMessageQueue (value: boolean): Promise<void>
}

export enum ExternalMessageQueueAPIMethods {
	'remove' 				= 'externalMessages.remove',
	'toggleHold' 			= 'externalMessages.toggleHold',
	'retry' = 'externalMessages.retry',
	'setRunMessageQueue' 	= 'externalMessages.setRunMessageQueue',
}
