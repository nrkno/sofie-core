import { BlueprintManifestType, ConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { BlueprintId, OrganizationId } from './Ids'

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
	/** Whether version checks should be disabled for this version */
	disableVersionChecks?: boolean
}
