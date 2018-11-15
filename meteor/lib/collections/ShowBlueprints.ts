import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

import { ConfigManifestEntry } from 'tv-automation-sofie-blueprints-integration/dist/config'

export interface ShowBlueprint {
	_id: string
	showStyleId: string
	code: string
	modified: number

	studioConfigManifest: ConfigManifestEntry[]
	showStyleConfigManifest: ConfigManifestEntry[]

	version: string
	minimumCoreVersion: string
}

export const ShowBlueprints: TransformedCollection<ShowBlueprint, ShowBlueprint>
	= new Mongo.Collection<ShowBlueprint>('showBlueprints')
registerCollection('ShowBlueprints', ShowBlueprints)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowBlueprints._ensureIndex({
			showStyleId: 1
		})
	}
})
