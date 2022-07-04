import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundowns } from '../../lib/collections/Rundowns'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	{
		id: 'Add new rundownIdsInOrder property to playlists where missing',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				RundownPlaylists.find({
					rundownIdsInOrder: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			RundownPlaylists.find({
				rundownIdsInOrder: { $exists: false },
			}).forEach((playlist) => {
				const rundowns = Rundowns.find(
					{
						playlistId: playlist._id,
					},
					{
						sort: {
							/* @ts-expect-error Field has been removed */
							_rank: 1,
							_id: 1,
						},
					}
				).fetch()

				RundownPlaylists.update(playlist._id, {
					$set: {
						rundownIdsInOrder: rundowns.map((rd) => rd._id),
					},
				})
			})
		},
	},
])
