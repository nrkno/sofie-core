import { addMigrationSteps } from './databaseMigration'

// Release 30 (2021-03-22)
export const addSteps = addMigrationSteps('1.18.0', [
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
	//
])
