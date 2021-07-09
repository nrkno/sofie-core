import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
export * from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'

export const AdLibPieces = createMongoCollection<AdLibPiece, AdLibPiece>('adLibPieces')
registerCollection('AdLibPieces', AdLibPieces)

registerIndex(AdLibPieces, {
	rundownId: 1,
	partId: 1,
	_rank: 1,
})
