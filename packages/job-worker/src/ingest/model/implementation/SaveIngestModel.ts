import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { ExpectedMediaItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedMediaItem'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItem } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { JobContext } from '../../../jobs'
import { ExpectedPackagesStore } from './ExpectedPackagesStore'
import { IngestSegmentModelImpl } from './IngestSegmentModelImpl'
import { DocumentChanges } from './utils'

class DocumentTracker<TDoc extends { _id: ProtectedString<any> }> {
	#currentIds = new Set<TDoc['_id']>()
	#deletedIds = new Set<TDoc['_id']>()
	#documentsToSave = new Map<TDoc['_id'], TDoc>()

	addDocument(doc: TDoc, hasChanges: boolean): void {
		if (this.#currentIds.has(doc._id)) {
			// TODO - report duplicate
		}
		this.#currentIds.add(doc._id)

		if (this.#deletedIds.has(doc._id)) {
			// It was marked for deletion elsewhere, but exists so skip deletion
			this.#deletedIds.delete(doc._id)

			if (!this.#documentsToSave.has(doc._id)) {
				// TODO - warn
				// This is suspicious, as it already has changes, but is also marked for deletion
			}
		}

		if (hasChanges) {
			this.#documentsToSave.set(doc._id, doc)
		}
	}

	deleteDocument(id: TDoc['_id']): void {
		// If not reused elswehere, add for deletion
		if (!this.#currentIds.has(id) && !this.#documentsToSave.has(id)) {
			this.#deletedIds.add(id)
		}
	}

	addChanges(changes: DocumentChanges<TDoc>, parentIsDeleted: boolean): void {
		for (const id of changes.deletedIds) {
			this.deleteDocument(id)
		}

		if (!parentIsDeleted) {
			for (const doc of changes.changedDocuments) {
				// Ensure not marked for deletion
				this.#deletedIds.delete(doc._id)

				if (this.#documentsToSave.has(doc._id)) {
					// TODO - report duplicate
				}
				this.#documentsToSave.set(doc._id, doc)
			}
		}

		// TODO - refactor to use addDocument?

		// Finally
		for (const id of changes.currentIds) {
			if (parentIsDeleted) {
				this.deleteDocument(id)
			} else {
				if (this.#currentIds.has(id)) {
					// TODO - report duplicate
				}
				if (this.#deletedIds.has(id)) {
					// It was marked for deletion elsewhere, but exists so skip deletion
					this.#deletedIds.delete(id)

					if (!this.#documentsToSave.has(id)) {
						// TODO - warn
						// This is suspicious, as it was marked for deletion, but still exists and has no changes. That can't all be true, so do we have a duplicate or bug?
					}
				}
				this.#currentIds.add(id)
			}
		}
	}

	generateWriteOp(): AnyBulkWriteOperation<TDoc>[] {
		const ops: AnyBulkWriteOperation<TDoc>[] = []

		for (const doc of this.#documentsToSave) {
			ops.push({
				replaceOne: {
					filter: { _id: doc[0] },
					replacement: doc[1],
					upsert: true,
				},
			})
		}

		if (this.#deletedIds.size > 0) {
			ops.push({
				deleteMany: {
					filter: { _id: { $in: Array.from(this.#deletedIds) as any } },
				},
			})
		}

		// console.log('generated writes', ops)

		return ops
	}
}

export class SaveIngestModelHelper {
	#expectedPackages = new DocumentTracker<ExpectedPackageDB>()
	#expectedPlayoutItems = new DocumentTracker<ExpectedPlayoutItem>()
	#expectedMediaItems = new DocumentTracker<ExpectedMediaItem>()

	#segments = new DocumentTracker<DBSegment>()
	#parts = new DocumentTracker<DBPart>()
	#pieces = new DocumentTracker<Piece>()
	#adLibPieces = new DocumentTracker<AdLibPiece>()
	#adLibActions = new DocumentTracker<AdLibAction>()

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
			context.directCollections.ExpectedPackages.bulkWrite(this.#expectedPackages.generateWriteOp()),
			context.directCollections.ExpectedPlayoutItems.bulkWrite(this.#expectedPlayoutItems.generateWriteOp()),
			context.directCollections.ExpectedMediaItems.bulkWrite(this.#expectedMediaItems.generateWriteOp()),

			context.directCollections.Segments.bulkWrite(this.#segments.generateWriteOp()),
			context.directCollections.Parts.bulkWrite(this.#parts.generateWriteOp()),
			context.directCollections.Pieces.bulkWrite(this.#pieces.generateWriteOp()),
			context.directCollections.AdLibPieces.bulkWrite(this.#adLibPieces.generateWriteOp()),
			context.directCollections.AdLibActions.bulkWrite(this.#adLibActions.generateWriteOp()),
		]
	}
}
