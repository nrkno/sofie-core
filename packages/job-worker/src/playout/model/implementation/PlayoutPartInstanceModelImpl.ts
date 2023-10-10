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
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel'
import { PlayoutPieceInstanceModelImpl } from './PlayoutPieceInstanceModelImpl'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'

export class PlayoutPartInstanceModelImpl implements PlayoutPartInstanceModel {
	PartInstanceImpl: DBPartInstance
	PieceInstancesImpl: Map<PieceInstanceId, PlayoutPieceInstanceModelImpl | null>

	#PartInstanceHasChanges = false
	get PartInstanceHasChanges(): boolean {
		return this.#PartInstanceHasChanges
	}
	ChangedPieceInstanceIds(): PieceInstanceId[] {
		const result: PieceInstanceId[] = []
		for (const [id, pieceInstance] of this.PieceInstancesImpl.entries()) {
			if (!pieceInstance || pieceInstance.HasChanges) result.push(id)
		}
		return result
	}
	HasAnyChanges(): boolean {
		return this.#PartInstanceHasChanges || this.ChangedPieceInstanceIds().length > 0
	}
	clearChangedFlags(): void {
		this.#PartInstanceHasChanges = false

		for (const [id, value] of this.PieceInstancesImpl) {
			if (!value) {
				this.PieceInstancesImpl.delete(id)
			} else if (value.HasChanges) {
				value.setDirty(false)
			}
		}
	}

	get PartInstance(): ReadonlyDeep<DBPartInstance> {
		return this.PartInstanceImpl
	}
	get PieceInstances(): PlayoutPieceInstanceModel[] {
		const result: PlayoutPieceInstanceModel[] = []

		for (const pieceWrapped of this.PieceInstancesImpl.values()) {
			if (pieceWrapped) result.push(pieceWrapped)
		}

		return result
	}

	constructor(partInstance: DBPartInstance, pieceInstances: PieceInstance[], hasChanges: boolean) {
		this.PartInstanceImpl = partInstance
		this.#PartInstanceHasChanges = hasChanges

		this.PieceInstancesImpl = new Map()
		for (const pieceInstance of pieceInstances) {
			this.PieceInstancesImpl.set(pieceInstance._id, new PlayoutPieceInstanceModelImpl(pieceInstance, hasChanges))
		}
	}

