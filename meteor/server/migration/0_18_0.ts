import {
	ensureDeviceVersion
} from './lib'
import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

// 0.18.0: Release 4
addMigrationSteps( '0.18.0', [
	ensureDeviceVersion('ensureVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '0.13.0'),
	ensureDeviceVersion('ensureVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOSDEVICE, '_process', '0.4.2'),
])
