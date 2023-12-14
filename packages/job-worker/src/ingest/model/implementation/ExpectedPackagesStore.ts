import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageDBBase } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import {
	ExpectedMediaItemId,
	ExpectedPackageId,
	ExpectedPlayoutItemId,
	PartId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { diffAndReturnLatestObjects } from './utils'

export class ExpectedPackagesStore<ExpectedPackageType extends ExpectedPackageDBBase> {
	#expectedMediaItems: ExpectedMediaItemRundown[]
	#expectedPlayoutItems: ExpectedPlayoutItemRundown[]
	#expectedPackages: ExpectedPackageType[]

	#expectedMediaItemsWithChanges = new Set<ExpectedMediaItemId>()
	#expectedPlayoutItemsWithChanges = new Set<ExpectedPlayoutItemId>()
	#expectedPackagesWithChanges = new Set<ExpectedPackageId>()

	get expectedMediaItems(): ReadonlyDeep<ExpectedMediaItemRundown[]> {
		return this.#expectedMediaItems
	}
	get expectedPlayoutItems(): ReadonlyDeep<ExpectedPlayoutItemRundown[]> {
		return this.#expectedPlayoutItems
	}
	get expectedPackages(): ReadonlyDeep<ExpectedPackageType[]> {
		// Typescript is not happy with turning ExpectedPackageType into ReadonlyDeep because it can be a union
		return this.#expectedPackages as any[]
	}

	#rundownId: RundownId
	#segmentId: SegmentId | undefined
	#partId: PartId | undefined

	constructor(
		rundownId: RundownId,
		segmentId: SegmentId | undefined,
		partId: PartId | undefined,
		expectedMediaItems: ExpectedMediaItemRundown[],
		expectedPlayoutItems: ExpectedPlayoutItemRundown[],
		expectedPackages: ExpectedPackageType[]
	) {
		this.#rundownId = rundownId
		this.#segmentId = segmentId
		this.#partId = partId

		this.#expectedMediaItems = expectedMediaItems
		this.#expectedPlayoutItems = expectedPlayoutItems
		this.#expectedPackages = expectedPackages
	}

	setOwnerIds(rundownId: RundownId, segmentId: SegmentId | undefined, partId: PartId | undefined): void {
		this.#rundownId = rundownId
		this.#segmentId = segmentId
		this.#partId = partId

		// for (const expectedPlayoutItem of this.#expectedPlayoutItems) {
		// if (this.#expectedPlayoutItemsWithChanges.has(expectedPlayoutItem._id))
		// }

		// nocommit TODO
	}

	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void {
		const newExpectedPlayoutItems: ExpectedPlayoutItemRundown[] = expectedPlayoutItems.map((item) => ({
			...item,
			partId: this.#partId,
			rundownId: this.#rundownId,
		}))

		this.#expectedPlayoutItems = diffAndReturnLatestObjects(
			this.#expectedPlayoutItemsWithChanges,
			this.#expectedPlayoutItems,
			newExpectedPlayoutItems
		)
	}
	setExpectedMediaItems(expectedMediaItems: ExpectedMediaItemRundown[]): void {
		const newExpectedMediaItems: ExpectedMediaItemRundown[] = expectedMediaItems.map((item) => ({
			...item,
			partId: this.#partId,
			rundownId: this.#rundownId,
		}))

		this.#expectedMediaItems = diffAndReturnLatestObjects(
			this.#expectedMediaItemsWithChanges,
			this.#expectedMediaItems,
			newExpectedMediaItems
		)
	}
	setExpectedPackages(expectedPackages: ExpectedPackageType[]): void {
		const newExpectedPackages: ExpectedPackageType[] = expectedPackages.map((pkg) => ({
			...pkg,
			partId: this.#partId,
			segmentId: this.#segmentId,
			rundownId: this.#rundownId,
		}))

		this.#expectedPackages = diffAndReturnLatestObjects(
			this.#expectedPackagesWithChanges,
			this.#expectedPackages,
			newExpectedPackages,
			(oldObj, newObj) => ({
				...newObj,
				// Retain the created property
				created: oldObj.created,
			})
		)
	}
}
