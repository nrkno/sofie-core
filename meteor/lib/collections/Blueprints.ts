import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { BlueprintId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
export * from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export const Blueprints = createMongoCollection<Blueprint>(CollectionName.Blueprints)

registerIndex(Blueprints, {
	organizationId: 1,
})
