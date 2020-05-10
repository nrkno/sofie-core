import { Meteor } from 'meteor/meteor'
import { check, Match } from '../../lib/check'
import * as _ from 'underscore'
import { literal, getRandomId, makePromise, getCurrentTime } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewOrganizationAPI, OrganizationAPIMethods } from '../../lib/api/organization'
import { registerClassToMeteorMethods } from '../methods'
import { Organizations, OrganizationId, DBOrganization, NewOrganization } from '../../lib/collections/Organization'
import { OrganizationContentWriteAccess } from '../security/organization'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'


export function insertOrganization (context: MethodContext, organization: NewOrganization) {
	triggerWriteAccessBecauseNoCheckNecessary()
	const userId = context.userId
	if(!userId) throw new Meteor.Error(401, 'User is not logged in')
	const admin = {userId}
	const id = Organizations.insert(literal<DBOrganization>({
		_id: getRandomId(),
		name: organization.name,
		admins: [admin],
		applications: organization.applications,
		broadcastMediums: organization.broadcastMediums,
		created: getCurrentTime(),
		modified: getCurrentTime()
	}))
	Meteor.users.update(userId, {$set: {organizationId: id}})
	return id
}

export function removeOrganization (context: MethodContext) {
	const access = OrganizationContentWriteAccess.anyContent(context)
	const organizationId = access.organizationId
	Organizations.remove({organizationId})
}

class ServerOrganizationAPI extends MethodContextAPI implements NewOrganizationAPI {
	insertOrganization (organization: NewOrganization) {
		return makePromise(() => insertOrganization(this, organization))
	}
	removeOrganization () {
		return makePromise(() => removeOrganization(this))
	}
}


registerClassToMeteorMethods(OrganizationAPIMethods, ServerOrganizationAPI, false)