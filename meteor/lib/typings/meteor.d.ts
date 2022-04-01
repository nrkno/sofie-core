/* eslint-disable @typescript-eslint/no-unused-vars */
import { Mongo } from 'meteor/mongo'
import { Tracker } from 'meteor/tracker'
import { ProtectedString } from '../lib'
import { Meteor } from 'meteor/meteor'
import type {
	Collection as RawCollection,
	Condition as RawCondition,
	Filter as RawFilter,
	MongoUpdateFilter as RawMongoUpdateFilter,
} from 'mongodb'

// This is a copy of the type used in the Users collection,
// to avoid nasty dependencies
/** A string, identifying a User */
export type UserId = ProtectedString<'UserId'>

// Note: This file is temporary, we should make a PR to @typings/meteor later on!

export type SortSpecifier<T> = {
	[P in keyof T]?: -1 | 1
}

// From Meteor docs: It is not possible to mix inclusion and exclusion styles: the keys must either be all 1 or all 0
export type MongoFieldSpecifierOnes<T> = {
	[P in keyof T]?: 1
}
export type MongoFieldSpecifierZeroes<T> = {
	[P in keyof T]?: 0
}
export type MongoFieldSpecifier<T> = MongoFieldSpecifierOnes<T> | MongoFieldSpecifierZeroes<T>

export type IndexSpecifier<T> = {
	[P in keyof T]?: -1 | 1 | string
}

export interface FindOneOptions<DBInterface> {
	/** Sort order (default: natural order) */
	sort?: SortSpecifier
	/** Number of results to skip at the beginning */
	skip?: number
	/** @deprecated Dictionary of fields to return or exclude. */
	fields?: MongoFieldSpecifier<TRawDoc>
	/** Dictionary of fields to return or exclude. */
	projection?: MongoFieldSpecifier<TRawDoc>
	/** (Client only) Default `true`; pass `false` to disable reactivity */
	reactive?: boolean
	/** Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation. */
	//  transform?: Transform<TRawDoc, TDoc>;
	/** (Server only) Specifies a custom MongoDB readPreference for this particular cursor. Possible values are primary, primaryPreferred, secondary, secondaryPreferred and nearest. */
	readPreference?: string
}
export interface FindOptions<DBInterface> extends FindOneOptions<DBInterface> {
	/** Maximum number of results to return */
	limit?: number
	/** (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to observe on this query. Disabling the oplog can be useful when working with data that updates in large batches. */
	disableOplog?: boolean
	/** (Server only) When oplog is disabled (through the use of disableOplog or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds). */
	pollingIntervalMs?: number
	/** (Server only) When oplog is disabled (through the use of disableOplog or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms. */
	pollingThrottleMs?: number
	/** (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error. */
	maxTimeMs?: number
	/** (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify { $natural : 1 } to force a forwards collection scan, or { $natural : -1 } for a reverse collection scan. Setting this is only recommended for advanced users. */
	hint?: string | object
}
export interface UpdateOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
	/** True to insert a document if no matching documents are found. */
	upsert?: boolean
	/**
	 * Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to
	 * modify in an array field.
	 */
	arrayFilters?: { [identifier: string]: any }[]
}
export interface UpsertOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
}

/** Mongo Selector. Contains everything that can be sent into collection.find(selector) */
export type MongoSelector<DBInterface> = RawFilter<DBInterface>
/**
 * Subset of MongoSelector, only allows direct queries, not QueryWithModifiers such as $explain etc.
 * Used for simplified expressions (ie not using $and, $or etc..)
 * */
export type MongoQuery<DBInterface> = RawFilter<DBInterface>
export type MongoQueryKey<T> = RawCondition<T> // Allowed properties in a Mongo.Query
export type MongoModifier<DBInterface> = RawMongoUpdateFilter<DBInterface>

export interface Mongocursor<DBInterface extends { _id: ProtectedString<any> }>
	extends Omit<Mongo.Cursor<DBInterface>, 'observe' | 'observeChanges'> {
	observe(callbacks: ObserveCallbacks<DBInterface>): Meteor.LiveQueryHandle
	observeChanges(callbacks: ObserveChangesCallbacks<DBInterface>): Meteor.LiveQueryHandle
}
export interface ObserveCallbacks<DBInterface> {
	added?(document: DBInterface): void
	addedAt?(document: DBInterface, atIndex: number, before: DBInterface): void
	changed?(newDocument: DBInterface, oldDocument: DBInterface): void
	changedAt?(newDocument: DBInterface, oldDocument: DBInterface, indexAt: number): void
	removed?(oldDocument: DBInterface): void
	removedAt?(oldDocument: DBInterface, atIndex: number): void
	movedTo?(document: DBInterface, fromIndex: number, toIndex: number, before: Object): void
}
export interface ObserveChangesCallbacks<DBInterface extends { _id: ProtectedString<any> }> {
	added?(id: DBInterface['_id'], fields: Object): void
	addedBefore?(id: DBInterface['_id'], fields: Object, before: Object): void
	changed?(id: DBInterface['_id'], fields: Object): void
	movedBefore?(id: DBInterface['_id'], before: Object): void
	removed?(id: DBInterface['_id']): void
}
export type FieldNames<DBInterface> = (keyof DBInterface)[]

export interface TransformedCollection<Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }> {
	allow(options: {
		insert?: (userId: UserId, doc: DBInterface) => boolean
		update?: (userId: UserId, doc: DBInterface, fieldNames: FieldNames<DBInterface>, modifier: any) => boolean
		remove?: (userId: UserId, doc: DBInterface) => boolean
		fetch?: string[]
		transform?: Function
	}): boolean
	deny(options: {
		insert?: (userId: UserId, doc: DBInterface) => boolean
		update?: (userId: UserId, doc: DBInterface, fieldNames: string[], modifier: any) => boolean
		remove?: (userId: UserId, doc: DBInterface) => boolean
		fetch?: string[]
		transform?: Function
	}): boolean
	find(
		selector?: MongoSelector<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Mongocursor<Class>
	findOne(
		selector?: MongoSelector<DBInterface> | DBInterface['_id'],
		options?: Omit<FindOptions<DBInterface>, 'limit'>
	): Class | undefined
	insert(doc: DBInterface /*, callback?: Function*/): DBInterface['_id']
	rawCollection(): RawCollection<DBInterface>
	rawDatabase(): any
	remove(selector: MongoSelector<DBInterface> | DBInterface['_id'] /*, callback?: Function*/): number
	update(
		selector: MongoSelector<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
		/*callback?: Function*/
	): number
	upsert(
		selector: MongoSelector<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
		/*callback?: Function*/
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	}
	_ensureIndex(
		keys: IndexSpecifier<DBInterface> | string,
		options?: {
			[key: string]: any
		}
	): void

	_dropIndex(
		keys:
			| {
					[key: string]: number | string
			  }
			| string
	): void
}
