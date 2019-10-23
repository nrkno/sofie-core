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
addMigrationSteps('1.2.0', [
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
	{
		id: 'CoreSystem.storePath fix',
		// Fix a bug where CoreSystemPath is the string "undefined", ref (https://github.com/nrkno/tv-automation-server-core/pull/91)
		canBeRunAutomatically: true,
		validate: () => {
			let system = getCoreSystem()
			if (system && system.storePath === 'undefined') {
				return 'CoreSystem.storePath is "undefined"'
			}
			return false
		},
		migrate: () => {
			let system = getCoreSystem()
			if (system && system.storePath === 'undefined') {
				setCoreSystemStorePath(undefined)
			}
		}
	},
])
