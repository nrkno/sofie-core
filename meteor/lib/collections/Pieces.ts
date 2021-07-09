import { RundownAPI } from '../api/rundown'
import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { PieceId }

import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
export * from '@sofie-automation/corelib/dist/dataModel/Piece'

export const Pieces = createMongoCollection<Piece, Piece>('pieces')
registerCollection('Pieces', Pieces)

registerIndex(Pieces, {
	startRundownId: 1,
	startSegmentId: 1,
	startPartId: 1,
})
