import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'

addMigrationSteps('1.1.0', [
	ensureCollectionProperty('CoreSystem', {}, 'serviceMessages', {})
])
