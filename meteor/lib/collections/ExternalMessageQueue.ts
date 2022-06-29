import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ExternalMessageQueueObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export { ExternalMessageQueueObjId }
export * from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'

export const ExternalMessageQueue = createMongoCollection<ExternalMessageQueueObj>(CollectionName.ExternalMessageQueue)

registerIndex(ExternalMessageQueue, {
	studioId: 1,
	created: 1,
})
registerIndex(ExternalMessageQueue, {
	sent: 1,
	lastTry: 1,
})
registerIndex(ExternalMessageQueue, {
	studioId: 1,
	rundownId: 1,
})
