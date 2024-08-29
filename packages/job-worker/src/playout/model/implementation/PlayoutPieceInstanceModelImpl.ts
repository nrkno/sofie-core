import { ExpectedPackageId, PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { Time } from '@sofie-automation/blueprints-integration'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel'
import _ = require('underscore')
import { ExpectedPackageDBFromPieceInstance } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	DocumentChanges,
	getDocumentChanges,
	diffAndReturnLatestObjects,
} from '../../../ingest/model/implementation/utils'

export class PlayoutPieceInstanceModelImpl implements PlayoutPieceInstanceModel {
	/**
	 * The raw mutable PieceInstance
	 * Danger: This should not be modified externally, this is exposed for cloning and saving purposes
	 */
	PieceInstanceImpl: PieceInstance

	#expectedPackages: ExpectedPackageDBFromPieceInstance[]
	#expectedPackagesWithChanges = new Set<ExpectedPackageId>()

	/**
	 * Set/delete a value for this PieceInstance, and track that there are changes
	 * @param key Property key
	 * @param newValue Property value
	 */
	setPieceInstanceValue<T extends keyof PieceInstance>(key: T, newValue: PieceInstance[T]): void {
		if (newValue === undefined) {
			delete this.PieceInstanceImpl[key]
		} else {
			this.PieceInstanceImpl[key] = newValue
		}

		this.#hasChanges = true
	}

	/**
	 * Set/delete a value for this PieceInstance if the value has cahnged, and track that there are changes
	 * @param key Property key
	 * @param newValue Property value
	 * @param deepEqual Perform a deep equality check
	 */
	compareAndSetPieceInstanceValue<T extends keyof PieceInstance>(
		key: T,
		newValue: PieceInstance[T],
		deepEqual = false
	): boolean {
		const oldValue = this.PieceInstanceImpl[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.setPieceInstanceValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#hasChanges = false
	/**
	 * Whether this PieceInstance has unsaved changes
	 */
	get HasChanges(): boolean {
		// nocommit - should this be two properties?
		return this.#hasChanges || this.#expectedPackagesWithChanges.size > 0
	}

	/**
	 * Clear the `HasChanges` flag
	 */
	clearChangedFlag(): void {
		this.#hasChanges = false
		this.#expectedPackagesWithChanges.clear()
	}

	get pieceInstance(): ReadonlyDeep<PieceInstance> {
		return this.PieceInstanceImpl
	}

	get expectedPackages(): ReadonlyDeep<ExpectedPackageDBFromPieceInstance[]> {
		return [...this.#expectedPackages]
	}

	get expectedPackagesChanges(): DocumentChanges<ExpectedPackageDBFromPieceInstance> {
		return getDocumentChanges(this.#expectedPackagesWithChanges, this.#expectedPackages)
	}

	constructor(
		pieceInstances: PieceInstance,
		expectedPackages: ExpectedPackageDBFromPieceInstance[],
		hasChanges: boolean,
		expectedPackagesWithChanges: ExpectedPackageId[] | null
	) {
		this.PieceInstanceImpl = pieceInstances
		this.#expectedPackages = expectedPackages
		this.#hasChanges = hasChanges
		this.#expectedPackagesWithChanges = new Set(expectedPackagesWithChanges)
	}

	/**
	 * Merge properties from another PieceInstance onto this one
	 * @param pieceInstance PieceInstance to merge properties from
	 */
	mergeProperties(pieceInstance: ReadonlyDeep<PieceInstance>): void {
		this.PieceInstanceImpl = {
			...this.PieceInstanceImpl,
			...clone<PieceInstance>(pieceInstance),
		}

		this.#hasChanges = true
	}

	prepareForHold(): PieceInstanceInfiniteId {
		const infiniteInstanceId: PieceInstanceInfiniteId = getRandomId()
		this.setPieceInstanceValue('infinite', {
			infiniteInstanceId: infiniteInstanceId,
			infiniteInstanceIndex: 0,
			infinitePieceId: this.PieceInstanceImpl.piece._id,
			fromPreviousPart: false,
		})

		return infiniteInstanceId
	}

	setDisabled(disabled: boolean): void {
		this.compareAndSetPieceInstanceValue('disabled', disabled)
	}

	setDuration(duration: Required<PieceInstance>['userDuration']): void {
		this.compareAndSetPieceInstanceValue('userDuration', duration, true)
	}

	setPlannedStartedPlayback(time: Time): boolean {
		this.compareAndSetPieceInstanceValue('plannedStoppedPlayback', undefined)
		return this.compareAndSetPieceInstanceValue('plannedStartedPlayback', time)
	}
	setPlannedStoppedPlayback(time: Time | undefined): boolean {
		return this.compareAndSetPieceInstanceValue('plannedStoppedPlayback', time)
	}
	setReportedStartedPlayback(time: Time): boolean {
		this.compareAndSetPieceInstanceValue('reportedStoppedPlayback', undefined)
		return this.compareAndSetPieceInstanceValue('reportedStartedPlayback', time)
	}
	setReportedStoppedPlayback(time: Time): boolean {
		return this.compareAndSetPieceInstanceValue('reportedStoppedPlayback', time)
	}

	updatePieceProps(props: Partial<PieceInstancePiece>): void {
		// TODO - this is missing a lot of validation

		this.compareAndSetPieceInstanceValue(
			'piece',
			{
				...this.PieceInstanceImpl.piece,
				...props,
			},
			true
		)
	}

	/**
	 * Update the expected packages for the PieceInstance
	 * @param expectedPackages The new packages
	 */
	setExpectedPackages(expectedPackages: ExpectedPackageDBFromPieceInstance[]): void {
		// nocommit - refactor this into a simpler type than `ExpectedPackagesStore` or just reuse that?

		const newExpectedPackages: ExpectedPackageDBFromPieceInstance[] = expectedPackages.map((pkg) => ({
			...pkg,
			partInstanceId: this.PieceInstanceImpl.partInstanceId,
			pieceInstanceId: this.PieceInstanceImpl._id,
			rundownId: this.PieceInstanceImpl.rundownId,
		}))

		this.#expectedPackages = diffAndReturnLatestObjects(
			this.#expectedPackagesWithChanges,
			this.#expectedPackages,
			newExpectedPackages,
			mutateExpectedPackage
		)
	}
}

// nocommit - this is copied from elsewhere
function mutateExpectedPackage(
	oldObj: ExpectedPackageDBFromPieceInstance,
	newObj: ExpectedPackageDBFromPieceInstance
): ExpectedPackageDBFromPieceInstance {
	return {
		...newObj,
		// Retain the created property
		created: oldObj.created,
	}
}
