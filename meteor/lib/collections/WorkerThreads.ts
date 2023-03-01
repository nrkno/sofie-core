import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { createMongoCollection } from './lib'

export const WorkerThreadStatuses = createMongoCollection<WorkerThreadStatus>(CollectionName.WorkerThreads)
