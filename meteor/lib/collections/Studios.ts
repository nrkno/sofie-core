import { omit, unprotectObject } from '../lib'
import * as _ from 'underscore'
import { LookaheadMode, ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ExpectedPackageDB } from './ExpectedPackages'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { StudioId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import {
	ResultingMappingRoutes,
	DBStudio,
	MappingExt,
	MappingsHash,
	StudioLight,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
export * from '@sofie-automation/corelib/dist/dataModel/Studio'

export function getActiveRoutes(studio: StudioLight): ResultingMappingRoutes {
	const routes: ResultingMappingRoutes = {
		existing: {},
		inserted: [],
	}

	const exclusivityGroups: { [groupId: string]: true } = {}
	_.each(studio.routeSets, (routeSet) => {
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
				const routedMapping: M = {
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
				deviceId: route.remapping.deviceId,
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
	studio: Studio,
	expectedPackages: (ExpectedPackageDB | ExpectedPackage.Base)[]
): MappingsExtWithPackage {
	// Map the expectedPackages onto their specified layer:
	const mappingsWithPackages: MappingsExtWithPackage = {}
	for (const expectedPackage of expectedPackages) {
		for (const layerName of expectedPackage.layers) {
			const mapping = studio.mappings[layerName]

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
	const routes = getActiveRoutes(studio)
	return getRoutedMappings(mappingsWithPackages, routes)
}

export interface RoutedMappings {
	_id: StudioId
	mappingsHash: MappingsHash | undefined
	mappings: { [layerName: string]: MappingExt }
}

/** TODO: TransformedCollection */
export type Studio = DBStudio
export const Studios = createMongoCollection<Studio>(CollectionName.Studios)

registerIndex(Studios, {
	organizationId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(Studios, '_rundownVersionHash', ['blueprintConfig'])
	}
})
