import { Meteor } from 'meteor/meteor'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
export * from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'

/** Note: Use ShowStyleBase instead */
export type ShowStyleBase = DBShowStyleBase

export const ShowStyleBases = createMongoCollection<ShowStyleBase>(CollectionName.ShowStyleBases)

registerIndex(ShowStyleBases, {
	organizationId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['blueprintConfigWithOverrides', 'blueprintId'])
	}
})
