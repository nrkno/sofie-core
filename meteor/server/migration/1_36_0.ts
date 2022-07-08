import { addMigrationSteps } from './databaseMigration'
import { removeCollectionProperty } from './lib'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

// Release 36 (Skipped)
export const addSteps = addMigrationSteps('1.36.0', [
	removeCollectionProperty(CollectionName.PeripheralDevices, {}, 'expectedVersion'),
])
