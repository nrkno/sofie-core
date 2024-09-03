import {
	ExpectedPackageId,
	PieceId,
	PieceInstanceId,
	RundownPlaylistActivationId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	getPieceInstanceIdForPiece,
	omitPiecePropertiesForInstance,
	PieceInstance,
	PieceInstancePiece,
	PieceInstanceWithExpectedPackages,
	PieceInstanceWithExpectedPackagesFull,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../../lib'
import { setupPieceInstanceInfiniteProperties } from '../../pieces'
import {
	calculatePartExpectedDurationWithTransition,
	PartCalculatedTimings,
} from '@sofie-automation/corelib/dist/playout/timings'
import { PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import {
	ExpectedPackage,
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
import { ExpectedPackageDBFromPieceInstance } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { wrapPackagesForPieceInstance } from '../../../ingest/expectedPackages'

interface PlayoutPieceInstanceModelSnapshotImpl {
	PieceInstance: PieceInstance
	ExpectedPackages: ExpectedPackageDBFromPieceInstance[]
	HasChanges: boolean
	ExpectedPackageChanges: ExpectedPackageId[]
}
class PlayoutPartInstanceModelSnapshotImpl implements PlayoutPartInstanceModelSnapshot {
	readonly __isPlayoutPartInstanceModelBackup = true

	isRestored = false

	readonly partInstance: DBPartInstance
	readonly partInstanceHasChanges: boolean
	readonly pieceInstances: ReadonlyMap<PieceInstanceId, PlayoutPieceInstanceModelSnapshotImpl | null>

	constructor(copyFrom: PlayoutPartInstanceModelImpl) {
		this.partInstance = clone(copyFrom.partInstanceImpl)
		this.partInstanceHasChanges = copyFrom.partInstanceHasChanges

		const pieceInstances = new Map<PieceInstanceId, PlayoutPieceInstanceModelSnapshotImpl | null>()
		for (const [pieceInstanceId, pieceInstance] of copyFrom.pieceInstancesImpl) {
			if (pieceInstance) {
				pieceInstances.set(pieceInstanceId, {
					PieceInstance: clone(pieceInstance.PieceInstanceImpl),
					ExpectedPackages: clone<ExpectedPackageDBFromPieceInstance[]>(pieceInstance.expectedPackages),
					HasChanges: pieceInstance.HasChanges,
					ExpectedPackageChanges: Array.from(pieceInstance.ExpectedPackagesWithChanges),
				})
			} else {
				pieceInstances.set(pieceInstanceId, null)
			}
		}
		this.pieceInstances = pieceInstances
	}
}
export class PlayoutPartInstanceModelImpl implements PlayoutPartInstanceModel {
	partInstanceImpl: DBPartInstance
	pieceInstancesImpl: Map<PieceInstanceId, PlayoutPieceInstanceModelImpl | null>

	#setPartInstanceValue<T extends keyof DBPartInstance>(key: T, newValue: DBPartInstance[T]): void {
		if (newValue === undefined) {
			delete this.partInstanceImpl[key]
		} else {
			this.partInstanceImpl[key] = newValue
		}

		this.#partInstanceHasChanges = true
	}
	#compareAndSetPartInstanceValue<T extends keyof DBPartInstance>(
		key: T,
		newValue: DBPartInstance[T],
		deepEqual = false
	): boolean {
		const oldValue = this.partInstanceImpl[key]

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
			delete this.partInstanceImpl.part[key]
		} else {
			this.partInstanceImpl.part[key] = newValue
		}

		this.#partInstanceHasChanges = true
	}
	#compareAndSetPartValue<T extends keyof DBPart>(key: T, newValue: DBPart[T], deepEqual = false): boolean {
		const oldValue = this.partInstanceImpl.part[key]

		const areEqual = deepEqual ? _.isEqual(oldValue, newValue) : oldValue === newValue

		if (!areEqual) {
			this.#setPartValue(key, newValue)

			return true
		} else {
			return false
		}
	}

	#partInstanceHasChanges = false
	get partInstanceHasChanges(): boolean {
		return this.#partInstanceHasChanges
	}
	changedPieceInstanceIds(): PieceInstanceId[] {
		const result: PieceInstanceId[] = []
		for (const [id, pieceInstance] of this.pieceInstancesImpl.entries()) {
			if (!pieceInstance || pieceInstance.HasChanges) result.push(id)
		}
		return result
	}
	hasAnyChanges(): boolean {
		return this.#partInstanceHasChanges || this.changedPieceInstanceIds().length > 0
	}
	clearChangedFlags(): void {
		this.#partInstanceHasChanges = false

		for (const [id, value] of this.pieceInstancesImpl) {
			if (!value) {
				this.pieceInstancesImpl.delete(id)
			} else if (value.HasChanges) {
				value.clearChangedFlag()
			}
		}
	}

	get partInstance(): ReadonlyDeep<DBPartInstance> {
		return this.partInstanceImpl
	}
	get pieceInstances(): PlayoutPieceInstanceModel[] {
		const result: PlayoutPieceInstanceModel[] = []

		for (const pieceWrapped of this.pieceInstancesImpl.values()) {
			if (pieceWrapped) result.push(pieceWrapped)
		}

		return result
	}

	constructor(
		partInstance: DBPartInstance,
		pieceInstances: PieceInstanceWithExpectedPackagesFull[],
		hasChanges: boolean
	) {
		this.partInstanceImpl = partInstance
		this.#partInstanceHasChanges = hasChanges

		this.pieceInstancesImpl = new Map()
		for (const { pieceInstance, expectedPackages } of pieceInstances) {
			// const expectedPackagesConverted = wrapPackagesForPieceInstance(
			// 	studio._id,
			// 	partInstance,
			// 	pieceInstance._id,
			// 	expectedPackages
			// )

			this.pieceInstancesImpl.set(
				pieceInstance._id,
				new PlayoutPieceInstanceModelImpl(
					pieceInstance,
					expectedPackages,
					hasChanges,
					hasChanges ? expectedPackages.map((p) => p._id) : null
				)
			)
		}
	}

	snapshotMakeCopy(): PlayoutPartInstanceModelSnapshot {
		return new PlayoutPartInstanceModelSnapshotImpl(this)
	}

	snapshotRestore(snapshot: PlayoutPartInstanceModelSnapshot): void {
		if (!(snapshot instanceof PlayoutPartInstanceModelSnapshotImpl))
			throw new Error(`Cannot restore a Snapshot from an different Model`)

		if (snapshot.partInstance._id !== this.partInstance._id)
			throw new Error(`Cannot restore a Snapshot from an different PartInstance`)

		if (snapshot.isRestored) throw new Error(`Cannot restore a Snapshot which has already been restored`)
		snapshot.isRestored = true

		this.partInstanceImpl = snapshot.partInstance
		this.#partInstanceHasChanges = snapshot.partInstanceHasChanges
		this.pieceInstancesImpl.clear()
		for (const [pieceInstanceId, pieceInstance] of snapshot.pieceInstances) {
			if (pieceInstance) {
				this.pieceInstancesImpl.set(
					pieceInstanceId,
					new PlayoutPieceInstanceModelImpl(
						pieceInstance.PieceInstance,
						pieceInstance.ExpectedPackages,
						pieceInstance.HasChanges,
						pieceInstance.ExpectedPackageChanges
					)
				)
			} else {
				this.pieceInstancesImpl.set(pieceInstanceId, null)
			}
		}
	}

	appendNotes(notes: PartNote[]): void {
		this.#setPartValue('notes', [...(this.partInstanceImpl.part.notes ?? []), ...clone(notes)])
	}

	blockTakeUntil(timestamp: Time | null): void {
		this.#compareAndSetPartInstanceValue('blockTakeUntil', timestamp ?? undefined)
	}

	getPieceInstance(id: PieceInstanceId): PlayoutPieceInstanceModel | undefined {
		return this.pieceInstancesImpl.get(id) ?? undefined
	}

	insertAdlibbedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		fromAdlibId: PieceId | undefined,
		pieceExpectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
	): PlayoutPieceInstanceModel {
		const pieceInstance: PieceInstance = {
			_id: protectString(`${this.partInstance._id}_${piece._id}`),
			rundownId: this.partInstance.rundownId,
			playlistActivationId: this.partInstance.playlistActivationId,
			partInstanceId: this.partInstance._id,
			piece: clone(
				omitPiecePropertiesForInstance({
					...piece,
					startPartId: this.partInstanceImpl.part._id,
				})
			),
		}

		// Ensure it is labelled as dynamic
		pieceInstance.partInstanceId = this.partInstance._id
		pieceInstance.piece.startPartId = this.partInstance.part._id
		pieceInstance.adLibSourceId = fromAdlibId

		if (this.partInstance.isTaken) pieceInstance.dynamicallyInserted = getCurrentTime()

		setupPieceInstanceInfiniteProperties(pieceInstance)

		const expectedPackages = this.#convertExpectedPackagesForPieceInstance(pieceInstance, pieceExpectedPackages)

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(
			pieceInstance,
			expectedPackages,
			true,
			expectedPackages.map((p) => p._id)
		)
		this.pieceInstancesImpl.set(pieceInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	insertHoldPieceInstance(extendPieceInstance: PlayoutPieceInstanceModel): PlayoutPieceInstanceModel {
		const extendPieceInfinite = extendPieceInstance.pieceInstance.infinite
		if (!extendPieceInfinite) throw new Error('Piece being extended is not infinite!')
		if (extendPieceInfinite.infiniteInstanceIndex !== 0 || extendPieceInfinite.fromPreviousPart)
			throw new Error('Piece being extended is not infinite due to HOLD!')

		const infiniteInstanceId = extendPieceInfinite.infiniteInstanceId

		// make the extension
		const newInstance: PieceInstance = {
			_id: protectString<PieceInstanceId>(extendPieceInstance.pieceInstance._id + '_hold'),
			playlistActivationId: extendPieceInstance.pieceInstance.playlistActivationId,
			rundownId: extendPieceInstance.pieceInstance.rundownId,
			partInstanceId: this.partInstance._id,
			dynamicallyInserted: getCurrentTime(),
			piece: {
				...clone<PieceInstancePiece>(extendPieceInstance.pieceInstance.piece),
				enable: { start: 0 },
				extendOnHold: false,
			},
			infinite: {
				infiniteInstanceId: infiniteInstanceId,
				infiniteInstanceIndex: 1,
				infinitePieceId: extendPieceInstance.pieceInstance.piece._id,
				fromPreviousPart: true,
				fromHold: true,
			},
			// Preserve the timings from the playing instance
			reportedStartedPlayback: extendPieceInstance.pieceInstance.reportedStartedPlayback,
			reportedStoppedPlayback: extendPieceInstance.pieceInstance.reportedStoppedPlayback,
			plannedStartedPlayback: extendPieceInstance.pieceInstance.plannedStartedPlayback,
			plannedStoppedPlayback: extendPieceInstance.pieceInstance.plannedStoppedPlayback,
		}

		// Don't preserve any ExpectedPackages, the existing ones will suffice
		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newInstance, [], true, null)
		this.pieceInstancesImpl.set(newInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	#convertExpectedPackagesForPieceInstance(
		pieceInstance: ReadonlyDeep<PieceInstance>,
		expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
	): ExpectedPackageDBFromPieceInstance[] {
		return wrapPackagesForPieceInstance(this.studioId, this.partInstanceImpl, pieceInstance._id, expectedPackages)
	}

	insertPlannedPiece(
		piece: Omit<PieceInstancePiece, 'startPartId'>,
		pieceExpectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
	): PlayoutPieceInstanceModel {
		const pieceInstanceId = getPieceInstanceIdForPiece(this.partInstance._id, piece._id)
		if (this.pieceInstancesImpl.has(pieceInstanceId))
			throw new Error(`PieceInstance "${pieceInstanceId}" already exists`)

		const newPieceInstance: PieceInstance = {
			_id: getPieceInstanceIdForPiece(this.partInstance._id, piece._id),
			rundownId: this.partInstance.rundownId,
			playlistActivationId: this.partInstance.playlistActivationId,
			partInstanceId: this.partInstance._id,
			piece: {
				...piece,
				startPartId: this.partInstance.part._id,
			},
		}

		// Ensure the infinite-ness is setup correctly
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		const expectedPackages = this.#convertExpectedPackagesForPieceInstance(newPieceInstance, pieceExpectedPackages)

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(
			newPieceInstance,
			expectedPackages,
			true,
			expectedPackages.map((p) => p._id)
		)
		this.pieceInstancesImpl.set(pieceInstanceId, pieceInstanceModel)

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
			_id: protectString(`${this.partInstance._id}_${pieceId}`),
			rundownId: this.partInstance.rundownId,
			playlistActivationId: this.partInstance.playlistActivationId,
			partInstanceId: this.partInstance._id,
			piece: {
				_id: pieceId,
				externalId: '-',
				enable: { start: start },
				lifespan: lifespan,
				sourceLayerId: sourceLayerId,
				outputLayerId: outputLayerId,
				invalid: false,
				name: '',
				startPartId: this.partInstance.part._id,
				pieceType: IBlueprintPieceType.Normal,
				virtual: true,
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			},

			dynamicallyInserted: getCurrentTime(),
		}
		setupPieceInstanceInfiniteProperties(newPieceInstance)

		const pieceInstanceModel = new PlayoutPieceInstanceModelImpl(newPieceInstance, [], true, null)
		this.pieceInstancesImpl.set(newPieceInstance._id, pieceInstanceModel)

		return pieceInstanceModel
	}

	markAsReset(): void {
		this.#compareAndSetPartInstanceValue('reset', true)

		for (const pieceInstance of this.pieceInstancesImpl.values()) {
			if (!pieceInstance) continue

			pieceInstance.compareAndSetPieceInstanceValue('reset', true)
		}
	}

	recalculateExpectedDurationWithTransition(): void {
		const newDuration = calculatePartExpectedDurationWithTransition(
			this.partInstanceImpl.part,
			this.pieceInstances.map((p) => p.pieceInstance.piece)
		)

		this.#compareAndSetPartValue('expectedDurationWithTransition', newDuration)
	}

	removePieceInstance(id: PieceInstanceId): boolean {
		// Future: should this limit what can be removed based on type/infinite

		const pieceInstanceWrapped = this.pieceInstancesImpl.get(id)
		if (pieceInstanceWrapped) {
			this.pieceInstancesImpl.set(id, null)
			return true
		}

		return false
	}

	replaceInfinitesFromPreviousPlayhead(pieceInstances: PieceInstanceWithExpectedPackages[]): void {
		// Future: this should do some of the wrapping from a Piece into a PieceInstance

		// Remove old infinite pieces
		for (const [id, piece] of this.pieceInstancesImpl.entries()) {
			if (!piece) continue

			if (piece.pieceInstance.infinite?.fromPreviousPlayhead) {
				this.pieceInstancesImpl.set(id, null)
			}
		}

		for (const { pieceInstance, expectedPackages } of pieceInstances) {
			if (this.pieceInstancesImpl.get(pieceInstance._id))
				throw new Error(
					`Cannot replace infinite PieceInstance "${pieceInstance._id}" as it replaces a non-infinite`
				)

			if (!pieceInstance.infinite?.fromPreviousPlayhead)
				throw new Error(`Cannot insert non-infinite PieceInstance "${pieceInstance._id}" as an infinite`)

			// Future: should this do any deeper validation of the PieceInstances?

			const newExpectedPackages = this.#convertExpectedPackagesForPieceInstance(pieceInstance, expectedPackages)

			this.pieceInstancesImpl.set(
				pieceInstance._id,
				new PlayoutPieceInstanceModelImpl(
					pieceInstance,
					newExpectedPackages,
					true,
					newExpectedPackages.map((p) => p._id)
				)
			)
		}
	}

	mergeOrInsertPieceInstance(
		doc: ReadonlyDeep<PieceInstance>,
		expectedPackages: ReadonlyDeep<ExpectedPackage.Any>[]
	): PlayoutPieceInstanceModel {
		// Future: this should do some validation of the new PieceInstance

		const existingPieceInstance = this.pieceInstancesImpl.get(doc._id)
		if (existingPieceInstance) {
			existingPieceInstance.mergeProperties(doc)
			existingPieceInstance.setExpectedPackages(expectedPackages)

			return existingPieceInstance
		} else {
			const newExpectedPackages = wrapPackagesForPieceInstance(
				studio._id,
				this.partInstanceImpl,
				doc._id,
				expectedPackages
			)

			const newPieceInstance = new PlayoutPieceInstanceModelImpl(
				clone<PieceInstance>(doc),
				newExpectedPackages,
				true,
				newExpectedPackages.map((p) => p._id)
			)
			this.pieceInstancesImpl.set(newPieceInstance.pieceInstance._id, newPieceInstance)
			return newPieceInstance
		}
	}

	setOrphaned(orphaned: 'adlib-part' | 'deleted' | undefined): void {
		this.#compareAndSetPartInstanceValue('orphaned', orphaned)
	}

	setPlaylistActivationId(id: RundownPlaylistActivationId): void {
		this.#compareAndSetPartInstanceValue('playlistActivationId', id)

		for (const pieceInstance of this.pieceInstancesImpl.values()) {
			if (!pieceInstance) continue
			pieceInstance.compareAndSetPieceInstanceValue('playlistActivationId', id)
		}
	}

	setPlannedStartedPlayback(time: Time | undefined): void {
		const timings = { ...this.partInstanceImpl.timings }
		timings.plannedStartedPlayback = time
		delete timings.plannedStoppedPlayback

		this.#compareAndSetPartInstanceValue('timings', timings, true)
	}
	setPlannedStoppedPlayback(time: Time | undefined): void {
		const timings = { ...this.partInstanceImpl.timings }
		if (timings?.plannedStartedPlayback && !timings.plannedStoppedPlayback) {
			if (time) {
				timings.plannedStoppedPlayback = time
				timings.duration = time - timings.plannedStartedPlayback
			} else {
				delete timings.plannedStoppedPlayback
				delete timings.duration
			}

			this.#compareAndSetPartInstanceValue('timings', timings, true)
		}
	}
	setReportedStartedPlayback(time: Time): boolean {
		const timings = { ...this.partInstanceImpl.timings }

		if (!timings.reportedStartedPlayback) {
			timings.reportedStartedPlayback = time
			delete timings.plannedStoppedPlayback
			delete timings.duration

			return this.#compareAndSetPartInstanceValue('timings', timings, true)
		}

		return false
	}
	setReportedStoppedPlayback(time: number): boolean {
		const timings = { ...this.partInstanceImpl.timings }

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

	setTaken(takeTime: number, playOffset: number | null): void {
		this.#compareAndSetPartInstanceValue('isTaken', true)

		const timings = { ...this.partInstanceImpl.timings }
		timings.take = takeTime
		timings.playOffset = playOffset ?? 0

		if (playOffset !== null) {
			// Shift the startedPlayback into the past, to cause playout to start a while into the Part:
			// Note: We won't use the takeTime here, since the takeTime is when we started executing the take, and we'd rather have the play-time to be Now instead
			timings.plannedStartedPlayback = getCurrentTime() - playOffset
		}

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
				...this.partInstanceImpl.part,
				...trimmedProps,
			},
			true
		)

		return true
	}

	validateAdlibTestingSegmentProperties(): void {
		this.#compareAndSetPartInstanceValue('orphaned', 'adlib-part')

		// Autonext isn't allowed to begin with, to avoid accidentally exiting the adlib testing segment
		this.#compareAndSetPartValue('autoNext', undefined)

		// Force this to not affect rundown timing
		this.#compareAndSetPartValue('untimed', true)
	}
}
