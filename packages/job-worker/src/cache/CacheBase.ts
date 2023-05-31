import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { DbCacheReadCollection, DbCacheWriteCollection } from './CacheCollection'
import { DbCacheReadObject, DbCacheWriteObject, DbCacheWriteOptionalObject } from './CacheObject'
import { isDbCacheWritable } from './lib'
import { anythingChanged, sumChanges } from '../db/changes'
import { IS_PRODUCTION } from '../environment'
import { logger } from '../logging'
import { sleep } from '@sofie-automation/corelib/dist/lib'
import { JobContext } from '../jobs'
import { IMongoTransaction } from '../db'

type DeferredFunction<Cache> = (cache: Cache) => void | Promise<void>
type DeferredAfterSaveFunction<Cache extends CacheBase<any>> = (cache: ReadOnlyCache<Cache>) => void | Promise<void>

type DeferredDuringSaveTransactionFunction<Cache extends CacheBase<any>> = (
	transaction: IMongoTransaction,
	cache: ReadOnlyCache<Cache>
) => void | Promise<void>

type DbCacheWritable<TDoc extends { _id: ProtectedString<any> }> =
	| DbCacheWriteCollection<TDoc>
	| DbCacheWriteObject<TDoc>
	| DbCacheWriteOptionalObject<TDoc>

export type ReadOnlyCacheInner<T> = T extends DbCacheWriteCollection<infer A>
	? DbCacheReadCollection<A>
	: T extends DbCacheWriteObject<infer A>
	? DbCacheReadObject<A>
	: T extends DbCacheWriteOptionalObject<infer A>
	? DbCacheReadObject<A, true>
	: T

export type ReadOnlyCache<T extends CacheBase<any>> = Omit<
	{ [K in keyof T]: ReadOnlyCacheInner<T[K]> },
	'defer' | 'deferAfterSave' | 'saveAllToDatabase'
>

/** This cache contains data relevant in a studio */
export abstract class ReadOnlyCacheBase<T extends ReadOnlyCacheBase<never>> {
	protected _deferredBeforeSaveFunctions: DeferredFunction<T>[] = []
	protected _deferredAfterSaveFunctions: DeferredAfterSaveFunction<any>[] = []
	protected _deferredDuringSaveTransactionFunctions: DeferredDuringSaveTransactionFunction<any>[] = []

	constructor(protected readonly context: JobContext) {
		context.trackCache(this)
	}

	abstract DisplayName: string

	private getAllCollections() {
		const highPrioDBs: DbCacheWritable<any>[] = []
		const lowPrioDBs: DbCacheWritable<any>[] = []

		for (const [key, db0] of Object.entries<any>(this)) {
			let db = db0
			if (db && typeof db === 'object' && 'getIfLoaded' in db) {
				// If wrapped in a lazy
				db = db.getIfLoaded()
			}
			if (db && isDbCacheWritable(db)) {
				if (key.match(/timeline/i)) {
					highPrioDBs.push(db)
				} else {
					lowPrioDBs.push(db)
				}
			}
		}

		return {
			allDBs: [...highPrioDBs, ...lowPrioDBs],
			highPrioDBs,
			lowPrioDBs,
		}
	}

	async saveAllToDatabase(existingTransaction?: IMongoTransaction | null): Promise<void> {
		const span = this.context.startSpan('Cache.saveAllToDatabase')

		// Execute cache.deferBeforeSave()'s
		for (const fn of this._deferredBeforeSaveFunctions) {
			await fn(this as any)
		}
		this._deferredBeforeSaveFunctions.length = 0 // clear the array

		const { highPrioDBs, lowPrioDBs } = this.getAllCollections()

		const performSave = async (transaction: IMongoTransaction) => {
			if (highPrioDBs.length) {
				const anyThingChanged = anythingChanged(
					sumChanges(
						...(await Promise.all(highPrioDBs.map(async (db) => db.updateDatabaseWithData(transaction))))
					)
				)
				if (anyThingChanged && !process.env.JEST_WORKER_ID) {
					// Wait a little bit before saving the rest.
					// The idea is that this allows for the high priority publications to update (such as the Timeline),
					// sending the updated timeline to Playout-gateway
					await sleep(2)
				}
			}

			if (lowPrioDBs.length) {
				await Promise.all(lowPrioDBs.map(async (db) => db.updateDatabaseWithData(transaction)))
			}

			// Execute cache.deferDuringSaveTransaction()'s
			for (const fn of this._deferredDuringSaveTransactionFunctions) {
				await fn(transaction, this as any)
			}
			this._deferredDuringSaveTransactionFunctions.length = 0 // clear the array
		}

		if (existingTransaction) {
			await performSave(existingTransaction)
		} else {
			await this.context.directCollections.runInTransaction(async (transaction) => performSave(transaction))
		}

		// Execute cache.deferAfterSave()'s
		for (const fn of this._deferredAfterSaveFunctions) {
			await fn(this as any)
		}
		this._deferredAfterSaveFunctions.length = 0 // clear the array

		if (span) span.end()
	}