	/**
	 * @deprecated
	 * What is the purpose of this? Without changing the ids it is going to clash with the old copy..
	 * TODO - this has issues with deleting instances!
	 */
	clone(): PlayoutPartInstanceModel {
		const cloned = new PlayoutPartInstanceModelImpl(clone(this.PartInstanceImpl), [], this.#PartInstanceHasChanges)

		for (const [id, pieceInstance] of this.PieceInstancesImpl) {
			if (!pieceInstance) {
				cloned.PieceInstancesImpl.set(id, null)
			} else {
				cloned.PieceInstancesImpl.set(
					id,
					new PlayoutPieceInstanceModelImpl(clone(pieceInstance.PieceInstanceImpl), pieceInstance.HasChanges)
				)
			}
		}

		return cloned
	}

	setPlaylistActivationId(id: RundownPlaylistActivationId): void {
		this.PartInstanceImpl.playlistActivationId = id

		this.#PartInstanceHasChanges = true

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance) continue
			pieceInstance.PieceInstanceImpl.playlistActivationId = id
			pieceInstance.setDirty()
		}
	}

	recalculateExpectedDurationWithPreroll(): void {
		this.#PartInstanceHasChanges = true

		this.PartInstanceImpl.part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			this.PartInstanceImpl.part,
			this.PieceInstances.map((p) => p.PieceInstance.piece)
		)
	}

	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined
	): PlayoutPieceInstanceModel {
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

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(pieceInstance, true)
		this.PieceInstancesImpl.set(pieceInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	replaceInfinitesFromPreviousPlayhead(pieces: PieceInstance[]): void {
		// TODO - this should do some validation/some of the wrapping from a Piece into a PieceInstance
		// Remove old ones
		for (const [id, piece] of this.PieceInstancesImpl.entries()) {
			if (!piece) continue

			if (piece.PieceInstance.infinite?.fromPreviousPlayhead) {
				this.PieceInstancesImpl.set(id, null)
			}
		}

		for (const piece of pieces) {
			this.PieceInstancesImpl.set(piece._id, new PlayoutPieceInstanceModelImpl(piece, true))
		}
	}

	markAsReset(): void {
		this.PartInstanceImpl.reset = true

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance) continue

			pieceInstance.setDirty()
			pieceInstance.PieceInstanceImpl.reset = true
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

	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined {
		return this.PieceInstancesImpl.get(id) ?? undefined
	}

	replacePieceInstance(doc: ReadonlyDeep<PieceInstance>): PlayoutPieceInstanceModel {
		// TODO - this is missing a lot of validation

		const existingPieceInstance = this.PieceInstancesImpl.get(doc._id)
		if (existingPieceInstance) {
			existingPieceInstance.setDirty()
			existingPieceInstance.PieceInstanceImpl = {
				...existingPieceInstance.PieceInstanceImpl,
				...clone<PieceInstance>(doc),
			}
			return existingPieceInstance
		} else {
			const newPieceInstance = new PlayoutPieceInstanceModelImpl(clone<PieceInstance>(doc), true)
			this.PieceInstancesImpl.set(newPieceInstance.PieceInstance._id, newPieceInstance)
			return newPieceInstance
		}
	}

	/** @deprecated HACK
	 *
	 */
	insertPlannedPiece(piece: Omit<PieceInstancePiece, 'startPartId'>): PlayoutPieceInstanceModel {
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

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newPieceInstance, true)
		this.PieceInstancesImpl.set(pieceInstanceId, pieceInstanceModel)

		return pieceInstanceModel
	}

	/** @deprecated HACK */
	removePieceInstance(id: PieceInstanceId): boolean {
		// TODO - this is missing a lot of validation
		const pieceInstanceWrapped = this.PieceInstancesImpl.get(id)
		if (pieceInstanceWrapped) {
			this.PieceInstancesImpl.set(id, null)
			return true
		}
		return false
	}

	/** @deprecated HACK */
	insertInfinitePieces(pieceInstances: PieceInstance[]): void {
		for (const pieceInstance of pieceInstances) {
			const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(pieceInstance, true)
			this.PieceInstancesImpl.set(pieceInstance._id, pieceInstanceModel)
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

	validateScratchpadSegmentProperties(): void {
		this.PartInstanceImpl.orphaned = 'adlib-part'

		// Autonext isn't allowed to begin with, to avoid accidentally exiting the scratchpad
		delete this.PartInstanceImpl.part.autoNext

		// Force this to not affect rundown timing
		this.PartInstanceImpl.part.untimed = true

		// TODO - more intelligent
		this.#PartInstanceHasChanges = true
	}

	addHoldPieceInstance(
		extendPieceInstance: PlayoutPieceInstanceModel,
		infiniteInstanceId: PieceInstanceInfiniteId
	): PlayoutPieceInstanceModel {
		// make the extension
		const newInstance: PieceInstance = {
			_id: protectString<PieceInstanceId>(extendPieceInstance.PieceInstance._id + '_hold'),
			playlistActivationId: extendPieceInstance.PieceInstance.playlistActivationId,
			rundownId: extendPieceInstance.PieceInstance.rundownId,
			partInstanceId: this.PartInstance._id,
			dynamicallyInserted: getCurrentTime(),
			piece: {
				...clone<PieceInstancePiece>(extendPieceInstance.PieceInstance.piece),
				enable: { start: 0 },
				extendOnHold: false,
			},
			infinite: {
				infiniteInstanceId: infiniteInstanceId,
				infiniteInstanceIndex: 1,
				infinitePieceId: extendPieceInstance.PieceInstance.piece._id,
				fromPreviousPart: true,
				fromHold: true,
			},
			// Preserve the timings from the playing instance
			reportedStartedPlayback: extendPieceInstance.PieceInstance.reportedStartedPlayback,
			reportedStoppedPlayback: extendPieceInstance.PieceInstance.reportedStoppedPlayback,
			plannedStartedPlayback: extendPieceInstance.PieceInstance.plannedStartedPlayback,
			plannedStoppedPlayback: extendPieceInstance.PieceInstance.plannedStoppedPlayback,
		}

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newInstance, true)
		this.PieceInstancesImpl.set(newInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	insertVirtualPiece(
		start: number,
		lifespan: PieceLifespan,
		sourceLayerId: string,
		outputLayerId: string
	): PlayoutPieceInstanceModel {
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

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newPieceInstance, true)
		this.PieceInstancesImpl.set(newPieceInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}
}
