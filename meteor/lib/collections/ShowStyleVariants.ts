import { Meteor } from 'meteor/meteor'
import { createMongoCollection, ObserveChangesForHash } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'

export * from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'

export type ShowStyleVariant = DBShowStyleVariant
export const ShowStyleVariants = createMongoCollection<ShowStyleVariant>(CollectionName.ShowStyleVariants)

registerIndex(ShowStyleVariants, {
	showStyleBaseId: 1,
	_rank: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleVariants, '_rundownVersionHash', [
			'blueprintConfigWithOverrides',
			'showStyleBaseId',
		])
	}
})
