import { Meteor } from 'meteor/meteor'
import { createMongoCollection, ObserveChangesForHash } from './lib'
import { registerIndex } from '../database'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'

export { ShowStyleVariantId }
export * from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'

export { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'

export type ShowStyleVariant = DBShowStyleVariant
export const ShowStyleVariants = createMongoCollection<ShowStyleVariant>(CollectionName.ShowStyleVariants)

export type ShowStyleVariantsOrder = { _id: ShowStyleVariantId; rank: number; showStyleBaseId: ShowStyleBaseId }

export const OrderedShowStyleVariants = createMongoCollection<ShowStyleVariantsOrder>(
	CollectionName.ShowStyleVariantsOrder
)

registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
})

registerIndex(OrderedShowStyleVariants, {
	showStyleBaseId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', ['blueprintConfig', 'showStyleBaseId'])
	}
})
