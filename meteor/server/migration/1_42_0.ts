import { addMigrationSteps } from './databaseMigration'
import { StudioRouteSet, StudioRouteType } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Studios } from '../collections'

// Release 42

export const addSteps = addMigrationSteps('1.42.0', [
	{
		id: 'Add new routeType property to routeSets where missing',
		canBeRunAutomatically: true,
		validate: async () => {
			return (
				(await Studios.countDocuments({
					routeSets: { $exists: false },
				})) > 0
			)
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})

			for (const studio of studios) {
				const routeSets = studio.routeSets

				Object.entries<StudioRouteSet>(routeSets).forEach(([routeSetId, routeSet]) => {
					routeSet.routes.forEach((route) => {
						if (!route.routeType) {
							route.routeType = StudioRouteType.REROUTE
						}
					})

					routeSets[routeSetId] = routeSet
				})

				await Studios.updateAsync(studio._id, { $set: { routeSets } })
			}
		},
	},
])
