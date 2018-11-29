import { Meteor } from 'meteor/meteor'
import {
	DeviceType as PlayoutDeviceType
} from 'timeline-state-resolver-types'
import { literal, getCurrentTime } from '../../lib/lib'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { logger } from '../logging'
import * as _ from 'underscore'
import { setMeteorMethods } from '../methods'

setMeteorMethods({
	'initDB': (really) => {

		if (!really) {
			return 'Do you really want to do this? You chould only do it when initializing a new database. Confirm with initDB(true).'
		}
		logger.info('initDB')
		Meteor.call('initDB_layers', really)

		PeripheralDevices.upsert('initDBPlayoutDeviceParent', {$set: literal<PeripheralDevice>({
			_id: 'initDBPlayoutDeviceParent',
			name: 'initDBPlayoutDeviceParent',
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			studioInstallationId: 'studio0',
			created: getCurrentTime(),
			status: {statusCode: PeripheralDeviceAPI.StatusCode.BAD},
			lastSeen: getCurrentTime(),
			lastConnected: getCurrentTime(),
			connected: false,
			connectionId: null,
			token: '',
			settings: {
				devices: {},
				mediaScanner: {
					host: '',
					port: 8000
				}
			}
		})})

		PeripheralDevices.find({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT
		}).forEach((pd) => {
			PeripheralDevices.update(pd._id, {$set: {
				'settings.devices.casparcg0': ((pd['settings'] || {})['devices'] || {})['casparcg0'] || {
					type: PlayoutDeviceType.CASPARCG,
					options: {
						host: '160.67.87.50',
						port: 5250,
						launcherHost: '160.67.87.50',
						launcherPort: 8005
					}
				},
				'settings.devices.casparcg1': ((pd['settings'] || {})['devices'] || {})['casparcg1'] || {
					type: PlayoutDeviceType.CASPARCG,
					options: {
						host: '',
						port: 5250,
						launcherHost: '',
						launcherPort: 8005
					}
				},
				'settings.devices.atem0': ((pd['settings'] || {})['devices'] || {})['atem0'] || {
					type: PlayoutDeviceType.ATEM,
					options: {
						host: '160.67.87.51',
						port: 9910
					}
				},
				'settings.devices.lawo0': ((pd['settings'] || {})['devices'] || {})['lawo0'] || {
					type: PlayoutDeviceType.LAWO,
					options: {
						host: '160.67.96.51',
						port: 9000,
						sourcesPath: 'Sapphire.Sources',
						rampMotorFunctionPath: '1.5.2'
					}
				},
				'settings.devices.abstract0': ((pd['settings'] || {})['devices'] || {})['abstract0'] || {
					type: PlayoutDeviceType.ABSTRACT,
					options: {
					}
				},
				'settings.devices.http0': ((pd['settings'] || {})['devices'] || {})['http0'] || {
					type: PlayoutDeviceType.HTTPSEND,
					options: {
					}
				},
				'settings.devices.hyperdeck0': ((pd['settings'] || {})['devices'] || {})['hyperdeck0'] || {
					type: PlayoutDeviceType.HYPERDECK,
					options: {
						host: '160.67.87.53',
						port: 9993
					}
				},
			}})
			// PeripheralDevices.update(pd._id, {$set: {
			// 	mappings: mappings
			// }})
		})
		_.each(((PeripheralDevices.findOne('initDBPlayoutDeviceParent') || {})['settings'] || {}).devices, (device, key) => {
			PeripheralDevices.upsert('initDBPlayoutDevice' + key, {$set: literal<PeripheralDevice>({
				_id: 'initDBPlayoutDevice' + key,
				name: 'initDBPlayoutDevice' + key,
				type: PeripheralDeviceAPI.DeviceType.OTHER,
				studioInstallationId: 'studio0',
				parentDeviceId: 'initDBPlayoutDeviceParent',
				created: getCurrentTime(),
				status: {statusCode: PeripheralDeviceAPI.StatusCode.BAD},
				lastSeen: getCurrentTime(),
				lastConnected: getCurrentTime(),
				connected: false,
				connectionId: null,
				token: ''
			})})
		})

		PeripheralDevices.upsert('initDBMosDeviceParent', {$set: literal<PeripheralDevice>({
			_id: 'initDBMosDeviceParent',
			name: 'initDBMosDeviceParent',
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,
			studioInstallationId: 'studio0',
			created: getCurrentTime(),
			status: {statusCode: PeripheralDeviceAPI.StatusCode.BAD},
			lastSeen: getCurrentTime(),
			lastConnected: getCurrentTime(),
			connected: false,
			connectionId: null,
			token: ''
		})})

		PeripheralDevices.find({
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE
		}).forEach((pd) => {
			PeripheralDevices.update(pd._id, {$set: {
				'settings.mosId': 'SOFIE1.XPRO.MOS',
				'settings.devices.enps0': ((pd['settings'] || {})['devices'] || {})['enps0'] || {
					primary: {
						id: 'MAENPSTEST14',
						host: '160.67.149.155'
					},
					secondary: {
						id: 'MAENPSTEST15',
						host: '160.67.149.156'
					}
				},
			}})
			// PeripheralDevices.update(pd._id, {$set: {
			// 	mappings: mappings
			// }})
		})
	}
})
