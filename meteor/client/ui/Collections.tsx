import { CustomCollectionName } from '../../lib/api/pubsub'
import { createCustomPublicationMongoCollection } from '../../lib/collections/lib'

export const UIShowStyleBases = createCustomPublicationMongoCollection(CustomCollectionName.UIShowStyleBase)

export const UIStudios = createCustomPublicationMongoCollection(CustomCollectionName.UIStudio)

export const UITriggeredActions = createCustomPublicationMongoCollection(CustomCollectionName.UITriggeredActions)
