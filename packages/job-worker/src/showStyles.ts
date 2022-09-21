import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { deepFreeze, omit } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import * as deepmerge from 'deepmerge'
import { ReadonlyDeep } from 'type-fest'

export function createShowStyleCompound(
	showStyleBase: ReadonlyDeep<DBShowStyleBase>,
	showStyleVariant: ReadonlyDeep<DBShowStyleVariant>
): ReadonlyDeep<ShowStyleCompound> | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const baseConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj
	const variantConfig = applyAndValidateOverrides(showStyleVariant.blueprintConfigWithOverrides).obj

	const configs = deepmerge<IBlueprintConfig>(baseConfig, variantConfig, {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})

	return deepFreeze({
		...omit(showStyleBase, 'blueprintConfigWithOverrides'),
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		combinedBlueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	})
}
