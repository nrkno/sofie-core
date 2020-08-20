import { registerClassToMeteorMethods } from '../methods'
import { NewShowStylesAPI, ShowStylesAPIMethods } from '../../lib/api/showStyles'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { literal, protectString, getRandomId, makePromise, check } from '../../lib/lib'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'

export function insertShowStyleBase(): ShowStyleBaseId {
	let id = ShowStyleBases.insert(
		literal<ShowStyleBase>({
			_id: getRandomId(),
			name: 'New show style',
			blueprintId: protectString(''),
			outputLayers: [],
			sourceLayers: [],
			blueprintConfig: {},
			runtimeArguments: [],
			_rundownVersionHash: '',
		})
	)
	insertShowStyleVariant(id, 'Default')
	return id
}
export function insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId, name?: string): ShowStyleVariantId {
	check(showStyleBaseId, String)

	let showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

	return ShowStyleVariants.insert({
		_id: getRandomId(),
		showStyleBaseId: showStyleBase._id,
		name: name || 'Variant',
		blueprintConfig: {},
		_rundownVersionHash: '',
	})
}
export function removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
	check(showStyleBaseId, String)

	ShowStyleBases.remove(showStyleBaseId)

	ShowStyleVariants.remove({
		showStyleBaseId: showStyleBaseId,
	})

	RundownLayouts.remove({
		showStyleBaseId: showStyleBaseId,
	})
}
export function removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
	check(showStyleVariantId, String)

	ShowStyleVariants.remove(showStyleVariantId)
}

class ServerShowStylesAPI implements NewShowStylesAPI {
	insertShowStyleBase() {
		return makePromise(() => insertShowStyleBase())
	}
	insertShowStyleVariant(showStyleBaseId: ShowStyleBaseId) {
		return makePromise(() => insertShowStyleVariant(showStyleBaseId))
	}
	removeShowStyleBase(showStyleBaseId: ShowStyleBaseId) {
		return makePromise(() => removeShowStyleBase(showStyleBaseId))
	}
	removeShowStyleVariant(showStyleVariantId: ShowStyleVariantId) {
		return makePromise(() => removeShowStyleVariant(showStyleVariantId))
	}
}
registerClassToMeteorMethods(ShowStylesAPIMethods, ServerShowStylesAPI, false)
