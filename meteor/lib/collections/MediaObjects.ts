import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { MediaObjId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export { MediaObjId }

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
