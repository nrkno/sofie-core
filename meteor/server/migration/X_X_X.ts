import { getCurrentTime, protectString, getRandomId } from '../../lib/lib'
import { Rundowns } from '../../lib/collections/Rundowns'
import { RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { makePlaylistFromRundown_1_0_0 } from './deprecatedDataTypes/1_0_1'
import { Random } from 'meteor/random'
import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'

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
<<<<<<< HEAD
	{
		id: 'no media scanner',
		canBeRunAutomatically: true,
		validate: () => {
			return false
		},
		migrate: () => {
			//
		}
	},
=======
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
>>>>>>> master
])
