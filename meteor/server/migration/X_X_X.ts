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
		id: 'Fix serviceMessages in CoreSystem',
		canBeRunAutomatically: true,
		validate: () => {
			const core = CoreSystem.findOne()
			if (core) {
				for (let [key, message] of Object.entries(core.serviceMessages)) {
					if (typeof message.timestamp === 'string') {
						return true
					}
				}
				return false
			}
			return false
		},
		migrate: () => {
			const core = CoreSystem.findOne()
			if (core) {
				for (let [key, message] of Object.entries(core.serviceMessages)) {
					if (typeof message.timestamp !== 'number') {
						core.serviceMessages[key] = {
							...message,
							timestamp: new Date(message.timestamp).getTime(),
						}
					}
				}
			}
		},
	},
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
