import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
export * from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'

export const RundownBaselineAdLibPieces = createMongoCollection<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(
	'rundownBaselineAdLibPieces'
)
registerCollection('RundownBaselineAdLibPieces', RundownBaselineAdLibPieces)
registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})
