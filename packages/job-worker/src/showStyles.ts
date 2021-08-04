import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { JobContext } from './jobs'
import * as deepmerge from 'deepmerge'
import { ReadonlyDeep } from 'type-fest'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export async function getShowStyleCompound(
	context: JobContext,
	showStyleVariantId: ShowStyleVariantId
): Promise<ShowStyleCompound | undefined> {
	const showStyleVariant = await context.directCollections.ShowStyleVariants.findOne(showStyleVariantId)
	if (!showStyleVariant) return undefined
	const showStyleBase = await context.directCollections.ShowStyleBases.findOne(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return undefined

	return createShowStyleCompound(showStyleBase, showStyleVariant)
}
export async function getShowStyleCompoundForRundown(
	context: JobContext,
	rundown: Pick<ReadonlyDeep<DBRundown>, '_id' | 'showStyleBaseId' | 'showStyleVariantId'>
): Promise<ShowStyleCompound> {
	const [showStyleBase, showStyleVariant] = await Promise.all([
		context.directCollections.ShowStyleBases.findOne({ _id: rundown.showStyleBaseId }),
		context.directCollections.ShowStyleVariants.findOne({ _id: rundown.showStyleVariantId }),
	])
	if (!showStyleBase)
		throw new Error(`ShowStyleBase "${rundown.showStyleBaseId}" for Rundown "${rundown._id}" not found`)
	if (!showStyleVariant)
		throw new Error(`ShowStyleVariant "${rundown.showStyleVariantId}" for Rundown "${rundown._id}" not found`)

	const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
	if (!compound)
		throw new Error(
			`Failed to compile ShowStyleCompound for base "${rundown.showStyleBaseId}" and variant  "${rundown.showStyleVariantId}"`
		)

	return compound
}

export function createShowStyleCompound(
	showStyleBase: DBShowStyleBase,
	showStyleVariant: DBShowStyleVariant
): ShowStyleCompound | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const configs = deepmerge(showStyleBase.blueprintConfig, showStyleVariant.blueprintConfig, {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})

	return {
		...showStyleBase,
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		blueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	}
}
