import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import {
	ExpectedPackageDBFromRundownBaselineObjects,
	ExpectedPackageFromRundown,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import {
	ExpectedPackageId,
	PartId,
	PieceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown, RundownOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { LazyInitialiseReadonly } from '../../lib/lazy'
import { RundownLock } from '../../jobs/lock'
import { IngestSegmentModel, IngestSegmentModelReadonly } from './IngestSegmentModel'
import { IngestPartModel, IngestPartModelReadonly } from './IngestPartModel'
import { ReadonlyDeep } from 'type-fest'
import { BaseModel } from '../../modelBase'
import { Piece, PieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'

export type ExpectedPackageForIngestModel = ExpectedPackageFromRundown | ExpectedPackageDBFromRundownBaselineObjects

export interface IngestModelReadonly {
	/**
	 * The Id of the Rundown this IngestModel operates for
	 */
	readonly rundownId: RundownId
	/**
	 * The externalId (NRCS id) of the Rundown this IngestModel operates for
	 */
	readonly rundownExternalId: string
	/**
	 * Reference to the lock for the Rundown
	 */
	readonly rundownLock: RundownLock

	readonly expectedMediaItemsForRundownBaseline: ReadonlyDeep<ExpectedMediaItemRundown>[]
	readonly expectedPlayoutItemsForRundownBaseline: ReadonlyDeep<ExpectedPlayoutItemRundown>[]
	readonly expectedPackagesForRundownBaseline: ReadonlyDeep<ExpectedPackageForIngestModel>[]

	readonly rundownBaselineTimelineObjects: LazyInitialiseReadonly<PieceTimelineObjectsBlob>
	readonly rundownBaselineAdLibPieces: LazyInitialiseReadonly<ReadonlyDeep<RundownBaselineAdLibItem[]>>
	readonly rundownBaselineAdLibActions: LazyInitialiseReadonly<ReadonlyDeep<RundownBaselineAdLibAction[]>>

	readonly rundown: ReadonlyDeep<DBRundown> | undefined

	/**
	 * Gets the Rundown wrapped by this Model, or throws if it does not exist
	 */
	getRundown(): ReadonlyDeep<DBRundown>

	/**
	 * Get a Segment from the Rundown by `externalId`
	 * @param id Id of the Segment
	 */
	getSegmentByExternalId(externalId: string): IngestSegmentModelReadonly | undefined

	/**
	 * Get a Segment from the Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): IngestSegmentModelReadonly | undefined
	/**
	 * Get the Segments of this Rundown, in order
	 */
	getAllSegments(): IngestSegmentModelReadonly[]

	/**
	 * Get the Segments of this Rundown, in order
	 */
	getOrderedSegments(): IngestSegmentModelReadonly[]

	/**
	 * Get the Parts of this Rundown, in order
	 */
	getAllOrderedParts(): IngestPartModelReadonly[]

	/**
	 * Get the Pieces in this Rundown, in no particular order
	 */
	getAllPieces(): ReadonlyDeep<Piece>[]

	findPart(partId: PartId): IngestPartModelReadonly | undefined

	findAdlibPiece(adLibPieceId: PieceId): ReadonlyDeep<AdLibPiece> | undefined

	findExpectedPackage(packageId: ExpectedPackageId): ReadonlyDeep<ExpectedPackageForIngestModel> | undefined
}

export interface IngestModel extends IngestModelReadonly, BaseModel {
	/**
	 * Get a Segment from the Rundown by `externalId`
	 * @param id Id of the Segment
	 */
	getSegmentByExternalId(externalId: string): IngestSegmentModel | undefined

	/**
	 * Get a Segment from the Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): IngestSegmentModel | undefined
	/**
	 * Get the Segments of this Rundown, in order
	 */
	getAllSegments(): IngestSegmentModel[]

	/**
	 * Get the Segments of this Rundown, in order
	 */
	getOrderedSegments(): IngestSegmentModel[]

	/**
	 * Get the Parts of this Rundown, in order
	 */
	getAllOrderedParts(): IngestPartModel[]

	findPart(partId: PartId): IngestPartModel | undefined

	removeSegment(id: SegmentId): void

	changeSegmentId(oldId: SegmentId, newId: SegmentId): void

	setExpectedPlayoutItemsForRundownBaseline(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void
	setExpectedMediaItemsForRundownBaseline(expectedMediaItems: ExpectedMediaItemRundown[]): void
	setExpectedPackagesForRundownBaseline(expectedPackages: ExpectedPackageForIngestModel[]): void

	setRundownBaseline(
		timelineObjectsBlob: PieceTimelineObjectsBlob,
		adlibPieces: RundownBaselineAdLibItem[],
		adlibActions: RundownBaselineAdLibAction[]
	): Promise<void>

	setRundownOrphaned(orphaned: RundownOrphanedReason | undefined): void

	setRundownPlaylistId(playlistId: RundownPlaylistId): void

	setRundownAirStatus(status: string | undefined): void

	appendRundownNotes(...notes: RundownNote[]): void
}
