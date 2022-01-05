import { Meteor } from 'meteor/meteor'
import { ShowStyleBase } from './ShowStyleBases'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { ShowStyleVariantId }
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
export * from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'

export interface ShowStyleCompound extends ShowStyleBase {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
}

export type ShowStyleVariant = DBShowStyleVariant
export const ShowStyleVariants = createMongoCollection<ShowStyleVariant>(CollectionName.ShowStyleVariants)

registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', ['blueprintConfig', 'showStyleBaseId'])
	}
})
