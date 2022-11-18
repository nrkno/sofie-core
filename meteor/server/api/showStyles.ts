import { check } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { NewShowStylesAPI, ShowStylesAPIMethods } from '../../lib/api/showStyles'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import {
	ShowStyleVariants,
	ShowStyleVariantId,
	ShowStyleCompound,
	ShowStyleVariant,
} from '../../lib/collections/ShowStyleVariants'
import { protectString, getRandomId } from '../../lib/lib'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../security/organization'
import { ShowStyleContentWriteAccess } from '../security/showStyle'
import { Credentials } from '../security/lib/credentials'
import { OrganizationId } from '../../lib/collections/Organization'
import deepmerge from 'deepmerge'

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
		outputLayers: [],
		sourceLayers: [],
		blueprintConfig: {},
		_rundownVersionHash: '',
	}
	ShowStyleBases.insert(showStyleBase)

	const showStyleVariant: ShowStyleVariant = {
		_id: getRandomId(),
		name: 'Default',
		blueprintConfig: {},
		_rundownVersionHash: '',
		_rank: 500,
		showStyleBaseId: showStyleBase._id,
	}
	await insertShowStyleVariant(showStyleVariant)
	return showStyleBase._id
}
async function assertShowStyleBaseAccess(context: MethodContext | Credentials, showStyleBaseId: ShowStyleBaseId) {
	check(showStyleBaseId, String)

	const access = await ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)
}

export async function createDefaultShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleBaseId: ShowStyleBaseId,
	rank?: number,
	name?: string
): Promise<ShowStyleVariantId> {
	await assertShowStyleBaseAccess(context, showStyleBaseId)

	const showStyleVariant: ShowStyleVariant = {
		_id: getRandomId(),
		name: name || 'Variant',
		blueprintConfig: {},
		_rundownVersionHash: '',
		_rank: rank || 500,
		showStyleBaseId: showStyleBaseId,
	}

	return insertShowStyleVariant(showStyleVariant)
}

export async function importShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleVariant: ShowStyleVariant
): Promise<ShowStyleVariantId> {
	await assertShowStyleBaseAccess(context, showStyleVariant.showStyleBaseId)

	return insertShowStyleVariant(showStyleVariant)
}

export async function copyShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleVariant: ShowStyleVariant
): Promise<ShowStyleVariantId> {
	await assertShowStyleBaseAccess(context, showStyleVariant.showStyleBaseId)

	showStyleVariant._id = getRandomId()

	return insertShowStyleVariant(showStyleVariant)
}

export async function insertShowStyleVariant(showStyleVariant: ShowStyleVariant): Promise<ShowStyleVariantId> {
	return ShowStyleVariants.insertAsync(showStyleVariant)
}

export async function removeShowStyleBase(context: MethodContext, showStyleBaseId: ShowStyleBaseId): Promise<void> {
	await assertShowStyleBaseAccess(context, showStyleBaseId)

	await Promise.allSettled([
		ShowStyleBases.removeAsync(showStyleBaseId),
		ShowStyleVariants.removeAsync({
			showStyleBaseId: showStyleBaseId,
		}),
		RundownLayouts.removeAsync({
			showStyleBaseId: showStyleBaseId,
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

export async function reorderAllShowStyleVariants(
	context: MethodContext,
	showStyleBaseId: ShowStyleBaseId,
	orderedVariants: ShowStyleVariant[]
): Promise<void> {
	await assertShowStyleBaseAccess(context, showStyleBaseId)

	await reorderAllShowStyleVariantsInner(orderedVariants)
}

export async function reorderAllShowStyleVariantsInner(orderedVariants: ShowStyleVariant[]): Promise<void> {
	orderedVariants.forEach((variant: ShowStyleVariant, index: number) => {
		ShowStyleVariants.upsert(variant._id, {
			$set: {
				_rank: index,
			},
		})
	})
}

class ServerShowStylesAPI extends MethodContextAPI implements NewShowStylesAPI {
	async insertShowStyleBase() {
		return insertShowStyleBase(this)
	}
	async createDefaultShowStyleVariant(showStyleBaseId: ShowStyleBaseId, rank: number) {
		return createDefaultShowStyleVariant(this, showStyleBaseId, rank)
	}
	async importShowStyleVariant(showStyleVariant: ShowStyleVariant) {
		return importShowStyleVariant(this, showStyleVariant)
	}
	async copyShowStyleVariant(showStyleVariant: ShowStyleVariant) {
		return copyShowStyleVariant(this, showStyleVariant)
	}
	async removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
		return removeShowStyleBase(this, showStyleBaseId)
	}
	async removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
		return removeShowStyleVariant(this, showStyleVariantId)
	}
	async reorderAllShowStyleVariants(showStyleBaseId: ShowStyleBaseId, orderedVariants: ShowStyleVariant[]) {
		return reorderAllShowStyleVariants(this, showStyleBaseId, orderedVariants)
	}
}
registerClassToMeteorMethods(ShowStylesAPIMethods, ServerShowStylesAPI, false)
