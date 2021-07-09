import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * **************************************************************************************
 */
// Release 31
export const addSteps = addMigrationSteps('1.19.0', [
	ensureCollectionProperty(CollectionName.CoreSystem, {}, 'cron.casparCGRestart.enabled', true),
])
