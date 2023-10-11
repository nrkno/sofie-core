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
import { PlayoutPartInstanceModel, PlayoutPartInstanceModelSnapshot } from '../PlayoutPartInstanceModel'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutPieceInstanceModel } from '../PlayoutPieceInstanceModel'
import { PlayoutPieceInstanceModelImpl } from './PlayoutPieceInstanceModelImpl'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import _ = require('underscore')
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { IBlueprintMutatablePartSampleKeys } from '../../../blueprints/context/lib'

interface PlayoutPieceInstanceModelSnapshotImpl {
	PieceInstance: PieceInstance
	HasChanges: boolean
}
class PlayoutPartInstanceModelSnapshotImpl implements PlayoutPartInstanceModelSnapshot {
	readonly __isPlayoutPartInstanceModelBackup = true

	isRestored = false

	readonly PartInstance: DBPartInstance
	readonly PartInstanceHasChanges: boolean
	readonly PieceInstances: ReadonlyMap<PieceInstanceId, PlayoutPieceInstanceModelSnapshotImpl | null>

	constructor(copyFrom: PlayoutPartInstanceModelImpl) {
		this.PartInstance = clone(copyFrom.PartInstanceImpl)
		this.PartInstanceHasChanges = copyFrom.PartInstanceHasChanges

		const pieceInstances = new Map<PieceInstanceId, PlayoutPieceInstanceModelSnapshotImpl | null>()
		for (const [pieceInstanceId, pieceInstance] of copyFrom.PieceInstancesImpl) {
			if (pieceInstance) {
				pieceInstances.set(pieceInstanceId, {
					PieceInstance: clone(pieceInstance.PieceInstanceImpl),
					HasChanges: pieceInstance.HasChanges,
				})
			} else {
				pieceInstances.set(pieceInstanceId, null)
			}
		}
		this.PieceInstances = pieceInstances
	}
}
export class PlayoutPartInstanceModelImpl implements PlayoutPartInstanceModel {
	PartInstanceImpl: DBPartInstance
	PieceInstancesImpl: Map<PieceInstanceId, PlayoutPieceInstanceModelImpl | null>

	#setPartInstanceValue<T extends keyof DBPartInstance>(key: T, newValue: DBPartInstance[T]): void {
		if (newValue === undefined) {
			delete this.PartInstanceImpl[key]
		} else {
			this.PartInstanceImpl[key] = newValue
		}

