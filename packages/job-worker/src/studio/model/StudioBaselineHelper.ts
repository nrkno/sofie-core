import { JobContext } from '../../jobs'
import {
	ExpectedPackageDB,
	ExpectedPackageDBFromStudioBaselineObjects,
	ExpectedPackageDBType,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { saveIntoDb } from '../../db/changes'
import { StudioRouteBehavior, StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { logger } from '../../logging'
import {
	WrappedOverridableItemNormal,
	useOverrideOpHelperBackend,
	getAllCurrentItemsFromOverrides,
} from '@sofie-automation/corelib/dist/overrideOpHelper'
import { ObjectWithOverrides, SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

export class StudioBaselineHelper {
	readonly #context: JobContext

	#overridesRouteSetBuffer: ObjectWithOverrides<Record<string, StudioRouteSet>>
	#pendingExpectedPackages: ExpectedPackageDBFromStudioBaselineObjects[] | undefined
	#pendingExpectedPlayoutItems: ExpectedPlayoutItemStudio[] | undefined
	#routeSetChanged: boolean

	constructor(context: JobContext) {
		this.#context = context
		this.#overridesRouteSetBuffer = { ...context.studio.routeSetsWithOverrides } as ObjectWithOverrides<
			Record<string, StudioRouteSet>
		>
		this.#routeSetChanged = false
	}

	hasChanges(): boolean {
		return !!this.#pendingExpectedPackages || !!this.#pendingExpectedPlayoutItems || this.#routeSetChanged
	}

	setExpectedPackages(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void {
		this.#pendingExpectedPackages = packages
	}
	setExpectedPlayoutItems(playoutItems: ExpectedPlayoutItemStudio[]): void {
		this.#pendingExpectedPlayoutItems = playoutItems
	}

	async saveAllToDatabase(): Promise<void> {
		await Promise.all([
			this.#pendingExpectedPlayoutItems
				? saveIntoDb(
						this.#context,
						this.#context.directCollections.ExpectedPlayoutItems,
						{ studioId: this.#context.studioId, baseline: 'studio' },
						this.#pendingExpectedPlayoutItems
				  )
				: undefined,
			this.#pendingExpectedPackages
				? saveIntoDb<ExpectedPackageDB>(
						this.#context,
						this.#context.directCollections.ExpectedPackages,
						{
							studioId: this.#context.studioId,
							fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
						},
						this.#pendingExpectedPackages
				  )
				: undefined,
			this.#routeSetChanged
				? this.#context.directCollections.Studios.update(
						{
							_id: this.#context.studioId,
						},
						{
							$set: { 'routeSetsWithOverrides.overrides': this.#overridesRouteSetBuffer.overrides },
						}
				  )
				: undefined,
		])

		this.#pendingExpectedPlayoutItems = undefined
		this.#pendingExpectedPackages = undefined
		this.#routeSetChanged = false
		this.#overridesRouteSetBuffer = { ...this.#context.studio.routeSetsWithOverrides } as ObjectWithOverrides<
			Record<string, StudioRouteSet>
		>
	}

	updateRouteSetActive(routeSetId: string, isActive: boolean | 'toggle'): void {
		const studio = this.#context.studio
		const saveOverrides = (newOps: SomeObjectOverrideOp[]) => {
			// this.#overridesRouteSetBuffer = { defaults: this.#overridesRouteSetBuffer.defaults, overrides: newOps }
			this.#overridesRouteSetBuffer.overrides = newOps
			this.#routeSetChanged = true
		}
		const overrideHelper = useOverrideOpHelperBackend(saveOverrides, this.#overridesRouteSetBuffer)

		const routeSets: WrappedOverridableItemNormal<StudioRouteSet>[] = getAllCurrentItemsFromOverrides(
			this.#overridesRouteSetBuffer,
			null
		)

		const routeSet = routeSets.find((routeSet) => {
			return routeSet.id === routeSetId
		})

		if (routeSet === undefined) throw new Error(`RouteSet "${routeSetId}" not found!`)

		if (isActive === 'toggle') isActive = !routeSet.computed.active

		if (routeSet.computed?.behavior === StudioRouteBehavior.ACTIVATE_ONLY && isActive === false)
			throw new Error(`RouteSet "${routeSet.id}" is ACTIVATE_ONLY`)

		logger.debug(`switchRouteSet "${studio._id}" "${routeSet.id}"=${isActive}`)
		overrideHelper.setItemValue(routeSet.id, `active`, isActive).commit()

		// Deactivate other routeSets in the same exclusivity group:
		if (routeSet.computed.exclusivityGroup && isActive === true) {
			for (const [, otherRouteSet] of Object.entries<WrappedOverridableItemNormal<StudioRouteSet>>(routeSets)) {
				if (otherRouteSet.id === routeSet.id) continue
				if (otherRouteSet.computed?.exclusivityGroup === routeSet.computed.exclusivityGroup) {
					logger.debug(`switchRouteSet Other ID "${studio._id}" "${otherRouteSet.id}"=false`)
					overrideHelper.setItemValue(otherRouteSet.id, `active`, false).commit()
				}
			}
		}
	}
}
