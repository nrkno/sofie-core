import { Mongo } from 'meteor/mongo'
import { Tracker } from 'meteor/tracker'
import { Omit, ProtectedString } from '../lib'

declare module 'meteor/tracker' {
	namespace Tracker {
		// Fix an incomplete definition of Tracker.nonreactive in @typings/meteor
		function nonreactive<U>(func: () => U): U
	}
}

// Note: This file is temporary, we should make a PR to @typings/meteor later on!
/*
export type OptionalType<T, M> = {
	[K in keyof T]?: M
}
export type PopModifierSelector = -1 | 1
export type PullModifierSelector<DBInterface> = Array<any> | string | number | Optional<T> | MongoSelector<DBInterface>
export type BitModifierSelector = {and: number} | {or: number} | {xor: number}
export type MongoModifier<DBInterface> = {
	$set?: Optional<T> | {[path: string]: any}
	$unset?: OptionalType<T, number> | {[path: string]: number}
	$setOnInsert?: Optional<T> | {[path: string]: any}
	$inc?: OptionalType<T, number> | {[path: string]: number}
	$min?: Optional<T> | {[path: string]: any}
	$max?: Optional<T> | {[path: string]: any}
	$mul?: OptionalType<T, number> | {[path: string]: number}
	$rename?: OptionalType<T, string> | {[path: string]: string}

	$push?: Optional<T> | {[path: string]: any}
	$pop?: OptionalType<T, PopModifierSelector> | {[path: string]: PopModifierSelector}
	$pull?: OptionalType<T, PullModifierSelector<DBInterface>> | {[path: string]: PullModifierSelector<DBInterface>}
	$pullAll?: Optional<T> | {[path: string]: any}

	$bit?: OptionalType<T, BitModifierSelector> | {[path: string]: BitModifierSelector}
}
export type MongoBits = Array<number> | number // | BinData
export type SelectorValue<T, MongoSelector> =
	T |
	{$eq: T} |
	{$ne: T} |
	{$gt: T} |
	{$lt: T} |
	{$gte: T} |
	{$lte: T} |
	{$nin: Array<T>} |
	{$in: Array<T>} |
	{$and: Array<MongoSelector>} |
	{$not: SelectorValue<T, MongoSelector>} |
	{$or: Array<MongoSelector>} |
	{$nor: Array<MongoSelector>} |
	{$exists: boolean} |
	{$all: Array<T>} |
	{$elemMatch: Array<MongoSelector>} |
	{$size: number} |
	{$bitsAllClear: MongoBits} |
	{$bitsAllSet: MongoBits} |
	{$bitsAnySet: MongoBits} |
	{$bitsAnySet: MongoBits}

// export type MongoSelector<DBInterface> = {
// 	[K in keyof DBInterface]?: SelectorValue<DBInterface[K], MongoSelector<DBInterface>>
// }
export type MongoSelector<DBInterface> = Query<T> | QueryWithModifiers<T>

// export interface TransformedCollection<Class, DBInterface> extends Mongo.Collection<Class> {
*/

export interface SortSpecifier {
	[key: string]: -1 | 1
}

export interface FindOptions {
	sort?: SortSpecifier
	skip?: number
	limit?: number
	fields?: Mongo.FieldSpecifier
	reactive?: boolean
	transform?: Function
}
export interface UpdateOptions {
	multi?: boolean
	upsert?: boolean
}
export interface UpsertOptions {
	multi?: boolean
}

export type MongoSelector<DBInterface> = Mongo.Selector<DBInterface>
export type MongoModifier<DBInterface> = Mongo.Modifier<DBInterface>
export type MongoQuery<DBInterface> = Mongo.Query<DBInterface>
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

export interface TransformedCollection<Class extends DBInterface, DBInterface extends { _id: ProtectedString<any> }> {
	allow(options: {
		insert?: (userId: string, doc: DBInterface) => boolean
		update?: (userId: string, doc: DBInterface, fieldNames: string[], modifier: any) => boolean
		remove?: (userId: string, doc: DBInterface) => boolean
		fetch?: string[]
		transform?: Function
	}): boolean
	deny(options: {
		insert?: (userId: string, doc: DBInterface) => boolean
		update?: (userId: string, doc: DBInterface, fieldNames: string[], modifier: any) => boolean
		remove?: (userId: string, doc: DBInterface) => boolean
		fetch?: string[]
		transform?: Function
	}): boolean
	find(
		selector?: MongoSelector<DBInterface> | Mongo.ObjectID | DBInterface['_id'],
		options?: FindOptions
	): Mongocursor<Class>
	findOne(
		selector?: MongoSelector<DBInterface> | Mongo.ObjectID | DBInterface['_id'],
		options?: Omit<FindOptions, 'limit'>
	): Class | undefined
	insert(doc: DBInterface, callback?: Function): DBInterface['_id']
	rawCollection(): any
	rawDatabase(): any
	remove(selector: MongoSelector<DBInterface> | Mongo.ObjectID | DBInterface['_id'], callback?: Function): number
	update(
		selector: MongoSelector<DBInterface> | Mongo.ObjectID | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions,
		callback?: Function
	): number
	upsert(
		selector: MongoSelector<DBInterface> | Mongo.ObjectID | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions,
		callback?: Function
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	}
	_ensureIndex(
		keys:
			| {
					[key: string]: number | string
			  }
			| string,
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
