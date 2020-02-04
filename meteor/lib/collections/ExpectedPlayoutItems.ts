import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { ExpectedPlayoutItemGeneric } from 'tv-automation-sofie-blueprints-integration'

export interface ExpectedPlayoutItem extends ExpectedPlayoutItemGeneric {
	/** Globally unique id of the item */
	_id: string

	/** The studio installation this ExpectedPlayoutItem was generated in */
	studioId: string
	/** The rundown id that is the source of this PlayoutItem */
	rundownId: string
	/** The part id that is the source of this Playout Item */
	partId?: string
	/** The piece id that is the source of this Playout Item */
	pieceId: string
}


export const ExpectedPlayoutItems: TransformedCollection<ExpectedPlayoutItem, ExpectedPlayoutItem>
	= createMongoCollection<ExpectedPlayoutItem>('expectedPlayoutItems')
registerCollection('ExpectedPlayoutItems', ExpectedPlayoutItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ExpectedPlayoutItems._ensureIndex({
			studioId: 1
		})
		ExpectedPlayoutItems._ensureIndex({
			rundownId: 1
		})
	}
})
