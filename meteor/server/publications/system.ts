import { Meteor } from 'meteor/meteor'
import { meteorPublish } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { SystemReadAccess } from '../security/system'
import { OrganizationReadAccess } from '../security/organization'
import { CoreSystem, Users } from '../collections'
import { SYSTEM_ID } from '../../lib/collections/CoreSystem'
import { OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'

meteorPublish(MeteorPubSub.coreSystem, async function (token: string | undefined) {
	if (await SystemReadAccess.coreSystem({ userId: this.userId, token })) {
		return CoreSystem.findWithCursor(SYSTEM_ID, {
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
				logo: 1,
				evaluations: 1,
			},
		})
	}
	return null
})

meteorPublish(MeteorPubSub.loggedInUser, async function (token: string | undefined) {
	const currentUserId = this.userId

	if (!currentUserId) return null
	if (await SystemReadAccess.currentUser(currentUserId, { userId: this.userId, token })) {
		return Users.findWithCursor(
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
meteorPublish(
	MeteorPubSub.usersInOrganization,
	async function (organizationId: OrganizationId, token: string | undefined) {
		if (!organizationId) throw new Meteor.Error(400, 'organizationId argument missing')
		if (await OrganizationReadAccess.adminUsers(organizationId, { userId: this.userId, token })) {
			return Users.findWithCursor(
				{ organizationId },
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
	}
)
