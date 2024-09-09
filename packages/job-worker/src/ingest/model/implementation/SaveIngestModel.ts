import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { JobContext } from '../../../jobs'
import { ExpectedPackagesStore } from './ExpectedPackagesStore'
import { IngestSegmentModelImpl } from './IngestSegmentModelImpl'
import { DocumentChangeTracker } from './DocumentChangeTracker'

export class SaveIngestModelHelper {
	#expectedPackages = new DocumentChangeTracker<ExpectedPackageDB>()
	#expectedPlayoutItems = new DocumentChangeTracker<ExpectedPlayoutItem>()
	#expectedMediaItems = new DocumentChangeTracker<ExpectedMediaItem>()

	#segments = new DocumentChangeTracker<DBSegment>()
	#parts = new DocumentChangeTracker<DBPart>()
	#pieces = new DocumentChangeTracker<Piece>()
	#adLibPieces = new DocumentChangeTracker<AdLibPiece>()
	#adLibActions = new DocumentChangeTracker<AdLibAction>()

	addExpectedPackagesStore(
		store: ExpectedPackagesStore<ExpectedPackageDB & { rundownId: RundownId }>,
		deleteAll?: boolean
	): void {
		this.#expectedPackages.addChanges(store.expectedPackagesChanges, deleteAll ?? false)
		this.#expectedPlayoutItems.addChanges(store.expectedPlayoutItemsChanges, deleteAll ?? false)
		this.#expectedMediaItems.addChanges(store.expectedMediaItemsChanges, deleteAll ?? false)
	}
	addSegment(segment: IngestSegmentModelImpl, segmentIsDeleted: boolean): void {
		if (segmentIsDeleted) {
			this.#segments.deleteDocument(segment.segment._id)
		} else {
			this.#segments.addDocument(segment.segmentImpl, segment.segmentHasChanges)
		}

		for (const part of segment.partsImpl.values()) {
			const partIsDeleted = segmentIsDeleted || part.deleted
			if (partIsDeleted) {
				this.#parts.deleteDocument(part.partModel.part._id)
			} else {
				this.#parts.addDocument(part.partModel.partImpl, part.partModel.partHasChanges)
			}

			this.addExpectedPackagesStore(part.partModel.expectedPackagesStore, partIsDeleted)

			this.#pieces.addChanges(part.partModel.piecesChanges, partIsDeleted)
			this.#adLibPieces.addChanges(part.partModel.adLibPiecesChanges, partIsDeleted)
			this.#adLibActions.addChanges(part.partModel.adLibActionsChanges, partIsDeleted)
		}
	}

	commit(context: JobContext): Array<Promise<unknown>> {
		return [
			context.directCollections.ExpectedPackages.bulkWrite(this.#expectedPackages.generateWriteOps()),
			context.directCollections.ExpectedPlayoutItems.bulkWrite(this.#expectedPlayoutItems.generateWriteOps()),
			context.directCollections.ExpectedMediaItems.bulkWrite(this.#expectedMediaItems.generateWriteOps()),

			context.directCollections.Segments.bulkWrite(this.#segments.generateWriteOps()),
			context.directCollections.Parts.bulkWrite(this.#parts.generateWriteOps()),
			context.directCollections.Pieces.bulkWrite(this.#pieces.generateWriteOps()),
			context.directCollections.AdLibPieces.bulkWrite(this.#adLibPieces.generateWriteOps()),
			context.directCollections.AdLibActions.bulkWrite(this.#adLibActions.generateWriteOps()),
		]
	}
}
