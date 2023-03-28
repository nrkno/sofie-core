import { addMigrationSteps } from './databaseMigration'
import { StudioRouteType } from '../../lib/collections/Studios'
import { Studios } from '../collections'

export const addSteps = addMigrationSteps('1.42.0', [
	// Add some migrations!

	{
		id: 'Add new routeType property to routeSets where missing',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				Studios.find({
					routeSets: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			Studios.find({}).forEach((studio) => {
				const routeSets = studio.routeSets

				Object.entries(routeSets).forEach(([routeSetId, routeSet]) => {
					routeSet.routes.forEach((route) => {
						if (!route.routeType) {
							route.routeType = StudioRouteType.REROUTE
						}
					})

					routeSets[routeSetId] = routeSet
				})

				Studios.update(studio._id, { $set: { routeSets } })
			})
		},
	},
])
