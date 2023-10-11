import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { Time } from '@sofie-automation/blueprints-integration'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel'
import _ = require('underscore')

export class PlayoutPieceInstanceModelImpl implements PlayoutPieceInstanceModel {
	PieceInstanceImpl: PieceInstance

	setPieceInstanceValue<T extends keyof PieceInstance>(key: T, newValue: PieceInstance[T]): void {
		if (newValue === undefined) {
			delete this.PieceInstanceImpl[key]
		} else {
			this.PieceInstanceImpl[key] = newValue
		}

		this.#HasChanges = true
	}

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

	#HasChanges = false
	get HasChanges(): boolean {
		return this.#HasChanges
	}

	clearChangedFlag(): void {
		this.#HasChanges = false
	}

	get PieceInstance(): ReadonlyDeep<PieceInstance> {
		return this.PieceInstanceImpl
	}

	constructor(pieceInstances: PieceInstance, hasChanges: boolean) {
		this.PieceInstanceImpl = pieceInstances
		this.#HasChanges = hasChanges
	}

	mergeProperties(pieceInstance: ReadonlyDeep<PieceInstance>): void {
		this.PieceInstanceImpl = {
			...this.PieceInstanceImpl,
			...clone<PieceInstance>(pieceInstance),
		}

		this.#HasChanges = true
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
}
