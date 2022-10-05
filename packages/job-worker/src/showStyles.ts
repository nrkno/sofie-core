import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { deepFreeze } from '@sofie-automation/corelib/dist/lib'
import * as deepmerge from 'deepmerge'
import { ReadonlyDeep } from 'type-fest'
import {
	DBShowStyleBaseWithProcessedLayers,
	DBShowStyleVariantWithProcessedLayers,
	ShowStyleCompoundWithProcessedLayers,
} from './jobs'

export function createShowStyleCompound(
	showStyleBase: ReadonlyDeep<DBShowStyleBaseWithProcessedLayers>,
	showStyleVariant: ReadonlyDeep<DBShowStyleVariantWithProcessedLayers>
): ReadonlyDeep<ShowStyleCompoundWithProcessedLayers> | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const configs = deepmerge<IBlueprintConfig>(
		showStyleBase.blueprintConfig as IBlueprintConfig,
		showStyleVariant.blueprintConfig as IBlueprintConfig,
		{
			arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
		}
	)

	return deepFreeze({
		...showStyleBase,
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		combinedBlueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	})
}
