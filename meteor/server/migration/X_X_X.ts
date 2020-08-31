import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import { Studios } from '../../lib/collections/Studios'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */
// Release X
addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	//                     ^--- To be set to an absolute version number when doing the release
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
		id: 'Add new routeSets property to studio where missing',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				Studios.find({
					routeSets: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			Studios.find({
				routeSets: { $exists: false },
			}).forEach((studio) => {
				Studios.update(studio._id, { $set: { routeSets: {} } })
			})
		},
	},
])
