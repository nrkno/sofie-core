import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../../lib/collections/Studios'
import { Timeline } from '../../lib/collections/Timeline'
import { getCoreSystem } from '../../lib/collections/CoreSystem'
import * as semver from 'semver'
import { getDeprecatedDatabases, dropDeprecatedDatabases } from './deprecatedDatabases/X_X_X'
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
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),

	{
		id: 'Drop Studio Recording config',
		canBeRunAutomatically: true,
		validate: () => {
			const badCount = Studios.find({
				'testToolsConfig.recording': { $exists: true },
			}).count()
			if (badCount > 0) {
				return `${badCount} studio need to be updated`
			}
			return false
		},
		migrate: () => {
			Studios.update(
				{
					'testToolsConfig.recording': { $exists: true },
				},
				{
					$unset: {
						'testToolsConfig.recording': 1,
					},
				}
			)
		},
	},
	{
		id: 'Drop removed collections',
		canBeRunAutomatically: true,
		validate: () => {
			let databaseSystem = getCoreSystem()

			// Only run this if version is under 0.25.0, in order to not create the deprecated databases
			if (databaseSystem && semver.satisfies(databaseSystem.version, '<1.12.0')) {
				// =======================================================   ^^^^^ TODO: change this, to Release 25 version
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
