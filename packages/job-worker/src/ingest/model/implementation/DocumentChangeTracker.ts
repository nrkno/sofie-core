import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { LazyInitialise } from '../../../lib/lazy'
import { DocumentChanges, getDocumentChanges } from './utils'

export async function generateWriteOpsForLazyDocuments<TDoc extends { _id: ProtectedString<any> }>(
	currentDocs: LazyInitialise<TDoc[]>,
	changedIds: ReadonlySet<TDoc['_id']>
): Promise<AnyBulkWriteOperation<TDoc>[]> {
	const changeTracker = new DocumentChangeTracker<TDoc>()

	if (changedIds.size > 0 || currentDocs.isLoaded()) {
		const loadedDocs = await currentDocs.get()
		changeTracker.addChanges(getDocumentChanges(changedIds, loadedDocs), false)
	}

	return changeTracker.generateWriteOps()
}

export class DocumentChangeTracker<TDoc extends { _id: ProtectedString<any> }> {
	#currentIds = new Set<TDoc['_id']>()
	#deletedIds = new Set<TDoc['_id']>()
	#documentsToSave = new Map<TDoc['_id'], TDoc>()

	#addDocumentId(id: TDoc['_id']): void {
		// if (this.#currentIds.has(id)) {
		// Future: report duplicate?
		// }
		this.#currentIds.add(id)

		if (this.#deletedIds.has(id)) {
			// It was marked for deletion elsewhere, but exists so skip deletion
			this.#deletedIds.delete(id)

			// if (!this.#documentsToSave.has(id)){
			// This is suspicious, as it already has changes, but is also marked for deletion
			// }
		}
	}

	addDocument(doc: TDoc, hasChanges: boolean): void {
		this.#addDocumentId(doc._id)

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
				this.#addDocumentId(doc._id)

				this.#documentsToSave.set(doc._id, doc)
			}
		}

		for (const id of changes.currentIds) {
			if (parentIsDeleted) {
				this.deleteDocument(id)
			} else {
				this.#addDocumentId(id)
			}
		}
	}

	generateWriteOps(): AnyBulkWriteOperation<TDoc>[] {
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

		return ops
	}
}
