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
import { MongoQuery, SortSpecifier } from '@sofie-automation/corelib/dist/mongo'

// This is a copy of the type used in the Users collection,
// to avoid nasty dependencies
/** A string, identifying a User */
export type UserId = ProtectedString<'UserId'>

// Note: This file is temporary, we should replace these types with ones which are stronger, or move them to a better home if they are good

export { FindOneOptions, FindOptions, FieldNames } from '../collections/lib'

// export { MongoQuery, MongoQueryKey, MongoModifier } from '@sofie-automation/corelib/dist/mongo'

// /** @deprecated use MongoQuery */
// export type MongoSelector<DBInterface> = MongoQuery<DBInterface>

/** Mongo Selector. Contains everything that can be sent into collection.find(selector) */
export type MongoSelector<DBInterface> = Mongo.Selector<DBInterface>
/**
 * Subset of MongoSelector, only allows direct queries, not QueryWithModifiers such as $explain etc.
 * Used for simplified expressions (ie not using $and, $or etc..)
 * */
export type MongoQuery<DBInterface> = Mongo.Query<DBInterface>
export type MongoQueryKey<T> = RegExp | T | Mongo.FieldExpression<T> // Allowed properties in a Mongo.Query
export type MongoModifier<DBInterface> = Mongo.Modifier<DBInterface>
