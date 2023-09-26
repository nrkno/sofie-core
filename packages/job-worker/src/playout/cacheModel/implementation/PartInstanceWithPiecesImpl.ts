import {
	PieceId,
	PieceInstanceId,
	PieceInstanceInfiniteId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	omitPiecePropertiesForInstance,
	PieceInstance,
	PieceInstancePiece,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../../lib'
import { setupPieceInstanceInfiniteProperties } from '../../pieces'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	calculatePartExpectedDurationWithPreroll,
	PartCalculatedTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import {
	IBlueprintMutatablePart,
	IBlueprintPieceType,
	PieceLifespan,
	Time,
} from '@sofie-automation/blueprints-integration'
import { PartInstanceWithPieces } from '../PartInstanceWithPieces'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

export class PartInstanceWithPiecesImpl implements PartInstanceWithPieces {
	PartInstanceImpl: DBPartInstance
	PieceInstancesImpl: Map<PieceInstanceId, PieceInstance | null>

	#HasChanges = false // nocommit should we track pieceInstanceIds separately?
	get HasChanges(): boolean {
		return this.#HasChanges
	}
	clearChangedFlag(): void {
		this.#HasChanges = false
	}

	get PartInstance(): ReadonlyDeep<DBPartInstance> {
		return this.PartInstanceImpl
	}
	get PieceInstances(): ReadonlyDeep<PieceInstance>[] {
		return Array.from(this.PieceInstancesImpl.values()).filter((p): p is PieceInstance => !!p)
	}

	constructor(partInstance: DBPartInstance, pieceInstances: PieceInstance[], hasChanges: boolean) {
		this.PartInstanceImpl = partInstance
		this.PieceInstancesImpl = normalizeArrayToMap(pieceInstances, '_id')
		this.#HasChanges = hasChanges
	}

	/**
	 * @deprecated
	 * What is the purpose of this? Without changing the ids it is going to clash with the old copy..
	 * TODO - this has issues with deleting instances!
	 */
	clone(): PartInstanceWithPieces {
		return new PartInstanceWithPiecesImpl(
			clone(this.PartInstanceImpl),
			clone(Array.from(this.PieceInstancesImpl.values()).filter((p): p is PieceInstance => !!p)),
			this.#HasChanges
		)
	}

	setPlaylistActivationId(id: RundownPlaylistActivationId): void {
		this.PartInstanceImpl.playlistActivationId = id

		this.#HasChanges = true

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance) continue
			pieceInstance.playlistActivationId = id
		}
	}

	recalculateExpectedDurationWithPreroll(): void {
		this.#HasChanges = true

		this.PartInstanceImpl.part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			this.PartInstanceImpl.part,
			this.PieceInstances.map((p) => p.piece)
		)
	}

	// insertPieceInstance(instance: PieceInstance): ReadonlyDeep<PieceInstance> {
	// 	const cloned = clone(instance)
	// 	// Ensure it is labelled as dynamic
	// 	cloned.partInstanceId = this.PartInstance._id
	// 	cloned.piece.startPartId = this.PartInstance.part._id
	// 	cloned.dynamicallyInserted = getCurrentTime()
	// 	setupPieceInstanceInfiniteProperties(cloned)
	// 	this.PieceInstancesImpl.push(cloned)
	// 	return cloned
	// }
	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined
	): ReadonlyDeep<PieceInstance> {
		const pieceInstance: PieceInstance = {
			_id: protectString(`${this.PartInstance._id}_${piece._id}`),
			rundownId: this.PartInstance.rundownId,
			playlistActivationId: this.PartInstance.playlistActivationId,
			partInstanceId: this.PartInstance._id,
			piece: clone(
				omitPiecePropertiesForInstance({
					...piece,
					startPartId: this.PartInstanceImpl.part._id,
				})
			),
		}

		// Ensure it is labelled as dynamic
		pieceInstance.partInstanceId = this.PartInstance._id
		pieceInstance.piece.startPartId = this.PartInstance.part._id
		pieceInstance.adLibSourceId = fromAdlibId

		if (this.PartInstance.isTaken) pieceInstance.dynamicallyInserted = getCurrentTime()

		setupPieceInstanceInfiniteProperties(pieceInstance)

		this.PieceInstancesImpl.set(pieceInstance._id, pieceInstance)

		this.#HasChanges = true

		return pieceInstance
	}

	replaceInfinitesFromPreviousPlayhead(pieces: PieceInstance[]): void {
		// TODO - this should do some validation/some of the wrapping from a Piece into a PieceInstance
		// Remove old ones
		for (const [id, piece] of this.PieceInstancesImpl.entries()) {
			if (!piece) continue

			if (piece.infinite?.fromPreviousPlayhead) {
				this.PieceInstancesImpl.set(id, null)
			}
		}

		for (const piece of pieces) {
			this.PieceInstancesImpl.set(piece._id, piece)
		}

		this.#HasChanges = true
	}

	markAsReset(): void {
		this.PartInstanceImpl.reset = true

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance) continue

			pieceInstance.reset = true
		}

		this.#HasChanges = true
	}

	blockTakeUntil(timestamp: Time | null): void {
		if (timestamp) {
			this.PartInstanceImpl.blockTakeUntil = timestamp
		} else {
			delete this.PartInstanceImpl.blockTakeUntil
		}

		this.#HasChanges = true
	}

	clearPlannedTimings(): void {
		if (this.PartInstanceImpl.timings?.plannedStartedPlayback) {
			delete this.PartInstanceImpl.timings.plannedStartedPlayback
			delete this.PartInstanceImpl.timings.plannedStoppedPlayback

			this.#HasChanges = true
		}
	}

	setRank(rank: number): void {
		this.PartInstanceImpl.part._rank = rank

		this.#HasChanges = true
	}

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void {
		this.PartInstanceImpl.orphaned = orphaned

		this.#HasChanges = true
	}

	setTaken(takeTime: number, playOffset: number): void {
		this.PartInstanceImpl.isTaken = true

		const timings = this.PartInstanceImpl.timings ?? {}
		this.PartInstanceImpl.timings = timings

		timings.take = takeTime
		timings.playOffset = playOffset

		this.#HasChanges = true
	}

	setTakeCache(partPlayoutTimings: PartCalculatedTimings, previousPartEndState: unknown): void {
		this.PartInstanceImpl.isTaken = true

		this.PartInstanceImpl.partPlayoutTimings = partPlayoutTimings
		this.PartInstanceImpl.previousPartEndState = previousPartEndState
	}

	appendNotes(notes: PartNote[]): void {
		if (!this.PartInstanceImpl.part.notes) this.PartInstanceImpl.part.notes = []
		this.PartInstanceImpl.part.notes.push(...clone(notes))

		this.#HasChanges = true
	}

	updatePartProps(props: Partial<IBlueprintMutatablePart>): void {
		// TODO - this is missing a lot of validation
		this.PartInstanceImpl.part = {
			...this.PartInstanceImpl.part,
			...props,
		}

		this.#HasChanges = true
	}

	getPieceInstance(id: PieceInstanceId): ReadonlyDeep<PieceInstance> | undefined {
		return this.PieceInstancesImpl.get(id) ?? undefined
	}

	updatePieceProps(id: PieceInstanceId, props: Partial<PieceInstancePiece>): void {
		// TODO - this is missing a lot of validation
		const pieceInstance = this.PieceInstancesImpl.get(id)
		if (!pieceInstance) throw new Error('Bad pieceinstance')

		pieceInstance.piece = {
			...pieceInstance.piece,
			...props,
		}

		this.#HasChanges = true
	}

	/** @deprecated HACK */
	replacePieceInstance(doc: ReadonlyDeep<PieceInstance>): void {
		// TODO - this is missing a lot of validation
		this.PieceInstancesImpl.set(doc._id, clone<PieceInstance>(doc))

		this.#HasChanges = true
	}

	/** @deprecated HACK */
	removePieceInstance(id: PieceInstanceId): boolean {
		this.#HasChanges = true

		// TODO - this is missing a lot of validation
		const hasPieceInstance = !!this.PieceInstancesImpl.get(id)
		this.PieceInstancesImpl.set(id, null)
		return hasPieceInstance
	}

	/** @deprecated HACK */
	insertInfinitePieces(pieceInstances: PieceInstance[]): void {
		for (const pieceInstance of pieceInstances) {
			this.PieceInstancesImpl.set(pieceInstance._id, pieceInstance)
		}
	}

	setPlannedStartedPlayback(time: Time | undefined): void {
		const timings = this.PartInstanceImpl.timings ?? {}

		if (timings.plannedStartedPlayback !== time) {
			timings.plannedStartedPlayback = time
			delete timings.plannedStoppedPlayback

			this.PartInstanceImpl.timings = timings
			this.#HasChanges = true
		}
	}
	setPlannedStoppedPlayback(time: Time): void {
		const timings = this.PartInstanceImpl.timings
		if (timings?.plannedStartedPlayback && !timings.plannedStoppedPlayback) {
			timings.plannedStoppedPlayback = time
			timings.duration = time - timings.plannedStartedPlayback

			this.#HasChanges = true
		}
	}
	setReportedStartedPlayback(time: Time): boolean {
		const timings = this.PartInstanceImpl.timings ?? {}

		if (!timings.reportedStartedPlayback) {
			timings.reportedStartedPlayback = time
			delete timings.plannedStoppedPlayback
			delete timings.duration

			this.PartInstanceImpl.timings = timings
			this.#HasChanges = true

			return true
		}

		return false
	}
	setReportedStoppedPlayback(time: number): boolean {
		const timings = this.PartInstanceImpl.timings ?? {}

		if (!timings.reportedStoppedPlayback) {
			timings.reportedStoppedPlayback = time
			timings.duration = time - (timings.reportedStartedPlayback || time)

			this.PartInstanceImpl.timings = timings
			this.#HasChanges = true

			return true
		}
		return false
	}

	setPieceInstancedPlannedStartedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.plannedStartedPlayback !== time) {
			pieceInstance.plannedStartedPlayback = time
			delete pieceInstance.plannedStoppedPlayback

			this.#HasChanges = true

			return true
		}
		return false
	}
	setPieceInstancedPlannedStoppedPlayback(pieceInstanceId: PieceInstanceId, time: Time | undefined): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.plannedStoppedPlayback !== time) {
			pieceInstance.plannedStoppedPlayback = time

			this.#HasChanges = true

			return true
		}
		return false
	}
	setPieceInstancedReportedStartedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.reportedStartedPlayback !== time) {
			pieceInstance.reportedStartedPlayback = time
			delete pieceInstance.reportedStoppedPlayback

			this.#HasChanges = true

			return true
		}
		return false
	}
	setPieceInstancedReportedStoppedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.reportedStoppedPlayback !== time) {
			pieceInstance.reportedStoppedPlayback = time

			this.#HasChanges = true

			return true
		}
		return false
	}

	validateScratchpadSegmentProperties(): void {
		this.PartInstanceImpl.orphaned = 'adlib-part'

		// Autonext isn't allowed to begin with, to avoid accidentally exiting the scratchpad
		delete this.PartInstanceImpl.part.autoNext

		// Force this to not affect rundown timing
		this.PartInstanceImpl.part.untimed = true

		// TODO - more intelligent
		this.#HasChanges = true
	}

	preparePieceInstanceForHold(pieceInstanceId: PieceInstanceId): PieceInstanceInfiniteId {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		const infiniteInstanceId: PieceInstanceInfiniteId = getRandomId()
		pieceInstance.infinite = {
			infiniteInstanceId: infiniteInstanceId,
			infiniteInstanceIndex: 0,
			infinitePieceId: pieceInstance.piece._id,
			fromPreviousPart: false,
		}

		this.#HasChanges = true
		return infiniteInstanceId
	}

	addHoldPieceInstance(
		extendPieceInstance: ReadonlyDeep<PieceInstance>,
		infiniteInstanceId: PieceInstanceInfiniteId
	): PieceInstance {
		// make the extension
		const newInstance: PieceInstance = {
			_id: protectString<PieceInstanceId>(extendPieceInstance._id + '_hold'),
			playlistActivationId: extendPieceInstance.playlistActivationId,
			rundownId: extendPieceInstance.rundownId,
			partInstanceId: this.PartInstance._id,
			dynamicallyInserted: getCurrentTime(),
			piece: {
				...clone<PieceInstancePiece>(extendPieceInstance.piece),
				enable: { start: 0 },
				extendOnHold: false,
			},
			infinite: {
				infiniteInstanceId: infiniteInstanceId,
				infiniteInstanceIndex: 1,
				infinitePieceId: extendPieceInstance.piece._id,
				fromPreviousPart: true,
				fromHold: true,
			},
			// Preserve the timings from the playing instance
			reportedStartedPlayback: extendPieceInstance.reportedStartedPlayback,
			reportedStoppedPlayback: extendPieceInstance.reportedStoppedPlayback,
			plannedStartedPlayback: extendPieceInstance.plannedStartedPlayback,
			plannedStoppedPlayback: extendPieceInstance.plannedStoppedPlayback,
		}

		this.PieceInstancesImpl.set(newInstance._id, newInstance)
		this.#HasChanges = true

		return newInstance
	}

	setPieceInstanceDuration(
		pieceInstanceId: PieceInstanceId,
		duration: Required<PieceInstance>['userDuration']
	): void {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		pieceInstance.userDuration = duration
		this.#HasChanges = true
	}

	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PieceInstance {
		const pieceId: PieceId = getRandomId()
		const newPieceInstance: PieceInstance = {
			_id: protectString(`${this.PartInstance._id}_${pieceId}`),
			rundownId: this.PartInstance.rundownId,
			playlistActivationId: this.PartInstance.playlistActivationId,
			partInstanceId: this.PartInstance._id,
			piece: {
				_id: pieceId,
				externalId: '-',
				enable: { start: start },
				lifespan: lifespan,
				sourceLayerId: sourceLayerId,
				outputLayerId: outputLayerId,
				invalid: false,
				name: '',
				startPartId: this.PartInstance.part._id,
				pieceType: IBlueprintPieceType.Normal,
				virtual: true,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			},

			dynamicallyInserted: getCurrentTime(),
		}
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		this.PieceInstancesImpl.set(newPieceInstance._id, newPieceInstance)
		this.#HasChanges = true

		return newPieceInstance
	}

	setPieceInstanceDisabled(pieceInstanceId: PieceInstanceId, disabled: boolean): void {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		pieceInstance.disabled = disabled
		this.#HasChanges = true
	}
}
