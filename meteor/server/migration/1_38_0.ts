import { addMigrationSteps } from './databaseMigration'
import { getHash, protectString, unprotectString } from '../../lib/lib'
import { TriggeredActions } from '../collections'

// Release 38 (2022-01-27)
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
