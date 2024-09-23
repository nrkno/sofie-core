import { addMigrationSteps } from './databaseMigration'
import { StudioRouteSet, StudioRouteType } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Studios } from '../collections'

// Release 42

export const addSteps = addMigrationSteps('1.42.0', [
	{
		id: 'Add new routeType property to routeSets where missing',
		canBeRunAutomatically: true,
		validate: async () => {
			// If routeSets has been converted to ObjectWithOverrides,
			// it will have a defaults property, and shouln't be migrated
			if (
				(await Studios.countDocuments({
					routeSetsWithOverrides: { $exists: true },
				})) > 0
			) {
				return false
			}
			return (
				(await Studios.countDocuments({
					routeSets: { $exists: false },
				})) > 0
			)
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({})

			for (const studio of studios) {
				// If routeSets has been converted to ObjectWithOverrides,
				// it will have a defaults property, and shouln't be migrated
				if (studio.routeSetsWithOverrides) return

				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				const routeSets = studio.routeSets as any as Record<string, StudioRouteSet>
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
