import { addMigrationSteps } from './databaseMigration'
import { Studios } from '../../lib/collections/Studios'
import { getCoreSystem } from '../../lib/collections/CoreSystem'
import * as semver from 'semver'
import { getDeprecatedDatabases, dropDeprecatedDatabases } from './deprecatedDatabases/X_X_X'
import * as _ from 'underscore'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */
// Release 25
export const addSteps = addMigrationSteps('1.13.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.11.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.5.1'),
	setExpectedVersion(
		'expectedVersion.mediaManager',
		PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
		'_process',
		'^1.2.1'
	),

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
