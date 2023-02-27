import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
export * from '@sofie-automation/corelib/dist/dataModel/Part'

/** Note: Use Part instead */
export type Part = DBPart

export const Parts = createMongoCollection<Part>(CollectionName.Parts)

registerIndex(Parts, {
	rundownId: 1,
	segmentId: 1,
	_rank: 1,
})
registerIndex(Parts, {
	rundownId: 1,
	_rank: 1,
})
