import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import {
	clone,
	createManualPromise,
	deleteAllUndefinedProperties,
	getRandomId,
	isProtectedString,
	lazyIgnore,
	ProtectedString,
	unprotectString,
} from '../../lib/lib'
import { profiler } from '../api/profiler'
import { logger } from '../logging'
import { CustomPublish, CustomPublishChanges } from './customPublication'

interface OptimizedObserver<TData extends { _id: ProtectedString<any> }, TArgs, TContext, UpdateProps> {
	args: ReadonlyDeep<TArgs>
	context: Partial<TContext>
	lastData: TData[]
	triggerUpdate: TriggerUpdate<UpdateProps>
	stop: () => void
	dataReceivers: Array<CustomPublish<TData>>
	newDataReceivers: Array<CustomPublish<TData>>
}

/** Current fully setup optimized observers */
const optimizedObservers: Record<string, OptimizedObserver<any, unknown, unknown, unknown>> = {}
/** Setup in progress optimized observers */
const pendingObservers: Record<string, Promise<OptimizedObserver<any, unknown, unknown, unknown>>> = {}

// export interface OptimizedObserverHandle {
// 	stop: () => void
// }

export type TriggerUpdate<UpdateProps extends Record<string, any>> = (updateProps: Partial<UpdateProps>) => void

export async function setUpOptimizedObserver<
	PublicationDoc extends { _id: ProtectedString<any> },
	Args,
	State extends Record<string, any>,
	UpdateProps extends Record<string, any>
