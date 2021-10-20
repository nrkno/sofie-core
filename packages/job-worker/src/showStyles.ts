import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { clone, deepFreeze } from '@sofie-automation/corelib/dist/lib'
import * as deepmerge from 'deepmerge'
import { ReadonlyDeep } from 'type-fest'

export function createShowStyleCompound(
	showStyleBase: ReadonlyDeep<DBShowStyleBase>,
	showStyleVariant: ReadonlyDeep<DBShowStyleVariant>
): ReadonlyDeep<ShowStyleCompound> | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const configs = deepmerge(clone(showStyleBase.blueprintConfig), clone(showStyleVariant.blueprintConfig), {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})

	return deepFreeze({
		...showStyleBase,
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		blueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	})
}
