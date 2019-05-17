import { Random } from 'meteor/random'
import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { ClientAPI } from '../../lib/api/client'
import { setMeteorMethods, Methods } from '../methods'
import { RundownLayoutsAPI } from '../../lib/api/rundownLayouts'
import { RundownLayouts, RundownLayoutType, RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { literal } from '../../lib/lib'
import { RundownLayoutSecurity } from '../security/rundownLayouts'

export function createRundownLayout (
	name: string,
	type: RundownLayoutType,
	showStyleBaseId: string,
	blueprintId: string | undefined,
	userId?: string | undefined
) {
	RundownLayouts.insert(literal<RundownLayoutBase>({
		_id: Random.id(),
		name,
		showStyleBaseId,
		blueprintId,
		filters: [],
		type,
		userId
	}))
}

export function removeRundownLayout (id: string) {
	RundownLayouts.remove(id)
}

let methods: Methods = {}
methods[RundownLayoutsAPI.methods.createRundownLayout] =
function (name: string, type: RundownLayoutType, showStyleBaseId: string) {
	check(name, String)
	check(type, String)
	check(showStyleBaseId, String)

	createRundownLayout(name, type, showStyleBaseId, undefined, this.connection.userId)
	return ClientAPI.responseSuccess()
}
methods[RundownLayoutsAPI.methods.removeRundownLayout] =
function (id: string) {
	check(id, String)

	if (RundownLayoutSecurity.allowWriteAccess(this.connection.userId)) {
		removeRundownLayout(id)
		return ClientAPI.responseSuccess()
	}
	throw new Meteor.Error(403, 'Access denied')
}
// Apply methods:
setMeteorMethods(methods)
