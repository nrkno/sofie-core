import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import { setExpectedVersion, migrateConfigToBlueprintConfig } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { Studios, Studio } from '../../lib/collections/Studios'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import _ from 'underscore'

// Release 23
addMigrationSteps('1.11.0', [
	{
		id: 'Fix serviceMessages in CoreSystem',
		canBeRunAutomatically: true,
		validate: () => {
			const core = CoreSystem.findOne()
			if (core) {
				for (let [key, message] of Object.entries(core.serviceMessages)) {
					if (typeof message.timestamp === 'string') {
						return `Message "${message.message}" has string timestamp.`
					}
				}
				return false
			}
			return false
		},
		migrate: () => {
			const core = CoreSystem.findOne()
			const updateObj = {}
			if (core) {
				for (let [key, message] of Object.entries(core.serviceMessages)) {
					if (typeof message.timestamp !== 'number') {
						updateObj[`serviceMessages.${key}.timestamp`] = new Date(message.timestamp).getTime()
					}
				}
				CoreSystem.update(core._id, {
					$set: updateObj,
				})
			}
		},
	},
	migrateConfigToBlueprintConfig('Migrate config to blueprintConfig in Studios', Studios),
	migrateConfigToBlueprintConfig('Migrate config to blueprintConfig in ShowStyleBases', ShowStyleBases),
	migrateConfigToBlueprintConfig('Migrate config to blueprintConfig in ShowStyleVariants', ShowStyleVariants),
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.10.0'),
	// setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.4.3'),
])
