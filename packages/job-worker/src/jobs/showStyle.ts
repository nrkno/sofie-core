import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { deepFreeze, omit } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'

export interface ProcessedShowStyleVariant extends Omit<DBShowStyleVariant, 'blueprintConfigWithOverrides'> {
	blueprintConfig: IBlueprintConfig
}

export interface ProcessedShowStyleBase
	extends Omit<
		DBShowStyleBase,
		'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'blueprintConfigWithOverrides'
	> {
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
	blueprintConfig: IBlueprintConfig
}
export interface ProcessedShowStyleCompound
	extends Omit<
		ShowStyleCompound,
		'sourceLayersWithOverrides' | 'outputLayersWithOverrides' | 'blueprintConfigWithOverrides'
	> {
	sourceLayers: SourceLayers
	outputLayers: OutputLayers
}

export function processShowStyleBase(doc: DBShowStyleBase): ReadonlyDeep<ProcessedShowStyleBase> {
	return deepFreeze<ProcessedShowStyleBase>({
		...omit(doc, 'sourceLayersWithOverrides', 'outputLayersWithOverrides', 'blueprintConfigWithOverrides'),
		sourceLayers: applyAndValidateOverrides(doc.sourceLayersWithOverrides).obj,
		outputLayers: applyAndValidateOverrides(doc.outputLayersWithOverrides).obj,
		blueprintConfig: applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj,
	})
}
export function processShowStyleVariant(doc: DBShowStyleVariant): ReadonlyDeep<ProcessedShowStyleVariant> {
	return deepFreeze<ProcessedShowStyleVariant>({
		...omit(doc, 'blueprintConfigWithOverrides'),
		blueprintConfig: applyAndValidateOverrides(doc.blueprintConfigWithOverrides).obj,
	})
}
