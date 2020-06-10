import { check } from '../../lib/check'
import { registerClassToMeteorMethods } from '../methods'
import { NewShowStylesAPI, ShowStylesAPIMethods } from '../../lib/api/showStyles'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { literal, protectString, getRandomId, makePromise } from '../../lib/lib'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { OrganizationContentWriteAccess } from '../security/organization'
import { ShowStyleContentWriteAccess } from '../security/showStyle'

export function insertShowStyleBase(context: MethodContext): ShowStyleBaseId {
	const access = OrganizationContentWriteAccess.studio(context)

	let id = ShowStyleBases.insert(
		literal<ShowStyleBase>({
			_id: getRandomId(),
			name: 'New show style',
			organizationId: access.organizationId,
			blueprintId: protectString(''),
			outputLayers: [],
			sourceLayers: [],
			config: [],
			runtimeArguments: [],
			_rundownVersionHash: '',
		})
	)
	insertShowStyleVariant(context, id, 'Default')
	return id
}
export function insertShowStyleVariant(
	context: MethodContext,
	showStyleBaseId: ShowStyleBaseId,
	name?: string
): ShowStyleVariantId {
	check(showStyleBaseId, String)

	const access = ShowStyleContentWriteAccess.anyContent(context, showStyleBaseId)
	const showStyleBase = access.showStyleBase
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

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
