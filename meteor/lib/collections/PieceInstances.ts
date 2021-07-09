import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PieceInstanceId, PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PieceInstanceId, PieceInstanceInfiniteId }

import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
export * from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

export const PieceInstances = createMongoCollection<PieceInstance, PieceInstance>('pieceInstances')
registerCollection('PieceInstances', PieceInstances)

registerIndex(PieceInstances, {
	rundownId: 1,
	partInstanceId: 1,
	reset: -1,
})
