import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { createMongoCollection } from './lib'
export { WorkerId }

export const WorkerThreadStatuses = createMongoCollection<WorkerThreadStatus>(CollectionName.WorkerThreads)
