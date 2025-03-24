import { addMigrationSteps } from './databaseMigration.js'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion.js'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add your migration here
])
