import { Mongo } from 'meteor/mongo'
import { Optional } from '../lib'

// Note: This file is temporary, we should make a PR to @typings/meteor later on!

export interface FindOptions {
	sort?: Mongo.SortSpecifier
	skip?: number
	limit?: number
	fields?: Mongo.FieldSpecifier
	reactive?: boolean
	transform?: Function
}
export type OptionalNumbers<T> = {
	[K in keyof T]?: number
}
export type Modifier<T> = {
	$pull?: Optional<T> | {[path: string]: any}
	$push?: Optional<T> | {[path: string]: any}
	$set?: Optional<T> | {[path: string]: any}
	$unset?: OptionalNumbers<T> | {[path: string]: any}
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

export type Selector<DBInterface> = {
	[K in keyof DBInterface]?: SelectorValue<DBInterface[K], Selector<DBInterface>>
}

// export interface TransformedCollection<Class, DBInterface> extends Mongo.Collection<Class> {
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
	find (selector?: Selector<DBInterface> | Mongo.ObjectID | string, options?: {
		sort?: Mongo.SortSpecifier
		skip?: number
		limit?: number
		fields?: Mongo.FieldSpecifier
		reactive?: boolean
		transform?: Function
	}): Mongo.Cursor<Class>
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
	update (selector: Selector<DBInterface> | Mongo.ObjectID | string, modifier: Modifier<DBInterface>, options?: {
		multi?: boolean
		upsert?: boolean
	}, callback?: Function): number
	upsert (selector: Selector<DBInterface> | Mongo.ObjectID | string, modifier: Modifier<DBInterface>, options?: {
		multi?: boolean
	}, callback?: Function): {
		numberAffected?: number; insertedId?: string
	}
	insert (doc: DBInterface, callback?: Function): string

	_ensureIndex (keys: {
		[key: string]: number | string
	} | string, options?: {
		[key: string]: any
	}): void
	_dropIndex (keys: {
		[key: string]: number | string
	} | string): void
}
