import { addMigrationSteps } from './databaseMigration'
import { removeCollectionProperty } from './lib'

// Release 36
export const addSteps = addMigrationSteps('1.36.0', [
	removeCollectionProperty('PeripheralDevices', {}, 'expectedVersion'),
])
