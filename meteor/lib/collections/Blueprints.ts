import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { BlueprintId }

import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
export * from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export const Blueprints = createMongoCollection<Blueprint, Blueprint>('blueprints')
registerCollection('Blueprints', Blueprints)

registerIndex(Blueprints, {
	organizationId: 1,
})
