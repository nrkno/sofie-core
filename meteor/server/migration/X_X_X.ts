import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Blueprints } from '../../lib/collections/Blueprints'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'

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
	// Add some migrations!

	{
		id: `Blueprints ensure blueprintHash is set`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Blueprints.find({ blueprintHash: { $exists: false } }).count()
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = Blueprints.find({ blueprintHash: { $exists: false } }).fetch()
			for (const obj of objects) {
				Blueprints.update(obj._id, {
					$set: {
						blueprintHash: getRandomId(),
					},
				})
			}
		},
	},

	// {
	// 	id: `Blueprints ensure blueprintHash is set`,
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		const objects = Blueprints.find({ blueprintHash: { $exists: false } }).count()
	// 		if (objects > 0) {
	// 			return `object needs to be converted`
	// 		}
	// 		return false
	// 	},
	// 	migrate: () => {
	// 		const objects = Blueprints.find({ blueprintHash: { $exists: false } }).fetch()
	// 		for (const obj of objects) {
	// 			Blueprints.update(obj._id, {
	// 				$set: {
	// 					blueprintHash: getRandomId(),
	// 				},
	// 			})
	// 		}
	// 	},
	// },
])
