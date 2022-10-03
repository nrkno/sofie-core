import { CustomCollectionName } from '../../lib/api/pubsub'
import { createCustomMongoCollection } from '../lib/lib'

export const UIShowStyleBases = createCustomMongoCollection(CustomCollectionName.UIShowStyleBase)

export const UITriggeredActions = createCustomMongoCollection(CustomCollectionName.UITriggeredActions)
