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
import { protectString, getRandomId, makePromise } from '../../lib/lib'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../security/organization'
import { ShowStyleContentWriteAccess } from '../security/showStyle'
import { Credentials } from '../security/lib/credentials'
import { OrganizationId } from '../../lib/collections/Organization'
import deepmerge from 'deepmerge'
import { ReadonlyDeep } from 'type-fest'
import { DBRundown } from '../../lib/collections/Rundowns'

export function getShowStyleCompound(showStyleVariantId: ShowStyleVariantId): ShowStyleCompound | undefined {
	const showStyleVariant = ShowStyleVariants.findOne(showStyleVariantId)
	if (!showStyleVariant) return undefined
	const showStyleBase = ShowStyleBases.findOne(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return undefined

	return createShowStyleCompound(showStyleBase, showStyleVariant)
}
export async function getShowStyleCompoundForRundown(
	rundown: Pick<ReadonlyDeep<DBRundown>, '_id' | 'showStyleBaseId' | 'showStyleVariantId'>
): Promise<ShowStyleCompound> {
	const [showStyleBase, showStyleVariant] = await Promise.all([
		ShowStyleBases.findOneAsync({ _id: rundown.showStyleBaseId }),
		ShowStyleVariants.findOneAsync({ _id: rundown.showStyleVariantId }),
	])
	if (!showStyleBase)
		throw new Meteor.Error(404, `ShowStyleBase "${rundown.showStyleBaseId}" for Rundown "${rundown._id}" not found`)
	if (!showStyleVariant)
		throw new Meteor.Error(
			404,
			`ShowStyleVariant "${rundown.showStyleVariantId}" for Rundown "${rundown._id}" not found`
		)

	const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
	if (!compound)
		throw new Meteor.Error(
			404,
			`Failed to compile ShowStyleCompound for base "${rundown.showStyleBaseId}" and variant  "${rundown.showStyleVariantId}"`
		)

	return compound
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

export function insertShowStyleBase(context: MethodContext | Credentials): ShowStyleBaseId {
	const access = OrganizationContentWriteAccess.studio(context)
	return insertShowStyleBaseInner(access.organizationId)
}
export function insertShowStyleBaseInner(organizationId: OrganizationId | null): ShowStyleBaseId {
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
	insertShowStyleVariantInner(showStyleBase, 'Default')
	return showStyleBase._id
}
export function insertShowStyleVariant(
	context: MethodContext | Credentials,
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): ShowStyleVariantId {
	check(showStyleBaseId, String)

	const access = ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

	return insertShowStyleVariantInner(showStyleBase, name)
}
export function insertShowStyleVariantInner(showStyleBase: ShowStyleBase, name?: string): ShowStyleVariantId {
	return ShowStyleVariants.insert({
		_id: getRandomId(),
		showStyleBaseId: showStyleBase._id,
		name: name || 'Variant',
		blueprintConfig: {},
		_rundownVersionHash: '',
	})
}
export function removeShowStyleBase(context: MethodContext, showStyleBaseId: ShowStyleBaseId) {
	check(showStyleBaseId, String)
	const access = ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

	ShowStyleBases.remove(showStyleBase._id)
	ShowStyleVariants.remove({
		showStyleBaseId: showStyleBase._id,
	})
	RundownLayouts.remove({
		showStyleBaseId: showStyleBase._id,
	})
}
export function removeShowStyleVariant(context: MethodContext, showStyleVariantId: ShowStyleVariantId) {
	check(showStyleVariantId, String)

	const access = ShowStyleContentWriteAccess.showStyleVariant(context, showStyleVariantId)
	const showStyleVariant = access.showStyleVariant
	if (!showStyleVariant) throw new Meteor.Error(404, `showStyleVariant "${showStyleVariantId}" not found`)

	ShowStyleVariants.remove(showStyleVariant._id)
}

class ServerShowStylesAPI extends MethodContextAPI implements NewShowStylesAPI {
	insertShowStyleBase() {
		return makePromise(() => insertShowStyleBase(this))
	}
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId) {
		return makePromise(() => insertShowStyleVariant(this, showStyleBaseId))
	}
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
		return makePromise(() => removeShowStyleBase(this, showStyleBaseId))
	}
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
		return makePromise(() => removeShowStyleVariant(this, showStyleVariantId))
	}
}
registerClassToMeteorMethods(ShowStylesAPIMethods, ServerShowStylesAPI, false)
