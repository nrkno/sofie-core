import { Meteor } from 'meteor/meteor'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { NewShowStylesAPI, ShowStylesAPIMethods } from '../../lib/api/showStyles'
import { check } from '../../lib/check'
import { OrganizationId } from '../../lib/collections/Organization'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { ShowStyleBase, ShowStyleBaseId, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariantId, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { getRandomId, makePromise, protectString } from '../../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { Credentials } from '../security/lib/credentials'
import { OrganizationContentWriteAccess } from '../security/organization'
import { ShowStyleContentWriteAccess } from '../security/showStyle'

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
		config: [],
		runtimeArguments: [],
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
		config: [],
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