>(
	identifier: string,
	args0: ReadonlyDeep<Args>,
	setupObservers: (
		args: ReadonlyDeep<Args>,
		/** Trigger an update by mutating the context of manipulateData */
		triggerUpdate: TriggerUpdate<UpdateProps>
	) => Promise<Meteor.LiveQueryHandle[]>,
	manipulateData: (
		args: ReadonlyDeep<Args>,
		state: Partial<State>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<PublicationDoc[] | null>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	const converter = new OptimisedObserverGenericArray<PublicationDoc>()
	return setUpOptimizedObserverInner<PublicationDoc, Args, State, UpdateProps>(
		identifier,
		args0,
		setupObservers,
		async (args, state, newProps) => {
			const newDocs = await manipulateData(args, state, newProps)
			if (newDocs) {
				const changes = converter.updatedDocs(newDocs)
				return [newDocs, changes]
			} else {
				const changes: CustomPublishChanges<PublicationDoc> = {
					added: [],
					changed: [],
					removed: [],
				}
				return [converter.getDocs(), changes]
			}
		},
		receiver,
		lazynessDuration
	)
}

/**
 * This is an optimization to enable multiple listeners that observes (and manipulates) the same data, to only use one observer and manipulator,
 * then receive the result for each listener.
 *
 * @param identifier identifier, shared between the listeners that use the same observer.
 * @param setupObservers Set up the observers. This is run just 1 times for N listeners, on initialization.
 * @param manipulateData Manipulate the data. This is run 1 times for N listeners, per data update. (and on initialization). Return false if nothing has changed
 * @param receiveData Receive the manipulated data. This is run N times for N listeners, per data update (and on initialization).
 * @param lazynessDuration (Optional) How long to wait after a change before issueing an update. Default to 3 ms
 */
async function setUpOptimizedObserverInner<
	PublicationDoc extends { _id: ProtectedString<any> },
	Args,
	State extends Record<string, any>,
	UpdateProps extends Record<string, any>
>(
	identifier: string,
	args0: ReadonlyDeep<Args>,
	setupObservers: (
		args: ReadonlyDeep<Args>,
		/** Trigger an update by mutating the context of manipulateData */
		triggerUpdate: TriggerUpdate<UpdateProps>
	) => Promise<Meteor.LiveQueryHandle[]>,
	manipulateData: (
		args: ReadonlyDeep<Args>,
		state: Partial<State>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<[PublicationDoc[], CustomPublishChanges<PublicationDoc>]>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	const existingObserver = (optimizedObservers[identifier] || (await pendingObservers[identifier])) as
		| OptimizedObserver<PublicationDoc, Args, State, UpdateProps>
		| undefined

	if (existingObserver) {
		// There is an existing preparedObserver

		// Mark the received as new
		existingObserver.newDataReceivers.push(receiver)

		// Force an update to ensure the new receiver gets data soon
		existingObserver.triggerUpdate({})
	} else {
		let updateIsRunning = true

		let hasPendingUpdate = false
		let pendingUpdate: Record<string, any> = {}
		const triggerUpdate: TriggerUpdate<UpdateProps> = (updateProps) => {
			// Combine the pending updates
			pendingUpdate = {
				...pendingUpdate,
				...updateProps,
			}

			// If already running, set it as pending to be done afterwards
			if (updateIsRunning) {
				hasPendingUpdate = true
				return
			}

			// We are handling the update
			hasPendingUpdate = false

			// This could have multiple concurrent executions, but it shouldnt due to the boolean guards
			lazyIgnore(
				`optimizedObserver_${identifier}`,
				async () => {
					try {
						// Mark the update as running
						updateIsRunning = true

						const o = optimizedObservers[identifier] as OptimizedObserver<
							PublicationDoc,
							Args,
							State,
							UpdateProps
						>
						if (o) {
							// Fetch and clear the pending updates
							const newProps = pendingUpdate as ReadonlyDeep<Partial<UpdateProps>>
							pendingUpdate = {}

							const start = Date.now()
							const [newDocs, changes] = await manipulateData(o.args, o.context, newProps)
							const manipulateTime = Date.now()
							const manipulateDuration = manipulateTime - start

							const hasChanges =
								changes.added.length > 0 || changes.changed.length > 0 || changes.removed.length > 0

							// If result === null, that means no changes were made
							if (hasChanges) {
								for (const dataReceiver of o.dataReceivers) {
									dataReceiver.changed(changes)
								}
								o.lastData = newDocs
							}
							if (o.newDataReceivers.length) {
								const newDataReceivers = o.newDataReceivers
								// Move to 'active' receivers
								o.dataReceivers.push(...newDataReceivers)
								o.newDataReceivers = []
								// send initial data
								for (const dataReceiver of newDataReceivers) {
									dataReceiver.init(o.lastData)
								}
							}

							const publishTime = Date.now() - manipulateTime
							const totalTime = Date.now() - start

							/** Limit for what to consider a slow observer */
							const SLOW_OBSERVE_TIME = 50 // ms

							if (totalTime > SLOW_OBSERVE_TIME) {
								logger.debug(
									`Slow optimized observer ${identifier}. Total: ${totalTime}, manipulate: ${manipulateDuration}, publish: ${publishTime} (receivers: ${o.dataReceivers.length})`
								)
							}
						}
					} finally {
						// Update has finished, check if another needs to be performed
						updateIsRunning = false

						if (hasPendingUpdate) {
							// There is another pending update, make sure it gets executed asap
							Meteor.defer(() => {
								triggerUpdate({})
							})
						}
					}
				},
				lazynessDuration // ms
			)
		}

		// use pendingObservers, to ensure a second doesnt get created in parallel
		const manualPromise = createManualPromise<OptimizedObserver<any, unknown, unknown, unknown>>()
		pendingObservers[identifier] = manualPromise
		manualPromise.catch(() => {
			// Ensure it doesn't go uncaught
		})

		try {
			const args = clone<ReadonlyDeep<Args>>(args0)
			const observers = await setupObservers(args, triggerUpdate)

			const newObserver: OptimizedObserver<PublicationDoc, Args, State, UpdateProps> = {
				args: args,
				context: {},
				lastData: [],
				triggerUpdate: triggerUpdate,
				stop: () => {
					observers.forEach((observer) => observer.stop())
				},
				dataReceivers: [receiver],
				newDataReceivers: [],
			}

			// Do the intial data load and emit
			const [result] = await manipulateData(args, newObserver.context, undefined)
			newObserver.lastData = result
			receiver.init(newObserver.lastData)
			updateIsRunning = false

			if (hasPendingUpdate) {
				// An update is pending, let it be executed once the final observer is stored
				Meteor.defer(() => {
					triggerUpdate({})
				})
			}

			// Observer is now ready for all to use
			const newObserver2 = newObserver as OptimizedObserver<any, unknown, unknown, unknown>
			optimizedObservers[identifier] = newObserver2
			manualPromise.manualResolve(newObserver2)
		} catch (e: any) {
			manualPromise.manualReject(e)
		} finally {
			// Make sure to not leave it pending forever
			delete pendingObservers[identifier]
		}
	}

	receiver.onStop(() => {
		const o = optimizedObservers[identifier] as OptimizedObserver<PublicationDoc, Args, State, UpdateProps>
		if (o) {
			const i = o.dataReceivers.indexOf(receiver)
			if (i != -1) {
				o.dataReceivers.splice(i, 1)
			}
			// clean up if empty:
			if (!o.dataReceivers.length) {
				delete optimizedObservers[identifier]
				o.stop()
			}
		}
	})
}

export interface PreparedPublicationChanges<T extends { _id: ProtectedString<any> }> {
	added: T[]
	changed: T[]
	removed: T['_id'][]
}

class OptimisedObserverGenericArray<DBObj extends { _id: ProtectedString<any> }> {
	#docs = new Map<DBObj['_id'], DBObj>()
	// #firstRun: boolean = true

	// public get isFirstRun(): boolean {
	// 	return this.#firstRun
	// }

	getDocs(): DBObj[] {
		return Array.from(this.#docs.values())
	}

	updatedDocs(newDocs: DBObj[]): PreparedPublicationChanges<DBObj> {
		const changes: PreparedPublicationChanges<DBObj> = {
			added: [],
			changed: [],
			removed: [],
		}

		const newIds = new Set<DBObj['_id']>()
		// figure out which documents have changed

		const oldIds = Array.from(this.#docs.keys())

		for (const newDoc0 of newDocs) {
			const id = newDoc0._id
			if (newIds.has(id)) {
				throw new Meteor.Error(`Error in custom publication: _id "${id}" is not unique!`)
			}
			newIds.add(id)

			const oldDoc = this.#docs.get(id)
			if (!oldDoc) {
				const newDoc = clone(newDoc0)

				// added
				this.#docs.set(id, newDoc)
				changes.added.push(newDoc)
			} else if (!_.isEqual(oldDoc, newDoc0)) {
				const newDoc = clone(newDoc0)

				// changed
				changes.changed.push(newDoc)
				this.#docs.set(id, newDoc)
			}
		}

		for (const id of oldIds) {
			if (!newIds.has(id)) {
				// Removed
				this.#docs.delete(id)
				changes.removed.push(id)
			}
		}

		// if (this.#firstRun) {
		// 	this.#firstRun = false
		// }

		return changes
	}
}

export async function setUpManualOptimizedObserver<
	PublicationDoc extends { _id: ProtectedString<any> },
	Args,
	State extends Record<string, any>,
	UpdateProps extends Record<string, any>
>(
	identifier: string,
	args0: ReadonlyDeep<Args>,
	setupObservers: (
		args: ReadonlyDeep<Args>,
		/** Trigger an update by mutating the context of manipulateData */
		triggerUpdate: TriggerUpdate<UpdateProps>
	) => Promise<Meteor.LiveQueryHandle[]>,
	manipulateData: (
		args: ReadonlyDeep<Args>,
		state: Partial<State>,
		collection: CustomPublishCollection<PublicationDoc>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<void>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	const collection = new CustomPublishCollection<PublicationDoc>(identifier)
	return setUpOptimizedObserverInner<PublicationDoc, Args, State, UpdateProps>(
		identifier,
		args0,
		setupObservers,
		async (args, state, newProps) => {
			await manipulateData(args, state, collection, newProps)
			return collection.commitChanges()
		},
		receiver,
		lazynessDuration
	)
}

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
