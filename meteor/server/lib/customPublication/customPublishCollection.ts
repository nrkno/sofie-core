import { getRandomId, deleteAllUndefinedProperties, clone } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, isProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { profiler } from '../../api/profiler'
import { CustomPublishChanges } from './publish'

type SelectorFunction<TDoc extends { _id: ProtectedString<any> }> = (doc: TDoc) => boolean
type CustomPublishCollectionDocument<TDoc> = {
	inserted?: boolean
	updated?: boolean

	document: TDoc
} | null // removed

/** Caches data, allowing reads from cache, but not writes */
export class CustomPublishCollection<TDoc extends { _id: ProtectedString<any> }> {
	documents = new Map<TDoc['_id'], CustomPublishCollectionDocument<TDoc>>()
	protected originalDocuments: ReadonlyDeep<Array<TDoc>> = []

	constructor(private readonly name: string) {}

	/**
	 * Find documents matching a criteria
	 * @param selector selector function to match documents, or null to fetch all documents
	 * @param options
	 * @returns The matched documents
	 */
	findAll(selector: SelectorFunction<TDoc> | null): TDoc[] {
		const span = profiler.startSpan(`DBCache.findAll.${this.name}`)

		const results: TDoc[] = []
		this.documents.forEach((doc, _id) => {
			if (doc === null) return
			if (selector === null || selector(doc.document)) {
				if (doc.document['_id'] !== _id) {
					throw new Error(`Error: document._id "${doc.document['_id']}" is not equal to the key "${_id}"`)
				}
				results.push(doc.document)
			}
		})

		if (span) span.end()
		return results
	}

	/**
	 * Find a single document
	 * @param selector Id or selector function
	 * @param options
	 * @returns The first matched document, if any
	 */
	findOne(selector: TDoc['_id'] | SelectorFunction<TDoc>): TDoc | undefined {
		if (isProtectedString(selector)) {
			const span = profiler.startSpan(`DBCache.findOne.${this.name}`)
			const doc = this.documents.get(selector)
			if (doc) {
				if (span) span.end()
				return doc.document
			} else {
				return undefined
			}
		} else {
			return this.findAll(selector)[0]
		}
	}

	insert(doc: TDoc): TDoc['_id'] {
		const span = profiler.startSpan(`DBCache.insert.${this.name}`)

		const existing = doc._id && this.documents.get(doc._id)
		if (existing) {
			throw new Error(`Error in cache insert to "${this.name}": _id "${doc._id}" already exists`)
		}
		if (!doc._id) doc._id = getRandomId()
		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		this.documents.set(doc._id, {
			inserted: existing !== null,
			updated: existing === null,
			document: newDoc,
		})
		if (span) span.end()
		return doc._id
	}
	remove(selector: TDoc['_id'] | SelectorFunction<TDoc> | null): Array<TDoc['_id']> {
		const span = profiler.startSpan(`DBCache.remove.${this.name}`)

		const removedIds: TDoc['_id'][] = []
		if (isProtectedString(selector)) {
			if (this.documents.get(selector)) {
				this.documents.set(selector, null)
				removedIds.push(selector)
			}
		} else {
			const docsToRemove = this.findAll(selector)
			for (const doc of docsToRemove) {
				removedIds.push(doc._id)
				this.documents.set(doc._id, null)
			}
		}

		if (span) span.end()
		return removedIds
	}

