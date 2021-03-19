import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { ensureCollectionProperty } from './lib'
import { getCoreSystem } from '../../lib/collections/CoreSystem'
import { dropDeprecatedDatabases, getDeprecatedDatabases } from './deprecatedDatabases/X_X_X'
import semver from 'semver'
import * as _ from 'underscore'

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
	//
	ensureCollectionProperty('CoreSystem', {}, 'cron.casparCGRestart.enabled', true),
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),

	{
		id: 'Drop removed collections r32',
		canBeRunAutomatically: true,
		validate: () => {
			let databaseSystem = getCoreSystem()

			// Only run this if version is under 1.13.0, in order to not create the deprecated databases
			if (databaseSystem && semver.satisfies(databaseSystem.version, '<1.13.0')) {
				const dbs = getDeprecatedDatabases()

				if (dbs) {
					let foundAnything: string | null = null
					_.find(_.keys(dbs), (collectionName) => {
						const collection = dbs[collectionName]
						if (collection.findOne()) {
							foundAnything = collectionName
							return true
						}
					})
					if (foundAnything) return `Deprecated collection "${foundAnything}" is not empty`
				}
			}
			return false
		},
		migrate: () => {
			const dbs = getDeprecatedDatabases()

			if (dbs) {
				dropDeprecatedDatabases()
			}
		},
	},
])
