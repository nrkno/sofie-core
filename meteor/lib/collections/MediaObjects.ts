import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
export * from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'

export const MediaObjects = createMongoCollection<MediaObject>(CollectionName.MediaObjects)

registerIndex(MediaObjects, {
	studioId: 1,
	collectionId: 1,
	objId: 1,
	mediaId: 1,
})
registerIndex(MediaObjects, {
	studioId: 1,
	mediaId: 1,
})
