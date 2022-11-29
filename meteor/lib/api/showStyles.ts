import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { HotkeyDefinition, OutputLayers, SourceLayers } from '../collections/ShowStyleBases'
import { ShowStyleVariant } from '../collections/ShowStyleVariants'

export interface NewShowStylesAPI {
	insertShowStyleBase(): Promise<ShowStyleBaseId>
	createDefaultShowStyleVariant(showStyleBaseId: ShowStyleBaseId): Promise<ShowStyleVariantId>
	importShowStyleVariant(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId>
	importShowStyleVariantAsNew(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId>
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId): Promise<void>
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId): Promise<void>
	reorderAllShowStyleVariants(showStyleBaseId: ShowStyleBaseId, orderedVariants: ShowStyleVariant[]): Promise<void>
}

export enum ShowStylesAPIMethods {
	'insertShowStyleBase' = 'showstyles.insertShowStyleBase',
	'createDefaultShowStyleVariant' = 'showstyles.createDefaultShowStyleVariant',
	'importShowStyleVariant' = 'showstyles.importShowStyleVariant',
	'importShowStyleVariantAsNew' = 'showstyles.importShowStyleVariantAsNew',
	'removeShowStyleBase' = 'showstyles.removeShowStyleBase',
	'removeShowStyleVariant' = 'showstyles.removeShowStyleVariant',
	'reorderAllShowStyleVariants' = 'showstyles.reorderAllShowStyleVariants',
}

/**
 * A minimal version of DBShowStyleBase, intended for the playout portions of the UI.
 * Note: The settings ui uses the raw types
 * This intentionally does not extend ShowStyleBase, so that we have fine-grained control over the properties exposed
 */
export interface UIShowStyleBase {
	_id: ShowStyleBaseId

	/** Name of this show style */
	name: string

	/** A list of hotkeys, used to display a legend of hotkeys for the user in GUI */
	hotkeyLegend?: Array<HotkeyDefinition>

	/** "Outputs" in the UI */
	outputLayers: OutputLayers
	/** "Layers" in the GUI */
	sourceLayers: SourceLayers
}
