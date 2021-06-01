import { AdLibPiece } from './AdLibPieces'
import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

export interface RundownBaselineAdLibItem extends AdLibPiece {}

export const RundownBaselineAdLibPieces = createMongoCollection<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(
	'rundownBaselineAdLibPieces'
)
registerCollection('RundownBaselineAdLibPieces', RundownBaselineAdLibPieces)
registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})
