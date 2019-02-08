import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { RunningOrders } from '../../lib/collections/RunningOrders'

// 0.22.0
addMigrationSteps( '0.22.0', [
	{ // Ensure rundowns have importVersions set
		id: 'runningOrders have importVersions',
		canBeRunAutomatically: true,
		validate: () => {
			const ros = RunningOrders.find({
				importVersions: { $exists: false }
			}).fetch()
			if (ros.length > 0) return 'Running orders need to be migrated to have importVersions'
			return false
		},
		migrate: () => {
			RunningOrders.update({
				importVersions: { $exists: false }
			}, {
				$set: {
					importVersions: {
						studioInstallation: 0,
						showStyleBase: 0,
						showStyleVariant: 0,
						blueprint: 0,

						core: '0.0.0'
					}
				}
			}, {
				multi: true
			})
		}
	}

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
])
