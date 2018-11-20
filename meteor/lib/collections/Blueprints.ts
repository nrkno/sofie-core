import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

import { ConfigManifestEntry } from 'tv-automation-sofie-blueprints-integration'

export interface Blueprint {
	_id: string
	name: string
	code: string
	modified: number
	created: number

	studioConfigManifest: ConfigManifestEntry[]
	showStyleConfigManifest: ConfigManifestEntry[]

	version: string
	minimumCoreVersion: string
}

export const Blueprints: TransformedCollection<Blueprint, Blueprint>
	= new Mongo.Collection<Blueprint>('blueprints')
registerCollection('blueprints', Blueprints)
Meteor.startup(() => {
	if (Meteor.isServer) {
		// Blueprints._ensureIndex({
		// })
	}
})
