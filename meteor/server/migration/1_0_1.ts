import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { Rundowns } from '../../lib/collections/Rundowns'
import { ensureCollectionProperty, setExpectedVersion } from './lib'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { RundownPlaylist, RundownPlaylists, DBRundownPlaylist } from '../../lib/collections/RundownPlaylists';
import { literal } from '../../lib/lib'
import { Random } from 'meteor/random'
import { Rundown as Rundown_1_0_0 } from './deprecatedDataTypes/1_0_1'

// 2.0.0 (Release 13)
addMigrationSteps('1.0.1', [
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
					studioId: r.studioId
				}))
				Rundowns.update(rundown._id, {
					$set: {
						playlistId
					}
				})
			})
		}
	},
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),
])
