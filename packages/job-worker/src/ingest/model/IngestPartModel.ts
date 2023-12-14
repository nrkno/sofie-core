import { ReadonlyDeep } from 'type-fest'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { ExpectedMediaItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageFromRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'

export interface IngestPartModelReadonly {
	/**
	 * The Part properties
	 */
	readonly part: ReadonlyDeep<DBPart>

	readonly pieces: ReadonlyDeep<Piece>[]
	readonly adLibPieces: ReadonlyDeep<AdLibPiece>[]
	readonly adLibActions: ReadonlyDeep<AdLibAction>[]

	readonly expectedMediaItems: ReadonlyDeep<ExpectedMediaItemRundown>[]
	readonly expectedPlayoutItems: ReadonlyDeep<ExpectedPlayoutItemRundown>[]
	readonly expectedPackages: ReadonlyDeep<ExpectedPackageFromRundown>[]
}
/**
 * Wrap a Part and its contents in a view for Ingest operations
 */
export interface IngestPartModel extends IngestPartModelReadonly {
	// /**
	//  * Get all the PartIds in this Segment
	//  * Sorted by the Part ranks
	//  */
	// getPartIds(): PartId[]

	// setRank(rank: number): boolean

	// setOrphaned(orphaned: SegmentOrphanedReason | undefined): void

	setInvalid(invalid: boolean): void

	setExpectedPlayoutItems(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void
	setExpectedMediaItems(expectedMediaItems: ExpectedMediaItemRundown[]): void
	setExpectedPackages(expectedPackages: ExpectedPackageFromRundown[]): void
}
