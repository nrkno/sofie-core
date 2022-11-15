import {
	BlueprintManifestType,
	ConfigManifestEntry,
	IBlueprintConfig,
	IConfigPreset,
} from '@sofie-automation/blueprints-integration'
import { ProtectedString } from '../protectedString'
import { BlueprintId, OrganizationId } from './Ids'

export type BlueprintHash = ProtectedString<'BlueprintHash'>

export interface Blueprint {
	_id: BlueprintId
	organizationId: OrganizationId | null
	name: string
	/** String containing the Code for the blueprint */
	code: string
	/** Whether the blueprint has a code or not. Is equal to !!blueprint.code. */
	hasCode: boolean
	/** Timestamp, last time the blueprint was modified */
	modified: number
	/** Timestamp, when the blueprint was created */
	created: number

	blueprintId: BlueprintId
	blueprintType?: BlueprintManifestType

	studioConfigManifest?: ConfigManifestEntry[]
	showStyleConfigManifest?: ConfigManifestEntry[]

	configPresets?: Record<string, IConfigPreset>

	databaseVersion: {
		showStyle: {
			[showStyleBaseId: string]: string
		}
		studio: {
			[studioId: string]: string
		}
		system: string | undefined
	}

	blueprintVersion: string
	integrationVersion: string
	TSRVersion: string
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean

	/** Hash for the blueprint, changed each time it is changed */
	blueprintHash: BlueprintHash | undefined // TODO - removed `| undefined`
}

export interface LastBlueprintConfig {
	blueprintId: BlueprintId
	blueprintHash: BlueprintHash

	config: IBlueprintConfig
}
