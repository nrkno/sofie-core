import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
export * from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'

export const RundownBaselineAdLibPieces = createMongoCollection<RundownBaselineAdLibItem>(
	CollectionName.RundownBaselineAdLibPieces
)

registerIndex(RundownBaselineAdLibPieces, {
	rundownId: 1,
})
