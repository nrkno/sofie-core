import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { Time } from '@sofie-automation/blueprints-integration'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel'

export class PlayoutPieceInstanceModelImpl implements PlayoutPieceInstanceModel {
	PieceInstanceImpl: PieceInstance

	#HasChanges = false
	get HasChanges(): boolean {
		return this.#HasChanges
	}

	setDirty(dirty = true): void {
		this.#HasChanges = dirty
	}

	get PieceInstance(): ReadonlyDeep<PieceInstance> {
		return this.PieceInstanceImpl
	}

	constructor(pieceInstances: PieceInstance, hasChanges: boolean) {
		this.PieceInstanceImpl = pieceInstances
		this.#HasChanges = hasChanges
	}

	/**
	 * @deprecated
	 * What is the purpose of this? Without changing the ids it is going to clash with the old copy..
	 * TODO - this has issues with deleting instances!
	 */
	clone(): PlayoutPieceInstanceModelImpl {
		return new PlayoutPieceInstanceModelImpl(clone(this.PieceInstanceImpl), this.#HasChanges)
	}

	updatePieceProps(props: Partial<PieceInstancePiece>): void {
		// TODO - this is missing a lot of validation

		this.#HasChanges = true
		this.PieceInstanceImpl.piece = {
			...this.PieceInstanceImpl.piece,
			...props,
		}
	}

	setPlannedStartedPlayback(time: Time): boolean {
		if (this.PieceInstanceImpl.plannedStartedPlayback !== time) {
			this.PieceInstanceImpl.plannedStartedPlayback = time
			delete this.PieceInstanceImpl.plannedStoppedPlayback

			this.#HasChanges = true

			return true
		}
		return false
	}
	setPlannedStoppedPlayback(time: Time | undefined): boolean {
		if (this.PieceInstanceImpl.plannedStoppedPlayback !== time) {
			this.PieceInstanceImpl.plannedStoppedPlayback = time

			this.#HasChanges = true

			return true
		}
		return false
	}
	setReportedStartedPlayback(time: Time): boolean {
		if (this.PieceInstanceImpl.reportedStartedPlayback !== time) {
			this.PieceInstanceImpl.reportedStartedPlayback = time
			delete this.PieceInstanceImpl.reportedStoppedPlayback

			this.#HasChanges = true

			return true
		}
		return false
	}
	setReportedStoppedPlayback(time: Time): boolean {
		if (this.PieceInstanceImpl.reportedStoppedPlayback !== time) {
			this.PieceInstanceImpl.reportedStoppedPlayback = time

			this.#HasChanges = true

			return true
		}
		return false
	}

	prepareForHold(): PieceInstanceInfiniteId {
		const infiniteInstanceId: PieceInstanceInfiniteId = getRandomId()
		this.PieceInstanceImpl.infinite = {
			infiniteInstanceId: infiniteInstanceId,
			infiniteInstanceIndex: 0,
			infinitePieceId: this.PieceInstanceImpl.piece._id,
			fromPreviousPart: false,
		}
		this.#HasChanges = true

		return infiniteInstanceId
	}

	setDuration(duration: Required<PieceInstance>['userDuration']): void {
		this.#HasChanges = true
		this.PieceInstanceImpl.userDuration = duration
	}

	setDisabled(disabled: boolean): void {
		this.#HasChanges = true
		this.PieceInstanceImpl.disabled = disabled
	}
}
