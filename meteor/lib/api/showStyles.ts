import { HotkeyDefinition, OutputLayers, ShowStyleBaseId, SourceLayers } from '../collections/ShowStyleBases'
import { ShowStyleVariantId } from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'insertShowStyleVariant' = 'showstyles.insertShowStyleVariant',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
}

// export type DBSourceLayerId = ProtectedString<'DBSourceLayer'>
// export interface DBSourceLayer {
// 	_id: DBSourceLayerId
// 	showStyleBaseId: ShowStyleBaseId
// 	sourceLayer: ISourceLayer
// }

// export type DBOutputLayerId = ProtectedString<'DBOutputLayer'>
// export interface DBOutputLayer {
// 	_id: DBOutputLayerId
// 	showStyleBaseId: ShowStyleBaseId
// 	outputLayer: IOutputLayer
// }

export interface UIShowStyleBase {
	_id: ShowStyleBaseId

	/** Name of this show style */
	name: string
	// /** Id of the blueprint used by this show-style */
	// blueprintId: BlueprintId
	// /** If set, the Organization that owns this ShowStyleBase */
	// organizationId: OrganizationId | null

	/** A list of hotkeys, used to display a legend of hotkeys for the user in GUI */
	hotkeyLegend?: Array<HotkeyDefinition>

	/** "Outputs" in the UI */
	outputLayers: OutputLayers
	/** "Layers" in the GUI */
	sourceLayers: SourceLayers

	// /** Config values are used by the Blueprints */
	// blueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>

	// _rundownVersionHash: string
}
