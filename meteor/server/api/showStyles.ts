import { check } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { NewShowStylesAPI, ShowStylesAPIMethods } from '../../lib/api/showStyles'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBases, ShowStyleBase, DBShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { protectString, getRandomId, omit } from '../../lib/lib'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../security/organization'
import { ShowStyleContentWriteAccess } from '../security/showStyle'
import { Credentials } from '../security/lib/credentials'
import deepmerge from 'deepmerge'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { OrganizationId, ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface ShowStyleCompound extends Omit<DBShowStyleBase, 'blueprintConfigWithOverrides'> {
	showStyleVariantId: ShowStyleVariantId
	_rundownVersionHashVariant: string
	combinedBlueprintConfig: IBlueprintConfig
}

export async function getShowStyleCompound(
	showStyleVariantId: ShowStyleVariantId
): Promise<ShowStyleCompound | undefined> {
	const showStyleVariant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
	if (!showStyleVariant) return undefined
	const showStyleBase = await ShowStyleBases.findOneAsync(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return undefined

	return createShowStyleCompound(showStyleBase, showStyleVariant)
}

export function createBlueprintConfigCompound(
	baseConfig: ObjectWithOverrides<IBlueprintConfig>,
	variantConfig: ObjectWithOverrides<IBlueprintConfig>
) {
	const baseConfig2 = applyAndValidateOverrides(baseConfig).obj
	const variantConfig2 = applyAndValidateOverrides(variantConfig).obj

	return deepmerge<IBlueprintConfig>(baseConfig2, variantConfig2, {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})
}

export function createShowStyleCompound(
	showStyleBase: ShowStyleBase,
	showStyleVariant: ShowStyleVariant
): ShowStyleCompound | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const configs = createBlueprintConfigCompound(
		showStyleBase.blueprintConfigWithOverrides,
		showStyleVariant.blueprintConfigWithOverrides
	)

	return {
		...omit(showStyleBase, 'blueprintConfigWithOverrides'),
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		combinedBlueprintConfig: configs,
		_rundownVersionHash: showStyleBase._rundownVersionHash,
		_rundownVersionHashVariant: showStyleVariant._rundownVersionHash,
	}
}

export async function insertShowStyleBase(context: MethodContext | Credentials): Promise<ShowStyleBaseId> {
	const access = await OrganizationContentWriteAccess.showStyleBase(context)
	return insertShowStyleBaseInner(access.organizationId)
}

export async function insertShowStyleBaseInner(organizationId: OrganizationId | null): Promise<ShowStyleBaseId> {
	const showStyleBase: ShowStyleBase = {
		_id: getRandomId(),
		name: 'New Show Style',
		organizationId: organizationId,
		blueprintId: protectString(''),
		outputLayersWithOverrides: wrapDefaultObject({}),
		sourceLayersWithOverrides: wrapDefaultObject({}),
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		lastBlueprintConfig: undefined,
	}
	await ShowStyleBases.insertAsync(showStyleBase)

	await insertShowStyleVariantInner(showStyleBase._id, 'Default')
	return showStyleBase._id
}
async function assertShowStyleBaseAccess(context: MethodContext | Credentials, showStyleBaseId: ShowStyleBaseId) {
	check(showStyleBaseId, String)

	const access = await ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)
}

export async function insertShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): Promise<ShowStyleVariantId> {
	await assertShowStyleBaseAccess(context, showStyleBaseId)
	return insertShowStyleVariantInner(showStyleBaseId, name)
}

async function insertShowStyleVariantInner(
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): Promise<ShowStyleVariantId> {
	const highestRank =
		(
			await ShowStyleVariants.findOneAsync(
				{
					showStyleBaseId,
				},
				{
					projection: {
						_rank: 1,
					},
					sort: {
						_rank: -1,
					},
					limit: 1,
				}
			)
		)?._rank ?? -1
	const rank = highestRank + 1

	const showStyleVariant: ShowStyleVariant = {
		_id: getRandomId(),
		name: name || 'New Variant',
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
		_rank: rank,
		showStyleBaseId: showStyleBaseId,
	}

	return ShowStyleVariants.insertAsync(showStyleVariant)
}

export async function importShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleVariant: ShowStyleVariant
): Promise<ShowStyleVariantId> {
	await assertShowStyleBaseAccess(context, showStyleVariant.showStyleBaseId)

	return ShowStyleVariants.insertAsync(showStyleVariant)
}

export async function importShowStyleVariantAsNew(
	context: MethodContext | Credentials,
	showStyleVariant: Omit<ShowStyleVariant, '_id'>
): Promise<ShowStyleVariantId> {
	await assertShowStyleBaseAccess(context, showStyleVariant.showStyleBaseId)

	const newShowStyleVariant: ShowStyleVariant = {
		...showStyleVariant,
		_id: getRandomId(),
	}

	return ShowStyleVariants.insertAsync(newShowStyleVariant)
}

export async function removeShowStyleBase(context: MethodContext, showStyleBaseId: ShowStyleBaseId): Promise<void> {
	await assertShowStyleBaseAccess(context, showStyleBaseId)

	await Promise.allSettled([
		ShowStyleBases.removeAsync(showStyleBaseId),
		ShowStyleVariants.removeAsync({
			showStyleBaseId,
		}),
		RundownLayouts.removeAsync({
			showStyleBaseId,
		}),
	])
}

export async function removeShowStyleVariant(
	context: MethodContext,
	showStyleVariantId: ShowStyleVariantId
): Promise<void> {
	check(showStyleVariantId, String)

	const access = await ShowStyleContentWriteAccess.showStyleVariant(context, showStyleVariantId)
	const showStyleVariant = access.showStyleVariant
	if (!showStyleVariant) throw new Meteor.Error(404, `showStyleVariant "${showStyleVariantId}" not found`)

	await ShowStyleVariants.removeAsync(showStyleVariant._id)
}

export async function reorderShowStyleVariant(
	context: MethodContext,
	showStyleVariantId: ShowStyleVariantId,
	rank: number
): Promise<void> {
	check(showStyleVariantId, String)
	check(rank, Number)

	const access = await ShowStyleContentWriteAccess.showStyleVariant(context, showStyleVariantId)
	const showStyleVariant = access.showStyleVariant
	if (!showStyleVariant) throw new Meteor.Error(404, `showStyleVariant "${showStyleVariantId}" not found`)

	await ShowStyleVariants.updateAsync(showStyleVariantId, {
		$set: {
			_rank: rank,
		},
	})
}

class ServerShowStylesAPI extends MethodContextAPI implements NewShowStylesAPI {
	async insertShowStyleBase() {
		return insertShowStyleBase(this)
	}
	async insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId) {
		return insertShowStyleVariant(this, showStyleBaseId)
	}
	async importShowStyleVariant(showStyleVariant: ShowStyleVariant) {
		return importShowStyleVariant(this, showStyleVariant)
	}
	async importShowStyleVariantAsNew(showStyleVariant: Omit<ShowStyleVariant, '_id'>) {
		return importShowStyleVariantAsNew(this, showStyleVariant)
	}
	async removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
		return removeShowStyleBase(this, showStyleBaseId)
	}
	async removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
		return removeShowStyleVariant(this, showStyleVariantId)
	}
	async reorderShowStyleVariant(showStyleVariantId: ShowStyleVariantId, newRank: number) {
		return reorderShowStyleVariant(this, showStyleVariantId, newRank)
	}
}
registerClassToMeteorMethods(ShowStylesAPIMethods, ServerShowStylesAPI, false)
