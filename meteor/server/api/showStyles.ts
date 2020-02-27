import { Random } from 'meteor/random'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../methods'
import { ShowStylesAPI } from '../../lib/api/showStyles'
import { Meteor } from 'meteor/meteor'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariantId } from '../../lib/collections/ShowStyleVariants'
import { literal, protectString, getRandomId } from '../../lib/lib'
import { RundownLayouts } from '../../lib/collections/RundownLayouts'

export function insertShowStyleBase (): ShowStyleBaseId {
	let id = ShowStyleBases.insert(literal<ShowStyleBase>({
		_id: getRandomId(),
		name: 'New show style',
		blueprintId: protectString(''),
		outputLayers: [],
		sourceLayers: [],
		config: [],
		runtimeArguments: [],
		_rundownVersionHash: '',
	}))
	insertShowStyleVariant(id, 'Default')
	return id
}
export function insertShowStyleVariant (showStyleBaseId: ShowStyleBaseId, name?: string): ShowStyleVariantId {
	check(showStyleBaseId, String)

	let showStyleBase = ShowStyleBases.findOne(showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, `showStyleBase "${showStyleBaseId}" not found`)

	return ShowStyleVariants.insert({
		_id: getRandomId(),
		showStyleBaseId: showStyleBase._id,
		name: name || 'Variant',
		config: [],
		_rundownVersionHash: '',
	})
}
export function removeShowStyleBase (showStyleBaseId: ShowStyleBaseId) {
	check(showStyleBaseId, String)

	ShowStyleBases.remove(showStyleBaseId)

	ShowStyleVariants.remove({
		showStyleBaseId: showStyleBaseId
	})

	RundownLayouts.remove({
		showStyleBaseId: showStyleBaseId
	})
}
export function removeShowStyleVariant (showStyleVariantId: ShowStyleVariantId) {
	check(showStyleVariantId, String)

	ShowStyleVariants.remove(showStyleVariantId)
}

let methods: Methods = {}
methods[ShowStylesAPI.methods.insertShowStyleBase] = () => {
	return insertShowStyleBase()
}
methods[ShowStylesAPI.methods.insertShowStyleVariant] = (showStyleBaseId: ShowStyleBaseId) => {
	return insertShowStyleVariant(showStyleBaseId)
}
methods[ShowStylesAPI.methods.removeShowStyleBase] = (showStyleBaseId: ShowStyleBaseId) => {
	return removeShowStyleBase(showStyleBaseId)
}
methods[ShowStylesAPI.methods.removeShowStyleVariant] = (showStyleVariantId: ShowStyleVariantId) => {
	return removeShowStyleVariant(showStyleVariantId)
}

// Apply methods:
setMeteorMethods(methods)