		this.#PartInstanceHasChanges = true
	}
	#compareAndSetPartInstanceValue<T extends keyof DBPartInstance>(
		key: T,
		newValue: DBPartInstance[T],
		deepEqual = false
	): boolean {
		const oldValue = this.PartInstanceImpl[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setPartInstanceValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#setPartValue<T extends keyof DBPart>(key: T, newValue: DBPart[T]): void {
		if (newValue === undefined) {
			delete this.PartInstanceImpl.part[key]
		} else {
			this.PartInstanceImpl.part[key] = newValue
		}

		this.#PartInstanceHasChanges = true
	}
	#compareAndSetPartValue<T extends keyof DBPart>(key: T, newValue: DBPart[T], deepEqual = false): boolean {
		const oldValue = this.PartInstanceImpl.part[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setPartValue(key, newValue)

			return true
		} else {
			return false
		}
	}

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
				value.clearChangedFlag()
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

	snapshotMakeCopy(): PlayoutPartInstanceModelSnapshot {
		return new PlayoutPartInstanceModelSnapshotImpl(this)
	}

	snapshotRestore(snapshot: PlayoutPartInstanceModelSnapshot): void {
		if (!(snapshot instanceof PlayoutPartInstanceModelSnapshotImpl))
			throw new Error(`Cannot restore a Snapshot from an different Model`)

		if (snapshot.PartInstance._id !== this.PartInstance._id)
			throw new Error(`Cannot restore a Snapshot from an different PartInstance`)

		if (snapshot.isRestored) throw new Error(`Cannot restore a Snapshot which has already been restored`)
		snapshot.isRestored = true

		this.PartInstanceImpl = snapshot.PartInstance
		this.#PartInstanceHasChanges = snapshot.PartInstanceHasChanges
		this.PieceInstancesImpl.clear()
		for (const [pieceInstanceId, pieceInstance] of snapshot.PieceInstances) {
			if (pieceInstance) {
				this.PieceInstancesImpl.set(
					pieceInstanceId,
					new PlayoutPieceInstanceModelImpl(pieceInstance.PieceInstance, pieceInstance.HasChanges)
				)
			} else {
				this.PieceInstancesImpl.set(pieceInstanceId, null)
			}
		}
	}

	appendNotes(notes: PartNote[]): void {
		this.#setPartValue('notes', [...(this.PartInstanceImpl.part.notes ?? []), ...clone(notes)])
	}

	blockTakeUntil(timestamp: Time | null): void {
		this.#compareAndSetPartInstanceValue('blockTakeUntil', timestamp ?? undefined)
	}

	clearPlannedTimings(): void {
		const timings = { ...this.PartInstanceImpl.timings }
		if (timings.plannedStartedPlayback) {
			delete timings.plannedStartedPlayback
			delete timings.plannedStoppedPlayback

			this.#compareAndSetPartInstanceValue('timings', timings, true)
		}
	}

	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined {
		return this.PieceInstancesImpl.get(id) ?? undefined
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

	insertHoldPieceInstance(
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

	markAsReset(): void {
		this.#compareAndSetPartInstanceValue('reset', true)

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance) continue

			pieceInstance.compareAndSetPieceInstanceValue('reset', true)
		}
	}

	recalculateExpectedDurationWithPreroll(): void {
		const newDuration = calculatePartExpectedDurationWithPreroll(
			this.PartInstanceImpl.part,
			this.PieceInstances.map((p) => p.PieceInstance.piece)
		)

		this.#compareAndSetPartValue('expectedDurationWithPreroll', newDuration)
	}

	removePieceInstance(id: PieceInstanceId): boolean {
		// Future: should this limit what can be removed based on type/infinite

		const pieceInstanceWrapped = this.PieceInstancesImpl.get(id)
		if (pieceInstanceWrapped) {
			this.PieceInstancesImpl.set(id, null)
			return true
		}

		return false
	}

	replaceInfinitesFromPreviousPlayhead(pieceInstances: PieceInstance[]): void {
		// Future: this should do some of the wrapping from a Piece into a PieceInstance

		// Remove old infinite pieces
		for (const [id, piece] of this.PieceInstancesImpl.entries()) {
			if (!piece) continue

			if (piece.PieceInstance.infinite?.fromPreviousPlayhead) {
				this.PieceInstancesImpl.set(id, null)
			}
		}

		for (const pieceInstance of pieceInstances) {
			if (this.PieceInstancesImpl.has(pieceInstance._id))
				throw new Error(
					`Cannot replace infinite PieceInstance "${pieceInstance._id}" as it replaces a non-infinite`
				)

			if (!pieceInstance.infinite?.fromPreviousPlayhead)
				throw new Error(`Cannot insert non-infinite PieceInstance "${pieceInstance._id}" as an infinite`)

			// Future: should this do any deeper validation of the PieceInstances?

			this.PieceInstancesImpl.set(pieceInstance._id, new PlayoutPieceInstanceModelImpl(pieceInstance, true))
		}
	}

	mergeOrInsertPieceInstance(doc: ReadonlyDeep<PieceInstance>): PlayoutPieceInstanceModel {
		// Future: this should do some validation of the new PieceInstance

		const existingPieceInstance = this.PieceInstancesImpl.get(doc._id)
		if (existingPieceInstance) {
			existingPieceInstance.mergeProperties(doc)

			return existingPieceInstance
		} else {
			const newPieceInstance = new PlayoutPieceInstanceModelImpl(clone<PieceInstance>(doc), true)
			this.PieceInstancesImpl.set(newPieceInstance.PieceInstance._id, newPieceInstance)
			return newPieceInstance
		}
	}

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void {
		this.#compareAndSetPartInstanceValue('orphaned', orphaned)
	}

	setPlaylistActivationId(id: RundownPlaylistActivationId): void {
		this.#compareAndSetPartInstanceValue('playlistActivationId', id)

		for (const pieceInstance of this.PieceInstancesImpl.values()) {
			if (!pieceInstance) continue
			pieceInstance.compareAndSetPieceInstanceValue('playlistActivationId', id)
		}
	}

	setPlannedStartedPlayback(time: Time | undefined): void {
		const timings = { ...this.PartInstanceImpl.timings }
		timings.plannedStartedPlayback = time
		delete timings.plannedStoppedPlayback

		this.#compareAndSetPartInstanceValue('timings', timings, true)
	}
	setPlannedStoppedPlayback(time: Time): void {
		const timings = { ...this.PartInstanceImpl.timings }
		if (timings?.plannedStartedPlayback && !timings.plannedStoppedPlayback) {
			timings.plannedStoppedPlayback = time
			timings.duration = time - timings.plannedStartedPlayback

			this.#compareAndSetPartInstanceValue('timings', timings, true)
		}
	}
	setReportedStartedPlayback(time: Time): boolean {
		const timings = { ...this.PartInstanceImpl.timings }

		if (!timings.reportedStartedPlayback) {
			timings.reportedStartedPlayback = time
			delete timings.plannedStoppedPlayback
			delete timings.duration

			return this.#compareAndSetPartInstanceValue('timings', timings, true)
		}

		return false
	}
	setReportedStoppedPlayback(time: number): boolean {
		const timings = { ...this.PartInstanceImpl.timings }

		if (!timings.reportedStoppedPlayback) {
			timings.reportedStoppedPlayback = time
			timings.duration = time - (timings.reportedStartedPlayback || time)

			return this.#compareAndSetPartInstanceValue('timings', timings, true)
		}
		return false
	}

	setRank(rank: number): void {
		this.#compareAndSetPartValue('_rank', rank)
	}

	setTaken(takeTime: number, playOffset: number): void {
		this.#compareAndSetPartInstanceValue('isTaken', true)

		const timings = { ...this.PartInstanceImpl.timings }
		timings.take = takeTime
		timings.playOffset = playOffset

		this.#compareAndSetPartInstanceValue('timings', timings, true)
	}

	storePlayoutTimingsAndPreviousEndState(
		partPlayoutTimings: PartCalculatedTimings,
		previousPartEndState: unknown
	): void {
		this.#compareAndSetPartInstanceValue('isTaken', true)

		// TODO: should this do a comparison?
		this.#setPartInstanceValue('partPlayoutTimings', partPlayoutTimings)
		this.#setPartInstanceValue('previousPartEndState', previousPartEndState)
	}

	updatePartProps(props: Partial<IBlueprintMutatablePart>): boolean {
		// Future: this could do some better validation

		// filter the submission to the allowed ones
		const trimmedProps: Partial<IBlueprintMutatablePart> = _.pick(props, [...IBlueprintMutatablePartSampleKeys])
		if (Object.keys(trimmedProps).length === 0) return false

		this.#compareAndSetPartInstanceValue(
			'part',
			{
				...this.PartInstanceImpl.part,
				...trimmedProps,
			},
			true
		)

		return true
	}

	validateScratchpadSegmentProperties(): void {
		this.#compareAndSetPartInstanceValue('orphaned', 'adlib-part')

		// Autonext isn't allowed to begin with, to avoid accidentally exiting the scratchpad
		this.#compareAndSetPartValue('autoNext', undefined)

		// Force this to not affect rundown timing
		this.#compareAndSetPartValue('untimed', true)
	}
}
