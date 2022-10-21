import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'

// Release 31 (2021-05-05)
export const addSteps = addMigrationSteps('1.19.0', [
	ensureCollectionProperty(CollectionName.CoreSystem, {}, 'cron.casparCGRestart.enabled', true),
])
