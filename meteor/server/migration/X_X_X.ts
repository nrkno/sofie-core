import { literal, getCurrentTime } from '../../lib/lib'
import { ensureCollectionProperty } from './lib'
import { Rundowns } from '../../lib/collections/Rundowns'
import { RundownPlaylists, DBRundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundown as Rundown_1_0_0 } from './deprecatedDataTypes/1_0_1'
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
	{ // migrate from Rundowns to RundownPlaylists
		id: 'convert Rundowns to RundownPlaylists',
		canBeRunAutomatically: true,
		validate: () => {
			let validate: boolean | string = false
			let count = Rundowns.find({
				$or: [{
					playlistId: {
						$exists: false
					}
				}, {
					playlistId: ''
				}]
			}).count()
			if (count > 0) {
				validate = `Orphaned rundowns: ${count}`
			}

			return validate
		},
		migrate: () => {
			Rundowns.find({
				$or: [{
					playlistId: {
						$exists: false
					}
				}, {
					playlistId: ''
				}]
			}).forEach((rundown) => {
				const r = rundown as any as Rundown_1_0_0
				const playlistId = Random.id()
				RundownPlaylists.insert(literal<DBRundownPlaylist>({
					_id: playlistId,
					externalId: r.externalId,
					active: r.active,
					rehearsal: r.rehearsal,
					created: r.created,
					currentPartId: r.currentPartId,
					nextPartId: r.nextPartId,
					expectedDuration: r.expectedDuration,
					expectedStart: r.expectedStart,
					holdState: r.holdState,
					name: r.name,
					nextPartManual: r.nextPartManual,
					nextTimeOffset: r.nextTimeOffset,
					peripheralDeviceId: r.peripheralDeviceId,
					previousPartId: r.previousPartId,
					startedPlayback: r.startedPlayback,
					studioId: r.studioId,
					modified: getCurrentTime()
				}))
				Rundowns.update(rundown._id, {
					$set: {
						playlistId,
						_rank: 1
					}
				})
			})
		}
	},
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),
])
