import { Meteor } from 'meteor/meteor'
import { registerCollection } from '../lib'
import { ObserveChangesForHash, createMongoCollection } from './lib'
import { registerIndex } from '../database'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { ShowStyleBaseId }

import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
export * from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'

export type ShowStyleBase = DBShowStyleBase

export const ShowStyleBases = createMongoCollection<ShowStyleBase, DBShowStyleBase>('showStyleBases')
registerCollection('ShowStyleBases', ShowStyleBases)

registerIndex(ShowStyleBases, {
	organizationId: 1,
})

Meteor.startup(() => {
	if (Meteor.isServer) {
		ObserveChangesForHash(ShowStyleBases, '_rundownVersionHash', ['blueprintConfig', 'blueprintId'])
	}
})