	/**
	 * Discard all changes to documents in the cache.
	 * This essentially acts as rolling back this transaction, and lets the cache be reused for another operation instead
	 */
	discardChanges(): void {
		const { allDBs } = this.getAllCollections()
		for (const coll of allDBs) {
			coll.discardChanges()
		}

		// Discard any hooks too
		this._deferredAfterSaveFunctions.length = 0
		this._deferredDuringSaveTransactionFunctions.length = 0
		this._deferredBeforeSaveFunctions.length = 0
	}

	/**
	 * Discards all documents in this cache, and marks it as unusable
	 */
	dispose(): void {
		const { allDBs } = this.getAllCollections()
		for (const coll of allDBs) {
			coll.dispose()
		}

		// Discard any hooks too
		this._deferredAfterSaveFunctions.length = 0
		this._deferredDuringSaveTransactionFunctions.length = 0
		this._deferredBeforeSaveFunctions.length = 0
	}

	/** Inform all the collections of the intention for the Cache to be removed. The collections are emptied and marked to reject any further updates */
	protected markCollectionsForRemoval(): void {
		const { allDBs } = this.getAllCollections()
		for (const coll of allDBs) {
			coll.markForRemoval()
		}
	}

	/**
	 * Assert that no changes should have been made to the cache, will throw an Error otherwise. This can be used in
	 * place of `saveAllToDatabase()`, when the code controlling the cache expects no changes to have been made and any
	 * changes made are an error and will cause issues.
	 */
	assertNoChanges(): void {
		const span = this.context.startSpan('Cache.assertNoChanges')

		function logOrThrowError(error: Error) {
			if (!IS_PRODUCTION) {
				throw error
			} else {
				logger.error(error)
			}
		}

		const { allDBs } = this.getAllCollections()

		if (this._deferredBeforeSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in cache assertion, there were ${this._deferredBeforeSaveFunctions.length} deferred functions`
				)
			)

		if (this._deferredDuringSaveTransactionFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in cache assertion, there were ${this._deferredDuringSaveTransactionFunctions.length} during save transaction deferred functions`
				)
			)

		if (this._deferredAfterSaveFunctions.length > 0)
			logOrThrowError(
				new Error(
					`Failed no changes in cache assertion, there were ${this._deferredAfterSaveFunctions.length} after-save deferred functions`
				)
			)

		for (const db of allDBs) {
			if (db.isModified()) {
				logOrThrowError(
					new Error(`Failed no changes in cache assertion, cache was modified: collection: ${db.name}`)
				)
			}
		}

		if (span) span.end()
	}

	hasChanges(): boolean {
		const { allDBs } = this.getAllCollections()

		if (this._deferredBeforeSaveFunctions.length > 0) {
			logger.silly(`hasChanges: _deferredBeforeSaveFunctions.length=${this._deferredBeforeSaveFunctions.length}`)
			return true
		}

		if (this._deferredDuringSaveTransactionFunctions.length > 0) {
			logger.silly(
				`hasChanges: _deferredDuringSaveTransactionFunctions.length=${this._deferredDuringSaveTransactionFunctions.length}`
			)
			return true
		}

		if (this._deferredAfterSaveFunctions.length > 0) {
			logger.silly(`hasChanges: _deferredAfterSaveFunctions.length=${this._deferredAfterSaveFunctions.length}`)
			return true
		}

		for (const db of allDBs) {
			if (db.isModified()) {
				logger.silly(`hasChanges: db=${db.name}`)
				return true
			}
		}

		return false
	}
}

export abstract class CacheBase<T extends CacheBase<any>> extends ReadOnlyCacheBase<T> {
	/**
	 * Defer provided function to be run just before cache.saveAllToDatabase()
	 */
	deferBeforeSave(fcn: DeferredFunction<T>): void {
		this._deferredBeforeSaveFunctions.push(fcn)
	}

	/**
	 * Defer provided function to be run during cache.saveAllToDatabase(), as part of the save transaction
	 */
	deferDuringSaveTransaction(fcn: DeferredDuringSaveTransactionFunction<T>): void {
		this._deferredDuringSaveTransactionFunctions.push(fcn)
	}

	/**
	 * Defer provided function to after cache.saveAllToDatabase().
	 * Note that at the time of execution, the cache is not mutable.
	 */
	deferAfterSave(fcn: DeferredAfterSaveFunction<T>): void {
		this._deferredAfterSaveFunctions.push(fcn)
	}
}
