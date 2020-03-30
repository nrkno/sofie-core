import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
*/
// x.x.x (Release X)
addMigrationSteps(CURRENT_SYSTEM_VERSION, [ // <--- To be set to an absolute version number when doing the release
	// add steps here:
	{
		id: 'no media scanner',
		canBeRunAutomatically: true,
		validate: () => {
			return false
		},
		migrate: () => {
			//
		}
	},
])
