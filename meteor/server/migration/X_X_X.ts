import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../collections'
import { convertObjectIntoOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioPackageContainer,
} from '@sofie-automation/corelib/dist/dataModel/Studio'

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
	// Add your migration here

	{
		id: `convert routesets to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSets: { $exists: true },
				routeSetsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSets is not typed as ObjectWithOverrides
				if (studio.routeSets) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSets: { $exists: true },
				routeSetsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSets is typed as Record<string, StudioRouteSet>
				const oldRouteSets = studio.routeSets

				const newRouteSets = convertObjectIntoOverrides<StudioRouteSet>(oldRouteSets || {})

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSets,
					},
					$unset: {
						routeSets: 1,
					},
				})
			}
		},
	},
	{
		id: `add abPlayers object`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				const routeSetsDefaults = studio.routeSetsWithOverrides.defaults as any as Record<
					string,
					StudioRouteSet
				>
				for (const key of Object.keys(routeSetsDefaults)) {
					if (!routeSetsDefaults[key].abPlayers) {
						return 'AB players must be added to routeSetsWithOverrides'
					}
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({ routeSetsWithOverrides: { $exists: true } })

			for (const studio of studios) {
				const newRouteSetswithOverrides = studio.routeSetsWithOverrides
				for (const key of Object.keys(newRouteSetswithOverrides.defaults)) {
					if (!newRouteSetswithOverrides.defaults[key].abPlayers) {
						newRouteSetswithOverrides.defaults[key].abPlayers = []
					}
				}

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetsWithOverrides: newRouteSetswithOverrides,
					},
				})
			}
		},
	},
	{
		id: `convert routeSetExclusivityGroups to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSetExclusivityGroups: { $exists: true },
				routeSetExclusivityGroupsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSetExclusivityGroups is not typed as ObjectWithOverrides
				if (studio.routeSetExclusivityGroups) {
					return 'routesets must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				routeSetExclusivityGroups: { $exists: true },
				routeSetExclusivityGroupsWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				//@ts-expect-error routeSets is typed as Record<string, StudioRouteSetExclusivityGroup>
				const oldRouteSetExclusivityGroups = studio.routeSetExclusivityGroups

				const newRouteSetExclusivityGroups = convertObjectIntoOverrides<StudioRouteSetExclusivityGroup>(
					oldRouteSetExclusivityGroups || {}
				)

				await Studios.updateAsync(studio._id, {
					$set: {
						routeSetExclusivityGroupsWithOverrides: newRouteSetExclusivityGroups,
					},
					$unset: {
						routeSetExclusivityGroups: 1,
					},
				})
			}
		},
	},
	{
		id: `convert packageContainers to ObjectWithOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				packageContainers: { $exists: true },
				packageContainersWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				// @ts-expect-error packageContainers is typed as Record<string, StudioPackageContainer>
				if (studio.packageContainers) {
					return 'packageContainers must be converted to an ObjectWithOverrides'
				}
			}

			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				packageContainers: { $exists: true },
				packageContainersWithOverrides: { $exists: false },
			})

			for (const studio of studios) {
				// @ts-expect-error packageContainers is typed as Record<string, StudioPackageContainer>
				const oldPackageContainers = studio.packageContainers

				const newPackageContainers = convertObjectIntoOverrides<StudioPackageContainer>(
					oldPackageContainers || {}
				)

				await Studios.updateAsync(studio._id, {
					$set: {
						packageContainersWithOverrides: newPackageContainers,
					},
					$unset: {
						packageContainers: 1,
					},
				})
			}
		},
	},
])
