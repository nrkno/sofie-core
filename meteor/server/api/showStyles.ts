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
import { ShowStyleBaseLight } from '../../lib/collections/optimizations'
import {
	applyAndValidateOverrides,
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

export function createShowStyleCompound(
	showStyleBase: ShowStyleBase,
	showStyleVariant: ShowStyleVariant
): ShowStyleCompound | undefined {
	if (showStyleBase._id !== showStyleVariant.showStyleBaseId) return undefined

	const baseConfig = applyAndValidateOverrides(showStyleBase.blueprintConfigWithOverrides).obj
	const variantConfig = applyAndValidateOverrides(showStyleVariant.blueprintConfigWithOverrides).obj

	const configs = deepmerge<IBlueprintConfig>(baseConfig, variantConfig, {
		arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray,
	})

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
		name: 'New show style',
		organizationId: organizationId,
		blueprintId: protectString(''),
		outputLayersWithOverrides: wrapDefaultObject({}),
		sourceLayersWithOverrides: wrapDefaultObject({}),
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
	}
	ShowStyleBases.insert(showStyleBase)
	await insertShowStyleVariantInner(showStyleBase, 'Default')
	return showStyleBase._id
}
export async function insertShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): Promise<ShowStyleVariantId> {
	check(showStyleBaseId, String)

	const access = await ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

	return insertShowStyleVariantInner(showStyleBase, name)
}
export async function insertShowStyleVariantInner(
	showStyleBase: ShowStyleBaseLight,
	name?: string
): Promise<ShowStyleVariantId> {
	return ShowStyleVariants.insertAsync({
		_id: getRandomId(),
		showStyleBaseId: showStyleBase._id,
		name: name || 'Variant',
		blueprintConfigWithOverrides: wrapDefaultObject({}),
		_rundownVersionHash: '',
	})
}
export async function removeShowStyleBase(context: MethodContext, showStyleBaseId: ShowStyleBaseId): Promise<void> {
	check(showStyleBaseId, String)
	const access = await ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

	await Promise.allSettled([
		ShowStyleBases.removeAsync(showStyleBase._id),
		ShowStyleVariants.removeAsync({
			showStyleBaseId: showStyleBase._id,
		}),
		RundownLayouts.removeAsync({
			showStyleBaseId: showStyleBase._id,
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

class ServerShowStylesAPI extends MethodContextAPI implements NewShowStylesAPI {
	async insertShowStyleBase() {
		return insertShowStyleBase(this)
	}
	async insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId) {
		return insertShowStyleVariant(this, showStyleBaseId)
	}
	async removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
		return removeShowStyleBase(this, showStyleBaseId)
	}
	async removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
		return removeShowStyleVariant(this, showStyleVariantId)
	}
}
registerClassToMeteorMethods(ShowStylesAPIMethods, ServerShowStylesAPI, false)
