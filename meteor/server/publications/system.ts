import { Meteor } from 'meteor/meteor'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { SystemReadAccess } from '../security/system'
import { OrganizationReadAccess } from '../security/organization'
import { Users } from '../collections'
import { getCoreSystemCursor } from '../coreSystem/collection'

meteorPublish(PubSub.coreSystem, async function (token) {
	if (await SystemReadAccess.coreSystem({ userId: this.userId, token })) {
		return getCoreSystemCursor({
			fields: {
				// Include only specific fields in the result documents:
				_id: 1,
				support: 1,
				systemInfo: 1,
				apm: 1,
				name: 1,
				logLevel: 1,
				serviceMessages: 1,
				blueprintId: 1,
				cron: 1,
			},
		})
	}
	return null
})

meteorPublish(PubSub.loggedInUser, async function (token) {
	const currentUserId = this.userId

	if (!currentUserId) return null
	if (await SystemReadAccess.currentUser(currentUserId, { userId: this.userId, token })) {
		return Users.find(
			{
				_id: currentUserId,
			},
			{
				fields: {
					_id: 1,
					username: 1,
					emails: 1,
					profile: 1,
					organizationId: 1,
					superAdmin: 1,
				},
			}
		)
	}
	return null
})
meteorPublish(PubSub.usersInOrganization, async function (selector, token) {
	if (!selector) throw new Meteor.Error(400, 'selector argument missing')
	if (await OrganizationReadAccess.adminUsers(selector.organizationId, { userId: this.userId, token })) {
		return Users.find(selector, {
			fields: {
				_id: 1,
				username: 1,
				emails: 1,
				profile: 1,
				organizationId: 1,
				superAdmin: 1,
			},
		})
	}
	return null
})
