import { Mongo } from 'meteor/mongo'
import { Optional } from '../lib'

// Note: This file is temporary, we should make a PR to @typings/meteor later on!
/*
export type OptionalType<T, M> = {
	[K in keyof T]?: M
}
export type PopModifierSelector = -1 | 1
export type PullModifierSelector<DBInterface> = Array<any> | string | number | Optional<T> | Selector<DBInterface>
export type BitModifierSelector = {and: number} | {or: number} | {xor: number}
export type Modifier<DBInterface> = {
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
export type SelectorValue<T, Selector> =
	T |
	{$eq: T} |
	{$ne: T} |
	{$gt: T} |
	{$lt: T} |
	{$gte: T} |
	{$lte: T} |
	{$nin: Array<T>} |
	{$in: Array<T>} |
	{$and: Array<Selector>} |
	{$not: SelectorValue<T, Selector>} |
	{$or: Array<Selector>} |
	{$nor: Array<Selector>} |
	{$exists: boolean} |
	{$all: Array<T>} |
	{$elemMatch: Array<Selector>} |
	{$size: number} |
	{$bitsAllClear: MongoBits} |
	{$bitsAllSet: MongoBits} |
	{$bitsAnySet: MongoBits} |
	{$bitsAnySet: MongoBits}

// export type Selector<DBInterface> = {
// 	[K in keyof DBInterface]?: SelectorValue<DBInterface[K], Selector<DBInterface>>
// }
export type Selector<DBInterface> = Query<T> | QueryWithModifiers<T>

// export interface TransformedCollection<Class, DBInterface> extends Mongo.Collection<Class> {
*/

export interface FindOptions {
	sort?: Mongo.SortSpecifier
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

export type Selector<DBInterface> = Mongo.Selector<DBInterface>
export type Modifier<DBInterface> = Mongo.Modifier<DBInterface>

export interface TransformedCollection<Class, DBInterface> {
	allow (options: {
		insert?: (userId: string, doc: DBInterface) => boolean
		update?: (userId: string, doc: DBInterface, fieldNames: string[], modifier: any) => boolean
		remove?: (userId: string, doc: DBInterface) => boolean
		fetch?: string[]
		transform?: Function
	}): boolean
	deny (options: {
		insert?: (userId: string, doc: DBInterface) => boolean
		update?: (userId: string, doc: DBInterface, fieldNames: string[], modifier: any) => boolean
		remove?: (userId: string, doc: DBInterface) => boolean
		fetch?: string[]
		transform?: Function
	}): boolean
	find (selector?: Selector<DBInterface> | Mongo.ObjectID | string, options?: FindOptions): Mongo.Cursor<Class>
	findOne (selector?: Selector<DBInterface> | Mongo.ObjectID | string, options?: {
		sort?: Mongo.SortSpecifier
		skip?: number
		fields?: Mongo.FieldSpecifier
		reactive?: boolean
		transform?: Function
	}): Class | undefined
	insert (doc: DBInterface, callback?: Function): string
	rawCollection (): any
	rawDatabase (): any
	remove (selector: Selector<DBInterface> | Mongo.ObjectID | string, callback?: Function): number
	update (selector: Selector<DBInterface> | Mongo.ObjectID | string, modifier: Modifier<DBInterface>, options?: UpdateOptions, callback?: Function): number
	upsert (selector: Selector<DBInterface> | Mongo.ObjectID | string, modifier: Modifier<DBInterface>, options?: UpsertOptions, callback?: Function): {
		numberAffected?: number; insertedId?: string
	}
	_ensureIndex (keys: {
		[key: string]: number | string
	} | string, options?: {
		[key: string]: any
	}): void
	_dropIndex (keys: {
		[key: string]: number | string
	} | string): void
}
