import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { Evaluation } from '../../lib/collections/Evaluations'
import { SnapshotItem } from '../../lib/collections/Snapshots'
import { UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { OrganizationReadAccess } from '../security/organization'
import { FindOptions } from '../../lib/collections/lib'
import { DBOrganization } from '../../lib/collections/Organization'
import { isProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Blueprints, Evaluations, Organizations, Snapshots, UserActionsLog } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'

meteorPublish(PubSub.organization, async function (organizationId: OrganizationId | null, token: string | undefined) {
	if (!organizationId) return null

	const { cred, selector } = await AutoFillSelector.organizationId(this.userId, { _id: organizationId }, token)
	const modifier: FindOptions<DBOrganization> = {
		fields: {
			name: 1,
			applications: 1,
			broadcastMediums: 1,
			userRoles: 1, // to not expose too much information consider [`userRoles.${this.userId}`]: 1, and a method/publication for getting all the roles, or limiting the returned roles based on requesting user's role
		},
	}
	if (
		isProtectedString(selector.organizationId) &&
		(!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred)))
	) {
		return Organizations.findWithCursor({ _id: selector.organizationId }, modifier)
	}
	return null
})

meteorPublish(PubSub.blueprints, async function (selector0: MongoQuery<Blueprint>, token: string | undefined) {
	const { cred, selector } = await AutoFillSelector.organizationId<Blueprint>(this.userId, selector0, token)
	const modifier: FindOptions<Blueprint> = {
		fields: {
			code: 0,
		},
	}
	if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
		return Blueprints.findWithCursor(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.evaluations, async function (selector0: MongoQuery<Evaluation>, token: string | undefined) {
	const { cred, selector } = await AutoFillSelector.organizationId<Evaluation>(this.userId, selector0, token)
	if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
		return Evaluations.findWithCursor(selector)
	}
	return null
})
meteorPublish(PubSub.snapshots, async function (selector0: MongoQuery<SnapshotItem>, token: string | undefined) {
	const { cred, selector } = await AutoFillSelector.organizationId<SnapshotItem>(this.userId, selector0, token)
	if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
		return Snapshots.findWithCursor(selector)
	}
	return null
})
meteorPublish(
	PubSub.userActionsLog,
	async function (selector0: MongoQuery<UserActionsLogItem>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.organizationId<UserActionsLogItem>(
			this.userId,
			selector0,
			token
		)
		if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
			return UserActionsLog.findWithCursor(selector)
		}
		return null
	}
)
