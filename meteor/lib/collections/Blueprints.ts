import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
export { Blueprint }

export const Blueprints = createMongoCollection<Blueprint>(CollectionName.Blueprints)

registerIndex(Blueprints, {
	organizationId: 1,
})
