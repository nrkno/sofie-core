import { addMigrationSteps } from './databaseMigration'
import { RundownPlaylists, Rundowns } from '../collections'

export const addSteps = addMigrationSteps('1.44.0', [
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