	/**
	 * Update a single document
	 * @param selector Id of the document to update
	 * @param modifier The modifier to apply to the document. Return false to report the document as unchanged
	 * @param forceUpdate If true, the diff will be skipped and the document will be marked as having changed if the modifer returned a doc
	 * @returns The id of the updated document, if it was updated
	 */
	updateOne(
		selector: TDoc['_id'],
		modifier: (doc: TDoc) => TDoc | false,
		forceUpdate?: boolean
	): TDoc['_id'] | undefined {
		const span = profiler.startSpan(`DBCache.update.${this.name}`)

		if (!isProtectedString(selector)) throw new Error('DBCacheCollection.update expects an id as the selector')

		const doc = this.documents.get(selector)

		let result: TDoc['_id'] | undefined
		if (doc) {
			const _id = doc.document._id

			const newDoc = modifier(clone(doc.document))
			if (newDoc) {
				if (newDoc._id !== _id) {
					throw new Error(
						`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
					)
				}

				// ensure no properties are 'undefined'
				deleteAllUndefinedProperties(newDoc)

				const docEntry = this.documents.get(_id)
				if (!docEntry) {
					throw new Error(
						`Error: Trying to update a document "${newDoc._id}", that went missing half-way through!`
					)
				}

				const hasPendingChanges = docEntry.inserted || docEntry.updated // If the doc is already dirty, then there is no point trying to diff it
				if (forceUpdate || hasPendingChanges || !_.isEqual(doc, newDoc)) {
					docEntry.document = newDoc
					docEntry.updated = true
				}
				result = _id
			}
		}

		if (span) span.end()
		return result
	}

	/**
	 * Update multiple documents
	 * @param modifier The modifier to apply to all the documents. Return false to report a document as unchanged
	 * @param forceUpdate If true, the diff will be skipped and the document will be marked as having changed
	 * @returns All the ids that were changed
	 */
	updateAll(modifier: (doc: TDoc) => TDoc | false, forceUpdate?: boolean): Array<TDoc['_id']> {
		const span = profiler.startSpan(`DBCache.updateAll.${this.name}`)

		const changedIds: Array<TDoc['_id']> = []
		this.documents.forEach((doc, _id) => {
			if (doc === null) return
			const newDoc: TDoc | false = modifier(clone(doc.document))
			if (newDoc === false) {
				// Function reports no change
				return
			}

			if (newDoc._id !== _id) {
				throw new Error(
					`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
				)
			}

			// ensure no properties are 'undefined'
			deleteAllUndefinedProperties(newDoc)

			const docEntry = this.documents.get(_id)
			if (!docEntry) {
				throw new Error(
					`Error: Trying to update a document "${newDoc._id}", that went missing half-way through!`
				)
			}

			const hasPendingChanges = docEntry.inserted || docEntry.updated // If the doc is already dirty, then there is no point trying to diff it
			if (forceUpdate || hasPendingChanges || !_.isEqual(doc, newDoc)) {
				docEntry.document = newDoc
				docEntry.updated = true

				changedIds.push(_id)
			}
		})

		if (span) span.end()
		return changedIds
	}

	/** Returns true if a doc was replace, false if inserted */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): boolean {
		const span = profiler.startSpan(`DBCache.replace.${this.name}`)
		span?.addLabels({ id: unprotectString(doc._id) })

		if (!doc._id) throw new Error(`Error: The (immutable) field '_id' must be defined: "${doc._id}"`)
		const _id = doc._id

		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		const oldDoc = this.documents.get(_id)
		if (oldDoc) {
			oldDoc.updated = true
			oldDoc.document = newDoc
		} else {
			this.documents.set(_id, {
				inserted: true,
				document: newDoc,
			})
		}

		if (span) span.end()
		return !!oldDoc
	}

	/** Commit the changes, by computing and returning the changes that need to be sent to subscribers */
	commitChanges(): [TDoc[], CustomPublishChanges<TDoc>] {
		const span = profiler.startSpan(`DBCache.updateDatabaseWithData.${this.name}`)
		const changes: CustomPublishChanges<TDoc> = {
			added: [],
			changed: [],
			removed: [],
		}
		const allDocs: TDoc[] = []

		const removedDocs: TDoc['_id'][] = []
		this.documents.forEach((doc, id) => {
			if (doc === null) {
				removedDocs.push(id)
				changes.removed.push(id)
			} else {
				allDocs.push(doc.document)

				if (doc.inserted) {
					changes.added.push(doc.document)
				} else if (doc.updated) {
					changes.changed.push(doc.document)
				}
				delete doc.inserted
				delete doc.updated
			}
		})

		for (const id of removedDocs) {
			this.documents.delete(id)
		}

		if (span) span.end()
		return [allDocs, changes]
	}
}