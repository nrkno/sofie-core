import { Mongo } from 'meteor/mongo'

import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

// Note: This file is temporary, we should replace these types with ones which are stronger, or move them to a better home if they are good

// export { MongoQuery, MongoQueryKey, MongoModifier } from '@sofie-automation/corelib/dist/mongo'

/**
 * Subset of MongoSelector, only allows direct queries, not QueryWithModifiers such as $explain etc.
 * Used for simplified expressions (ie not using $and, $or etc..)
 * */
export type MongoQuery<DBInterface> = Mongo.Query<DBInterface>
export type MongoQueryKey<T> = RegExp | T | Mongo.FieldExpression<T> // Allowed properties in a Mongo.Query
export type MongoModifier<DBInterface> = Mongo.Modifier<DBInterface>
