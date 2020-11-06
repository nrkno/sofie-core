import { AdLibPiece } from './AdLibPieces'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

export interface RundownBaselineAdLibItem extends AdLibPiece {}

export const RundownBaselineAdLibPieces: TransformedCollection<
	RundownBaselineAdLibItem,
	RundownBaselineAdLibItem
> = createMongoCollection<RundownBaselineAdLibItem>('rundownBaselineAdLibPieces')
registerCollection('RundownBaselineAdLibPieces', RundownBaselineAdLibPieces)
registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})
