import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString } from '../lib'

import { ConfigManifestEntry, BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'
import { createMongoCollection } from './lib'
import { OrganizationId } from './Organization'
import { registerIndex } from '../database'

/** A string, identifying a Blueprint */
export type BlueprintId = ProtectedString<'BlueprintId'>

export interface Blueprint {
	_id: BlueprintId
	organizationId: OrganizationId | null
	name: string
	code: string
	modified: number
	created: number

	blueprintId: BlueprintId
	blueprintType?: BlueprintManifestType

	studioConfigManifest?: ConfigManifestEntry[]
	showStyleConfigManifest?: ConfigManifestEntry[]

	databaseVersion: {
		showStyle: {
			[showStyleBaseId: string]: string
		}
		studio: {
			[studioId: string]: string
		}
	}

	blueprintVersion: string
	integrationVersion: string
	TSRVersion: string
	minimumCoreVersion: string
}

export const Blueprints: TransformedCollection<Blueprint, Blueprint> = createMongoCollection<Blueprint>('blueprints')
registerCollection('Blueprints', Blueprints)

registerIndex(Blueprints, {
	organizationId: 1,
})
