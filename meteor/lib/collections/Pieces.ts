import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PieceId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
export * from '@sofie-automation/corelib/dist/dataModel/Piece'

export const Pieces = createMongoCollection<Piece>(CollectionName.Pieces)

registerIndex(Pieces, {
	startRundownId: 1,
	startSegmentId: 1,
	startPartId: 1,
})

registerIndex(Pieces, {
	startRundownId: 1,
	startPartId: 1,
})
