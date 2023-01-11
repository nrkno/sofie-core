import { CustomCollectionName } from '../../lib/api/pubsub'
import { createCustomPublicationMongoCollection } from '../../lib/collections/lib'

/**
 * A playout UI version of ShowStyleBases.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UIShowStyleBases = createCustomPublicationMongoCollection(CustomCollectionName.UIShowStyleBase)

/**
 * A playout UI version of Studios.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UIStudios = createCustomPublicationMongoCollection(CustomCollectionName.UIStudio)

/**
 * A playout UI version of TriggeredActions.
 * This has been stripped back to only useful properties, with any ObjectWithOverrides<T> pre-flattened
 */
export const UITriggeredActions = createCustomPublicationMongoCollection(CustomCollectionName.UITriggeredActions)

/**
 * A preview of the latest issued device triggers for a given Studio
 */
export const DeviceTriggersPreviews = createCustomPublicationMongoCollection(
	CustomCollectionName.UIDeviceTriggerPreviews
)

/**
 * Pre-generated notes to be converted into notificiations.
 */
export const UISegmentPartNotes = createCustomPublicationMongoCollection(CustomCollectionName.UISegmentPartNotes)

/**
 * Pre-processed MediaObjectIssue for Pieces in the Rundowns
 */
export const UIPieceContentStatuses = createCustomPublicationMongoCollection(
	CustomCollectionName.UIPieceContentStatuses
)
