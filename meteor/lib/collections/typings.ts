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
export type Selector<T> = Optional<T>
export type OptionalNumbers<T> = {
	[K in keyof T]?: number
}
export type Modifier<T> = {
	$set?: Optional<T>
	$unset?: OptionalNumbers<T>
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
	find (selector?: Mongo.Selector | Mongo.ObjectID | string, options?: {
		sort?: Mongo.SortSpecifier
		skip?: number
		limit?: number
		fields?: Mongo.FieldSpecifier
		reactive?: boolean
		transform?: Function
	}): Mongo.Cursor<Class>
	findOne (selector?: Mongo.Selector | Mongo.ObjectID | string, options?: {
		sort?: Mongo.SortSpecifier
		skip?: number
		fields?: Mongo.FieldSpecifier
		reactive?: boolean
		transform?: Function
	}): Class
	insert (doc: DBInterface, callback?: Function): string
	rawCollection (): any
	rawDatabase (): any
	remove (selector: Mongo.Selector | Mongo.ObjectID | string, callback?: Function): number
	update (selector: Mongo.Selector | Mongo.ObjectID | string, modifier: Modifier<DBInterface>, options?: {
		multi?: boolean
		upsert?: boolean
	}, callback?: Function): number
	upsert (selector: Mongo.Selector | Mongo.ObjectID | string, modifier: Modifier<DBInterface>, options?: {
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
