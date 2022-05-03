import {
	BlueprintManifestType,
	BlueprintResultStudioBaseline,
	ExtendedIngestRundown,
	IBlueprintShowStyleBase,
	IStudioBaselineContext,
	IStudioUserContext,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'

export const DefaultStudioBlueprint: ReadonlyDeep<StudioBlueprintManifest> = deepFreeze({
	/** Version of the blueprint */
	blueprintVersion: '',
	/** Version of the blueprint-integration that the blueprint depend on */
	integrationVersion: '',
	/** Version of the TSR-types that the blueprint depend on */
	TSRVersion: '',

	blueprintType: BlueprintManifestType.STUDIO,

	studioConfigManifest: [],
	studioMigrations: [],

	/** Returns the items used to build the baseline (default state) of a studio, this is the baseline used when there's no active rundown */
	getBaseline(_context: IStudioBaselineContext): BlueprintResultStudioBaseline {
		return {
			timelineObjects: [],
		}
	},

	/** Returns the id of the show style to use for a rundown, return null to ignore that rundown */
	getShowStyleId(
		_context: IStudioUserContext,
		_showStyles: ReadonlyDeep<Array<IBlueprintShowStyleBase>>,
		_ingestRundown: ExtendedIngestRundown
	): string | null {
		return null
	},
})
