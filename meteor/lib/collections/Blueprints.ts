import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

import { ConfigManifestEntry, BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'

export interface Blueprint {
	_id: string
	name: string
	code: string
	modified: number
	created: number

	blueprintType?: BlueprintManifestType

	studioConfigManifest?: ConfigManifestEntry[]
	showStyleConfigManifest?: ConfigManifestEntry[]

	databaseVersion: {
		showStyle: {
			[showStyleBaseId: string]: string
		},
		studio: {
			[studioId: string]: string
		}
	}

	blueprintVersion: string
	integrationVersion: string
	TSRVersion: string
	minimumCoreVersion: string
}

export const Blueprints: TransformedCollection<Blueprint, Blueprint>
	= createMongoCollection<Blueprint>('blueprints')
registerCollection('Blueprints', Blueprints)
Meteor.startup(() => {
	if (Meteor.isServer) {
		// Blueprints._ensureIndex({
		// })
	}
})
