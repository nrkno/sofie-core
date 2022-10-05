import { CustomCollectionName } from '../../lib/api/pubsub'
import { createCustomMongoCollection } from '../lib/lib'

export const UIShowStyleBases = createCustomMongoCollection(CustomCollectionName.UIShowStyleBase)

export const UIStudios = createCustomMongoCollection(CustomCollectionName.UIStudio)

export const UITriggeredActions = createCustomMongoCollection(CustomCollectionName.UITriggeredActions)
