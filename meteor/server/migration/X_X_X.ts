import { literal } from '../../lib/lib'
import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { PeripheralDevices, MediaManagerDevice } from '../../lib/collections/PeripheralDevices'
import { MediaManagerDeviceSettings, MonitorSettingsType, MonitorSettingsWatcher } from '../../lib/collections/PeripheralDeviceSettings/mediaManager'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
*/
// x.x.x (Release X)
addMigrationSteps(CURRENT_SYSTEM_VERSION, [ // <--- To be set to an absolute version number when doing the release
	{
		id: 'migrateScannersToWatchers',
		canBeRunAutomatically: true,
		validate: () => {
			const devices = PeripheralDevices.find({}).fetch()
			let monitors = devices.filter(d => {
				d.settings && 
				d.type === PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER &&
				(d.settings as MediaManagerDeviceSettings).monitors &&
				(d.settings as MediaManagerDeviceSettings).monitors
			}).map(x => Object.values((x.settings as MediaManagerDeviceSettings).monitors || []))
			let scannerCount = 0
			for ( let mons of monitors ) {
				scannerCount += mons.filter(m => m.type === MonitorSettingsType.MEDIA_SCANNER).length
			}
			if (scannerCount > 0) {
				return `PeripheralDevices contains ${scannerCount} devices that need updating`
			}
			return false
		},
		migrate: () => {
			const devices = PeripheralDevices.find({}).fetch()
			let devWithMonitor = (devices.filter(d => {
				return d.settings && 
					d.type === PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER &&
					(d.settings as MediaManagerDeviceSettings).monitors &&
					(d.settings as MediaManagerDeviceSettings).monitors
			})) as MediaManagerDevice[]
			for ( let device of devWithMonitor ) {
				const monitors = device.settings!.monitors || {}
				let mons = Object.keys(monitors)
				for ( let m of mons ) {
					if (monitors[m].type === MonitorSettingsType.MEDIA_SCANNER) {
						let currentMon = monitors[m]
						monitors[m] = literal<MonitorSettingsWatcher>({
							type: MonitorSettingsType.WATCHER,
							storageId: currentMon.storageId,
							disable: currentMon.disable,
							scanner: {},
							retryLimit: 3
						})
					}
				}
				device.settings!.monitors = monitors
				PeripheralDevices.update(device._id, { $set: device })
			}
		}
	},
	setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.2.0'),
])
