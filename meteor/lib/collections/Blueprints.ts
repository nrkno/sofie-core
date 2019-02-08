import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

import { ConfigManifestEntry } from 'tv-automation-sofie-blueprints-integration'
import { Revisionable, RevisionCollection } from './Revisionable'

export interface Blueprint extends Revisionable {
	_id: string
	name: string
	code: string
	modified: number
	created: number

	studioConfigManifest: ConfigManifestEntry[]
	showStyleConfigManifest: ConfigManifestEntry[]

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
	= new RevisionCollection<Blueprint>('blueprints')
registerCollection('Blueprints', Blueprints)
Meteor.startup(() => {
	if (Meteor.isServer) {
		// Blueprints._ensureIndex({
		// })
	}
})
