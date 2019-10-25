import { addMigrationSteps } from './databaseMigration'
import { ensureCollectionProperty } from './lib'
import { getCoreSystem, setCoreSystemStorePath } from '../../lib/collections/CoreSystem'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when finalizing the release)
 *
 * **************************************************************************************
*/
// x.x.x (Release X)
addMigrationSteps('1.3.0', [
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
])
