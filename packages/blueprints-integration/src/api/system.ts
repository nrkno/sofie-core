import type { MigrationStepSystem } from '../migrations'
import type { BlueprintManifestBase, BlueprintManifestType } from './base'

export interface SystemBlueprintManifest extends BlueprintManifestBase {
	blueprintType: BlueprintManifestType.SYSTEM

	/** A list of Migration steps related to the Core system */
	coreMigrations: MigrationStepSystem[]

	/** Translations connected to the studio (as stringified JSON) */
	translations?: string
}
