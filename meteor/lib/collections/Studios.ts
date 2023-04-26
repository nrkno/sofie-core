import { omit, protectString, unprotectObject } from '../lib'
import * as _ from 'underscore'
import { LookaheadMode, ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageDB } from './ExpectedPackages'

import {
	ResultingMappingRoutes,
	DBStudio,
	MappingExt,
	StudioRouteType,
	MappingsExt,
	StudioRouteSet,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ReadonlyDeep } from 'type-fest'
export * from '@sofie-automation/corelib/dist/dataModel/Studio'
export { RoutedMappings } from '@sofie-automation/shared-lib/dist/core/model/Timeline'

export function getActiveRoutes(routeSets: ReadonlyDeep<Record<string, StudioRouteSet>>): ResultingMappingRoutes {
	const routes: ResultingMappingRoutes = {
		existing: {},
		inserted: [],
	}

	const exclusivityGroups: { [groupId: string]: true } = {}
	_.each(routeSets, (routeSet) => {
		if (routeSet.active) {
			let useRoute: boolean = true
			if (routeSet.exclusivityGroup) {
				// Fail-safe: To really make sure we're not using more than one route in the same exclusivity group:
				if (exclusivityGroups[routeSet.exclusivityGroup]) {
					useRoute = false
				}
				exclusivityGroups[routeSet.exclusivityGroup] = true
			}
			if (useRoute) {
				_.each(routeSet.routes, (routeMapping) => {
					if (routeMapping.outputMappedLayer) {
						if (routeMapping.mappedLayer) {
							// Route an existing layer
							if (!routes.existing[routeMapping.mappedLayer]) {
								routes.existing[routeMapping.mappedLayer] = []
							}
							routes.existing[routeMapping.mappedLayer].push(omit(routeMapping, 'mappedLayer'))
						} else {
							// Insert a new routed layer
							routes.inserted.push(omit(routeMapping, 'mappedLayer'))
						}
					}
				})
			}
		}
	})

	return routes
}
export function getRoutedMappings<M extends MappingExt>(
	inputMappings: { [layerName: string]: M },
	mappingRoutes: ResultingMappingRoutes
): { [layerName: string]: M } {
	const outputMappings: { [layerName: string]: M } = {}

	// Re-route existing layers:
	for (const inputLayer of Object.keys(inputMappings)) {
		const inputMapping: M = inputMappings[inputLayer]

		const routes = mappingRoutes.existing[inputLayer]
		if (routes) {
			for (const route of routes) {
				const routedMapping: M =
					route.routeType === StudioRouteType.REMAP &&
					route.deviceType &&
					route.remapping &&
					route.remapping.deviceId
						? ({
								...route.remapping,
								lookahead: route.remapping.lookahead ?? LookaheadMode.NONE,
								device: route.deviceType,
								deviceId: protectString<any>(route.remapping.deviceId),
						  } as M)
						: {
								...inputMapping,
								...(route.remapping || {}),
						  }
				outputMappings[route.outputMappedLayer] = routedMapping
			}
		} else {
			// If no route is found at all for a mapping, pass the mapping through un-modified for backwards compatibility.
			outputMappings[inputLayer] = inputMapping
		}
	}
	// also insert new routed layers:
	for (const route of mappingRoutes.inserted) {
		if (route.remapping && route.deviceType && route.remapping.deviceId) {
			const routedMapping: MappingExt = {
				lookahead: route.remapping.lookahead || LookaheadMode.NONE,
				device: route.deviceType,
				deviceId: protectString<any>(route.remapping.deviceId),
				...route.remapping,
			}
			outputMappings[route.outputMappedLayer] = routedMapping as M
		}
	}
	return outputMappings
}

export type MappingsExtWithPackage = {
	[layerName: string]: MappingExt & { expectedPackages: (ExpectedPackage.Base & { rundownId?: string })[] }
}
export function routeExpectedPackages(
	studio: ReadonlyDeep<Pick<Studio, 'routeSets'>>,
	studioMappings: ReadonlyDeep<MappingsExt>,
	expectedPackages: (ExpectedPackageDB | ExpectedPackage.Base)[]
): MappingsExtWithPackage {
	// Map the expectedPackages onto their specified layer:
	const mappingsWithPackages: MappingsExtWithPackage = {}
	for (const expectedPackage of expectedPackages) {
		for (const layerName of expectedPackage.layers) {
			const mapping = studioMappings[layerName]

			if (mapping) {
				if (!mappingsWithPackages[layerName]) {
					mappingsWithPackages[layerName] = {
						...mapping,
						expectedPackages: [],
					}
				}
				mappingsWithPackages[layerName].expectedPackages.push(unprotectObject(expectedPackage))
			}
		}
	}

	// Route the mappings
	const routes = getActiveRoutes(studio.routeSets)
	return getRoutedMappings(mappingsWithPackages, routes)
}

export type Studio = DBStudio
