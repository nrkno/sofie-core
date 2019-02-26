import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Random } from 'meteor/random'

// 0.22.0
addMigrationSteps( '0.22.0', [
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
