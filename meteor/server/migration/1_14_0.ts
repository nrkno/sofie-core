import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../../lib/collections/Studios'
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
// Release 26
export const addSteps = addMigrationSteps('1.14.0', [
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.12.0'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.6.0'),
	{
		id: 'Add Route Set Exclusivity Groups',
		canBeRunAutomatically: true,
		validate: () => {
			const badCount = Studios.find({
				routeSetExclusivityGroups: {
					$exists: false,
				},
			}).count()
			if (badCount > 0) {
				return `${badCount} studio need to be updated`
			}
			return false
		},
		migrate: () => {
			Studios.update(
				{
					routeSetExclusivityGroups: {
						$exists: false,
					},
				},
				{
					$set: {
						routeSetExclusivityGroups: {},
					},
				}
			)
		},
	},
])
