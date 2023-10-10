import {
	PieceId,
	PieceInstanceId,
	PieceInstanceInfiniteId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	getPieceInstanceIdForPiece,
	omitPiecePropertiesForInstance,
	PieceInstance,
	PieceInstancePiece,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
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
import { PlayoutPartInstanceModel } from '../PlayoutPartInstanceModel'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

interface PieceInstanceWrapper {
	changed: boolean
	doc: PieceInstance | null
}

export class PlayoutPartInstanceModelImpl implements PlayoutPartInstanceModel {
	PartInstanceImpl: DBPartInstance
	PieceInstancesImpl: Map<PieceInstanceId, PieceInstanceWrapper>

	#PartInstanceHasChanges = false
	get PartInstanceHasChanges(): boolean {
		return this.#PartInstanceHasChanges
	}
	AnyPieceInstanceHasChanges(): boolean {
		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (pieceInstance.changed || !pieceInstance.doc) return true
		}
		return false
	}
	clearChangedFlags(): void {
		this.#PartInstanceHasChanges = false

		for (const [id, value] of this.PieceInstancesImpl) {
			if (!value.doc) {
				this.PieceInstancesImpl.delete(id)
			} else if (value.changed) {
				value.changed = false
			}
		}
	}

	get PartInstance(): ReadonlyDeep<DBPartInstance> {
		return this.PartInstanceImpl
	}
	get PieceInstances(): ReadonlyDeep<PieceInstance>[] {
		const result: PieceInstance[] = []

		for (const pieceWrapped of this.PieceInstancesImpl.values()) {
			if (pieceWrapped.doc) result.push(pieceWrapped.doc)
		}

		return result
	}

	constructor(partInstance: DBPartInstance, pieceInstances: PieceInstance[], hasChanges: boolean) {
		this.PartInstanceImpl = partInstance
		this.#PartInstanceHasChanges = hasChanges

		this.PieceInstancesImpl = new Map()
		for (const pieceInstance of pieceInstances) {
			this.PieceInstancesImpl.set(pieceInstance._id, {
				doc: pieceInstance,
				changed: false,
			})
		}
	}

	/**
	 * @deprecated
	 * What is the purpose of this? Without changing the ids it is going to clash with the old copy..
	 * TODO - this has issues with deleting instances!
	 */
	clone(): PlayoutPartInstanceModel {
		return new PlayoutPartInstanceModelImpl(
			clone(this.PartInstanceImpl),
			clone<PieceInstance[]>(this.PieceInstances),
			this.#PartInstanceHasChanges
		)
	}

	setPlaylistActivationId(id: RundownPlaylistActivationId): void {
		this.PartInstanceImpl.playlistActivationId = id

		this.#PartInstanceHasChanges = true

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance.doc) continue
			pieceInstance.doc.playlistActivationId = id
		}
	}

	recalculateExpectedDurationWithPreroll(): void {
		this.#PartInstanceHasChanges = true

		this.PartInstanceImpl.part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			this.PartInstanceImpl.part,
			this.PieceInstances.map((p) => p.piece)
		)
	}

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

		this.PieceInstancesImpl.set(pieceInstance._id, {
			doc: pieceInstance,
			changed: true,
		})

		return pieceInstance
	}

	replaceInfinitesFromPreviousPlayhead(pieces: PieceInstance[]): void {
		// TODO - this should do some validation/some of the wrapping from a Piece into a PieceInstance
		// Remove old ones
		for (const piece of this.PieceInstancesImpl.values()) {
			if (!piece.doc) continue

			if (piece.doc.infinite?.fromPreviousPlayhead) {
				piece.doc = null
				piece.changed = true
			}
		}

		for (const piece of pieces) {
			this.PieceInstancesImpl.set(piece._id, {
				doc: piece,
				changed: true,
			})
		}
	}

	markAsReset(): void {
		this.PartInstanceImpl.reset = true

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance.doc) continue

			pieceInstance.doc.reset = true
		}

		this.#PartInstanceHasChanges = true
	}

	blockTakeUntil(timestamp: Time | null): void {
		if (timestamp) {
			this.PartInstanceImpl.blockTakeUntil = timestamp
		} else {
			delete this.PartInstanceImpl.blockTakeUntil
		}

		this.#PartInstanceHasChanges = true
	}

	clearPlannedTimings(): void {
		if (this.PartInstanceImpl.timings?.plannedStartedPlayback) {
			delete this.PartInstanceImpl.timings.plannedStartedPlayback
			delete this.PartInstanceImpl.timings.plannedStoppedPlayback

			this.#PartInstanceHasChanges = true
		}
	}

	setRank(rank: number): void {
		this.PartInstanceImpl.part._rank = rank

		this.#PartInstanceHasChanges = true
	}

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void {
		this.PartInstanceImpl.orphaned = orphaned

		this.#PartInstanceHasChanges = true
	}

	setTaken(takeTime: number, playOffset: number): void {
		this.PartInstanceImpl.isTaken = true

		const timings = this.PartInstanceImpl.timings ?? {}
		this.PartInstanceImpl.timings = timings

		timings.take = takeTime
		timings.playOffset = playOffset

		this.#PartInstanceHasChanges = true
	}

	storePlayoutTimingsAndPreviousEndState(
		partPlayoutTimings: PartCalculatedTimings,
		previousPartEndState: unknown
	): void {
		this.PartInstanceImpl.isTaken = true

		this.PartInstanceImpl.partPlayoutTimings = partPlayoutTimings
		this.PartInstanceImpl.previousPartEndState = previousPartEndState
	}

	appendNotes(notes: PartNote[]): void {
		if (!this.PartInstanceImpl.part.notes) this.PartInstanceImpl.part.notes = []
		this.PartInstanceImpl.part.notes.push(...clone(notes))

		this.#PartInstanceHasChanges = true
	}

	updatePartProps(props: Partial<IBlueprintMutatablePart>): void {
		// TODO - this is missing a lot of validation
		this.PartInstanceImpl.part = {
			...this.PartInstanceImpl.part,
			...props,
		}

		this.#PartInstanceHasChanges = true
	}

	getPieceInstance(id: PieceInstanceId): ReadonlyDeep<PieceInstance> | undefined {
		return this.PieceInstancesImpl.get(id)?.doc ?? undefined
	}

	updatePieceProps(id: PieceInstanceId, props: Partial<PieceInstancePiece>): void {
		// TODO - this is missing a lot of validation
		const pieceInstance = this.PieceInstancesImpl.get(id)
		if (!pieceInstance?.doc) throw new Error('Bad pieceinstance')

		pieceInstance.doc.piece = {
			...pieceInstance.doc.piece,
			...props,
		}
	}

	/** @deprecated HACK */
	replacePieceInstance(doc: ReadonlyDeep<PieceInstance>): void {
		// TODO - this is missing a lot of validation
		this.PieceInstancesImpl.set(doc._id, {
			doc: clone<PieceInstance>(doc),
			changed: true,
		})
	}

	/** @deprecated HACK
	 *
	 */
	insertPlannedPiece(piece: Omit<PieceInstancePiece, 'startPartId'>): PieceInstance {
		const pieceInstanceId = getPieceInstanceIdForPiece(this.PartInstance._id, piece._id)
		if (this.PieceInstancesImpl.has(pieceInstanceId))
			throw new Error(`PieceInstance "${pieceInstanceId}" already exists`)

		const newPieceInstance: PieceInstance = {
			_id: getPieceInstanceIdForPiece(this.PartInstance._id, piece._id),
			rundownId: this.PartInstance.rundownId,
			playlistActivationId: this.PartInstance.playlistActivationId,
			partInstanceId: this.PartInstance._id,
			piece: {
				...piece,
				startPartId: this.PartInstance.part._id,
			},
		}

		// Ensure the infinite-ness is setup correctly
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		this.PieceInstancesImpl.set(pieceInstanceId, {
			doc: newPieceInstance,
			changed: true,
		})
		return newPieceInstance
	}

	/** @deprecated HACK */
	removePieceInstance(id: PieceInstanceId): boolean {
		// TODO - this is missing a lot of validation
		const pieceInstanceWrapped = this.PieceInstancesImpl.get(id)
		if (pieceInstanceWrapped) {
			pieceInstanceWrapped.changed = true
			pieceInstanceWrapped.doc = null
			return true
		}
		return false
	}

	/** @deprecated HACK */
	insertInfinitePieces(pieceInstances: PieceInstance[]): void {
		for (const pieceInstance of pieceInstances) {
			this.PieceInstancesImpl.set(pieceInstance._id, {
				doc: pieceInstance,
				changed: true,
			})
		}
	}

	setPlannedStartedPlayback(time: Time | undefined): void {
		const timings = this.PartInstanceImpl.timings ?? {}

		if (timings.plannedStartedPlayback !== time) {
			timings.plannedStartedPlayback = time
			delete timings.plannedStoppedPlayback

			this.PartInstanceImpl.timings = timings
			this.#PartInstanceHasChanges = true
		}
	}
	setPlannedStoppedPlayback(time: Time): void {
		const timings = this.PartInstanceImpl.timings
		if (timings?.plannedStartedPlayback && !timings.plannedStoppedPlayback) {
			timings.plannedStoppedPlayback = time
			timings.duration = time - timings.plannedStartedPlayback

			this.#PartInstanceHasChanges = true
		}
	}
	setReportedStartedPlayback(time: Time): boolean {
		const timings = this.PartInstanceImpl.timings ?? {}

		if (!timings.reportedStartedPlayback) {
			timings.reportedStartedPlayback = time
			delete timings.plannedStoppedPlayback
			delete timings.duration

			this.PartInstanceImpl.timings = timings
			this.#PartInstanceHasChanges = true

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
			this.#PartInstanceHasChanges = true

			return true
		}
		return false
	}

	setPieceInstancedPlannedStartedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.doc.plannedStartedPlayback !== time) {
			pieceInstance.doc.plannedStartedPlayback = time
			delete pieceInstance.doc.plannedStoppedPlayback

			return true
		}
		return false
	}
	setPieceInstancedPlannedStoppedPlayback(pieceInstanceId: PieceInstanceId, time: Time | undefined): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.doc.plannedStoppedPlayback !== time) {
			pieceInstance.doc.plannedStoppedPlayback = time

			return true
		}
		return false
	}
	setPieceInstancedReportedStartedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.doc.reportedStartedPlayback !== time) {
			pieceInstance.doc.reportedStartedPlayback = time
			delete pieceInstance.doc.reportedStoppedPlayback

			return true
		}
		return false
	}
	setPieceInstancedReportedStoppedPlayback(pieceInstanceId: PieceInstanceId, time: Time): boolean {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		if (pieceInstance.doc.reportedStoppedPlayback !== time) {
			pieceInstance.doc.reportedStoppedPlayback = time

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
		this.#PartInstanceHasChanges = true
	}

	preparePieceInstanceForHold(pieceInstanceId: PieceInstanceId): PieceInstanceInfiniteId {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		const infiniteInstanceId: PieceInstanceInfiniteId = getRandomId()
		pieceInstance.doc.infinite = {
			infiniteInstanceId: infiniteInstanceId,
			infiniteInstanceIndex: 0,
			infinitePieceId: pieceInstance.doc.piece._id,
			fromPreviousPart: false,
		}

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

		this.PieceInstancesImpl.set(newInstance._id, {
			doc: newInstance,
			changed: true,
		})

		return newInstance
	}

	setPieceInstanceDuration(
		pieceInstanceId: PieceInstanceId,
		duration: Required<PieceInstance>['userDuration']
	): void {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		pieceInstance.doc.userDuration = duration
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

		this.PieceInstancesImpl.set(newPieceInstance._id, {
			doc: newPieceInstance,
			changed: true,
		})

		return newPieceInstance
	}

	setPieceInstanceDisabled(pieceInstanceId: PieceInstanceId, disabled: boolean): void {
		const pieceInstance = this.PieceInstancesImpl.get(pieceInstanceId)
		if (!pieceInstance?.doc) throw new Error(`PieceInstance ${pieceInstanceId} not found`) // TODO - is this ok?

		pieceInstance.doc.disabled = disabled
	}
}
