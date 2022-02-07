import { addMigrationSteps } from './databaseMigration'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'
import { getHash, protectString, unprotectString } from '../../lib/lib'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */
// Release 38
export const addSteps = addMigrationSteps('1.38.0', [
	// Add some migrations!
	{
		id: `TriggeredActions.core.fixIds`,
		canBeRunAutomatically: true,
		validate: () => {
			const existingActions = TriggeredActions.find({ showStyleBaseId: null }).fetch()
			return existingActions.some((action) => !!unprotectString(action._id).match(/^core_/))
		},
		migrate: () => {
			const existingActions = TriggeredActions.find({ showStyleBaseId: null }).fetch()
			for (const action of existingActions) {
				const actionId = unprotectString(action._id)
				if (actionId.match(/^core_/) !== null) {
					TriggeredActions.remove(action._id)
					TriggeredActions.insert({
						...action,
						_id: protectString(getHash(actionId)),
					})
				}
			}
		},
	},
])
