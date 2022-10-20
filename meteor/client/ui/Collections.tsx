import { CustomCollectionName } from '../../lib/api/pubsub'
import { createSyncCustomPublicationMongoCollection } from '../../lib/collections/lib'

/**
 * A playout UI version of ShowStyleBases.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UIShowStyleBases = createSyncCustomPublicationMongoCollection(CustomCollectionName.UIShowStyleBase)

/**
 * A playout UI version of Studios.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UIStudios = createSyncCustomPublicationMongoCollection(CustomCollectionName.UIStudio)

/**
 * A playout UI version of TriggeredActions.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UITriggeredActions = createSyncCustomPublicationMongoCollection(CustomCollectionName.UITriggeredActions)
