import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { RundownPlaylistId, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundowns } from '../../lib/collections/Rundowns'
import { getCurrentTime, getRandomId, protectString } from '../../lib/lib'
import { addMigrationSteps } from './databaseMigration'
import { makePlaylistFromRundown_1_0_0 } from './deprecatedDataTypes/1_0_1'
import { setExpectedVersion } from './lib'

// 1.7.0 (Release 19)
addMigrationSteps('1.7.0', [
	{
		// migrate from Rundowns to RundownPlaylists
		id: 'convert Rundowns to RundownPlaylists',
		canBeRunAutomatically: true,
		validate: () => {
			let validate: boolean | string = false
			let count = Rundowns.find({
				$or: [
					{
						playlistId: {
							$exists: false,
						},
					},
					{
						playlistId: protectString(''),
					},
				],
			}).count()
			if (count > 0) {
				validate = `Orphaned rundowns: ${count}`
			}

			return validate
		},
		migrate: () => {
			Rundowns.find({
				$or: [
					{
						playlistId: {
							$exists: false,
						},
					},
					{
						playlistId: protectString(''),
					},
				],
			}).forEach((rundown) => {
				const playlistId: RundownPlaylistId = getRandomId()
				const playlist = makePlaylistFromRundown_1_0_0(rundown, playlistId)
				playlist.modified = getCurrentTime()
				RundownPlaylists.insert(playlist)
				Rundowns.update(rundown._id, {
					$set: {
						playlistId,
						_rank: 1,
					},
				})
			})
		},
	},
	setExpectedVersion('expectedVersion.playoutDevice', PeripheralDeviceAPI.DeviceType.PLAYOUT, '_process', '^1.6.2'),
	setExpectedVersion('expectedVersion.mosDevice', PeripheralDeviceAPI.DeviceType.MOS, '_process', '^1.2.0'),
])
