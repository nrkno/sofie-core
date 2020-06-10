
import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { Studios } from '../../lib/collections/Studios'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'

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
	{
		id: 'Studios: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (Studios.findOne({
				organizationId: {$exists: false}
			})) return 'Studio without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			Studios.update({
				organizationId: { $exists: false }
			}, { $set: {
				organizationId: null
			}})
		}
	},
	{
		id: 'PeripheralDevices: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (PeripheralDevices.findOne({
				organizationId: {$exists: false}
			})) return 'PeripheralDevice without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			PeripheralDevices.update({
				organizationId: { $exists: false }
			}, { $set: {
				organizationId: null
			}})
		}
	},
	{
		id: 'ShowStyleBases: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (ShowStyleBases.findOne({
				organizationId: {$exists: false}
			})) return 'ShowStyleBase without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			ShowStyleBases.update({
				organizationId: { $exists: false }
			}, { $set: {
				organizationId: null
			}})
		}
	},
	//
	//
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),
])
