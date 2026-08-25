import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { addMigrationSteps } from './databaseMigration'
import { ShowStyleBases } from '../collections'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

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

	{
		id: 'Add branding to ShowStyleBase',
		canBeRunAutomatically: true,
		validate: async () => {
			console.log('Validating ShowStyleBases for branding')
			const count = await ShowStyleBases.countDocuments({
				branding: { $exists: false },
			})
			if (count > 0) return `There are ${count} ShowStyleBases without branding`
			return false
		},
		migrate: async () => {
			await ShowStyleBases.mutableCollection.updateAsync(
				{
					branding: { $exists: false },
				},
				{
					$set: {
						branding: wrapDefaultObject({}),
					},
				},
				{ multi: true }
			)
		},
	},
])
