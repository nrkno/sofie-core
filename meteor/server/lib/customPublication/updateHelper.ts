import { MongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AsyncMongoCollection } from '../../../lib/collections/lib'
import { MongoQuery } from '../../../lib/typings/meteor'

export interface UpdateGenericCacheResult<
	TId extends ProtectedString<any>,
	TRawDoc extends { _id: TId },
	TFields extends keyof TRawDoc
> {
	isNew: boolean
	newCache: Map<TId, Pick<TRawDoc, TFields>>
	addedDocIds: TId[]
	changedDocIds: TId[]
	removedDocIds: TId[]
}

export async function updateGenericCache<
	TId extends ProtectedString<any>,
	TRawDoc extends { _id: TId },
	TFields extends keyof TRawDoc
>(
	dbCollection: AsyncMongoCollection<TRawDoc>,
	existingMap: Map<TId, Pick<TRawDoc, TFields>> | undefined,
	baseQuery: MongoQuery<TRawDoc>,
	projection: MongoFieldSpecifier<TRawDoc>,
	changedIds: TId[] | undefined,
	docChanged?: (oldDoc: Pick<TRawDoc, TFields> | undefined, newDoc: Pick<TRawDoc, TFields> | undefined) => void
): Promise<UpdateGenericCacheResult<TId, TRawDoc, TFields>> {
	if (!existingMap) {
		// Ensure the map exists

		const newMap = new Map<TId, Pick<TRawDoc, TFields>>()
		const addedDocIds = await addDocsForQueryToDocMap(dbCollection, newMap, baseQuery, projection, docChanged)

		return {
			isNew: true,
			newCache: newMap,
			addedDocIds,
			changedDocIds: [],
			removedDocIds: [],
		}
	}

	const addedDocIds: TId[] = []
	const changedDocIds: TId[] = []
	const removedDocIds: TId[] = []

	if (changedIds && changedIds.length > 0) {
		const fetchedDocIds = new Set<TId>()

		const docs = (await dbCollection.findFetchAsync(
			{ ...baseQuery, _id: { $in: changedIds } },
			{ projection: projection }
		)) as Pick<TRawDoc, TFields | '_id'>[]

		for (const doc of docs) {
			const existing = existingMap.get(doc._id)

			if (docChanged) docChanged(existing, doc)

			existingMap.set(doc._id, doc)
			fetchedDocIds.add(doc._id)

			if (existing) {
				changedDocIds.push(doc._id)
			} else {
				addedDocIds.push(doc._id)
			}
		}

		// Remove them from the cache, so that we detect deletions
		for (const id of changedIds) {
			if (!fetchedDocIds.has(id)) {
				const existing = existingMap.get(id)
				if (existing) {
					if (docChanged) docChanged(existing, undefined)

					existingMap.delete(id)
					removedDocIds.push(id)
				}
			}
		}
	}

	return {
		isNew: false,
		newCache: existingMap,
		addedDocIds,
		changedDocIds,
		removedDocIds,
	}
}

export async function addDocsForQueryToDocMap<
	TId extends ProtectedString<any>,
	TRawDoc extends { _id: TId },
	TFields extends keyof TRawDoc
>(
	dbCollection: AsyncMongoCollection<TRawDoc>,
	docMap: Map<TId, Pick<TRawDoc, TFields>>,
	query: MongoQuery<TRawDoc>,
	projection: MongoFieldSpecifier<TRawDoc>,
	docChanged?: (oldDoc: Pick<TRawDoc, TFields> | undefined, newDoc: Pick<TRawDoc, TFields> | undefined) => void
) {
	const docs = (await dbCollection.findFetchAsync(query, { projection: projection })) as Pick<
		TRawDoc,
		TFields | '_id'
	>[]

	const addedDocIds: TId[] = []

	for (const doc of docs) {
		const existing = docMap.get(doc._id)

		if (docChanged) docChanged(existing, doc)

		docMap.set(doc._id, doc)
		addedDocIds.push(doc._id)
	}

	return addedDocIds
}
