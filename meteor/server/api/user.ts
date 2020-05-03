import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { literal, getRandomId, makePromise, getCurrentTime } from '../../lib/lib'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { NewUserAPI, UserAPIMethods } from '../../lib/api/user'
import { registerClassToMeteorMethods } from '../methods'
import { SystemReadAccess } from '../security/system'
import { triggerWriteAccess } from '../security/lib/securityVerify'
import { resolveCredentials } from '../security/lib/credentials'
import { logNotAllowed } from '../../server/security/lib/lib'



export function removeUser (context: MethodContext) {
	triggerWriteAccess()
	if (!context.userId) throw new Meteor.Error(403, `Not logged in`)
	const access = SystemReadAccess.currentUser(context.userId, context)
	if (!access) return logNotAllowed('Current user', 'Invalid user id or permissions')
	Meteor.users.remove(context.userId)
	return true
}

class ServerUserAPI extends MethodContextAPI implements NewUserAPI {
	removeUser () {
		return makePromise(() => removeUser(this))
	}
}


registerClassToMeteorMethods(UserAPIMethods, ServerUserAPI, false)