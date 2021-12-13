import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Parts } from '../../lib/collections/Parts'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'
import { getHash } from '../../lib/hash'
import { unprotectString, protectString } from '../../lib/lib'

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
export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
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
	{
		id: `Parts.expectedDurationWithPreroll`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Parts.find({
				expectedDurationWithPreroll: {
					$exists: false,
				},
			}).count()
			if (objects > 0) {
				return `timing is expectedDurationWithPreroll on ${objects} objects`
			}
			return false
		},
		migrate: () => {
			const objects = Parts.find({
				expectedDurationWithPreroll: {
					$exists: false,
				},
			}).fetch()
			for (const obj of objects) {
				Parts.update(obj._id, {
					$set: {
						expectedDurationWithPreroll: obj.expectedDuration,
					},
				})
			}
		},
	},
])
