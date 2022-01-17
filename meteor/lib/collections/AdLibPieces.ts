import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export * from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'

export const AdLibPieces = createMongoCollection<AdLibPiece>(CollectionName.AdLibPieces)

registerIndex(AdLibPieces, {
	rundownId: 1,
	partId: 1,
	_rank: 1,
})
