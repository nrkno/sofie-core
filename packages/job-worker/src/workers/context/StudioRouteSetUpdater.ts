import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/blueprints-integration'
import type { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import {
	getAllCurrentItemsFromOverrides,
	OverrideOpHelperImpl,
	WrappedOverridableItemNormal,
} from '@sofie-automation/corelib/dist/overrideOpHelper'
import { logger } from '../../logging'
import type { ReadonlyDeep } from 'type-fest'
import type { WorkerDataCache } from '../caches'
import type { IDirectCollections } from '../../db'

export class StudioRouteSetUpdater {
	readonly #directCollections: Readonly<IDirectCollections>
	readonly #cacheData: Pick<WorkerDataCache, 'studio'>

	constructor(directCollections: Readonly<IDirectCollections>, cacheData: Pick<WorkerDataCache, 'studio'>) {
		this.#directCollections = directCollections
		this.#cacheData = cacheData
	}

	// Future: this could store a Map<string, boolean>, if the context exposed a simplified view of DBStudio
	#studioWithRouteSetChanges: ReadonlyDeep<DBStudio> | undefined = undefined

	get studioWithChanges(): ReadonlyDeep<DBStudio> | undefined {
		return this.#studioWithRouteSetChanges
	}

	setRouteSetActive(routeSetId: string, isActive: boolean | 'toggle'): boolean {
		const currentStudio = this.#studioWithRouteSetChanges ?? this.#cacheData.studio
		const currentRouteSets = getAllCurrentItemsFromOverrides(currentStudio.routeSetsWithOverrides, null)

		const routeSet = currentRouteSets.find((routeSet) => routeSet.id === routeSetId)
		if (!routeSet) throw new Error(`RouteSet "${routeSetId}" not found!`)

		if (isActive === 'toggle') {
			isActive = !routeSet.computed.active
		}

		if (routeSet.computed.behavior === StudioRouteBehavior.ACTIVATE_ONLY && !isActive)
			throw new Error(`RouteSet "${routeSet.id}" is ACTIVATE_ONLY`)

		const overrideHelper = new OverrideOpHelperImpl(null, currentStudio.routeSetsWithOverrides)

		// Update the pending changes
		logger.debug(`switchRouteSet "${this.#cacheData.studio._id}" "${routeSet.id}"=${isActive}`)
		overrideHelper.setItemValue(routeSetId, 'active', isActive)

		let mayAffectTimeline = couldRoutesetAffectTimelineGeneration(routeSet)

		// Deactivate other routeSets in the same exclusivity group:
		if (routeSet.computed.exclusivityGroup && isActive) {
			for (const otherRouteSet of Object.values<WrappedOverridableItemNormal<StudioRouteSet>>(currentRouteSets)) {
				if (otherRouteSet.id === routeSet.id) continue
				if (otherRouteSet.computed?.exclusivityGroup === routeSet.computed.exclusivityGroup) {
					logger.debug(`switchRouteSet Other ID "${this.#cacheData.studio._id}" "${otherRouteSet.id}"=false`)
					overrideHelper.setItemValue(otherRouteSet.id, 'active', false)

					mayAffectTimeline = mayAffectTimeline || couldRoutesetAffectTimelineGeneration(otherRouteSet)
				}
			}
		}

		const updatedOverrideOps = overrideHelper.getPendingOps()

		// Update the cached studio
		this.#studioWithRouteSetChanges = Object.freeze({
			...currentStudio,
			routeSetsWithOverrides: Object.freeze({
				...currentStudio.routeSetsWithOverrides,
				overrides: deepFreeze(updatedOverrideOps),
			}),
		})

		return mayAffectTimeline
	}

	async saveRouteSetChanges(): Promise<void> {
		if (!this.#studioWithRouteSetChanges) return

		// Save the changes to the database
		// This is technically a little bit of a race condition, if someone uses the config pages but no more so than the rest of the system
		await this.#directCollections.Studios.update(
			{
				_id: this.#cacheData.studio._id,
			},
			{
				$set: {
					'routeSetsWithOverrides.overrides':
						this.#studioWithRouteSetChanges.routeSetsWithOverrides.overrides,
				},
			}
		)

		// Pretend that the studio as reported by the database has changed, this will be fixed after this job by the ChangeStream firing
		this.#cacheData.studio = this.#studioWithRouteSetChanges
		this.#studioWithRouteSetChanges = undefined
	}

	discardRouteSetChanges(): void {
		// Discard any pending changes
		this.#studioWithRouteSetChanges = undefined
	}
}

function couldRoutesetAffectTimelineGeneration(routeSet: WrappedOverridableItemNormal<StudioRouteSet>): boolean {
	return routeSet.computed.abPlayers.length > 0
}
