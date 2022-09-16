import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

// 1.1.0 (Release 13)
export const addSteps = addMigrationSteps('1.1.0', [
	// add steps here:
	// {
	// 	id: 'my fancy step',
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		return false
	// 	},
	// 	migrate: () => {
	// 		//
	// 	}
	// },

	ensureCollectionProperty(CollectionName.CoreSystem, {}, 'serviceMessages', {}),
])
