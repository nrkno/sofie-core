import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PieceInstanceId, PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PieceInstanceId, PieceInstanceInfiniteId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
export * from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

export const PieceInstances = createMongoCollection<PieceInstance, PieceInstance>(CollectionName.PieceInstances)

registerIndex(PieceInstances, {
	rundownId: 1,
	partInstanceId: 1,
	reset: -1,
})
