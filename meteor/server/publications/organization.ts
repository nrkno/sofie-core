import { meteorPublish, AutoFillSelector } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
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
import { BlueprintId, OrganizationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { check, Match } from '../../lib/check'
import { getCurrentTime } from '../../lib/lib'

meteorPublish(
	MeteorPubSub.organization,
	async function (organizationId: OrganizationId | null, token: string | undefined) {
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
	}
)

meteorPublish(CorelibPubSub.blueprints, async function (blueprintIds: BlueprintId[] | null, token: string | undefined) {
	check(blueprintIds, Match.Maybe(Array))

	// If values were provided, they must have values
	if (blueprintIds && blueprintIds.length === 0) return null

	const { cred, selector } = await AutoFillSelector.organizationId<Blueprint>(this.userId, {}, token)

	// Add the requested filter
	if (blueprintIds) selector._id = { $in: blueprintIds }

	if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
		return Blueprints.findWithCursor(selector, {
			fields: {
				code: 0,
			},
		})
	}
	return null
})
meteorPublish(MeteorPubSub.evaluations, async function (dateFrom: number, dateTo: number, token: string | undefined) {
	const selector0: MongoQuery<Evaluation> = {
		timestamp: {
			$gte: dateFrom,
			$lt: dateTo,
		},
	}

	const { cred, selector } = await AutoFillSelector.organizationId<Evaluation>(this.userId, selector0, token)
	if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
		return Evaluations.findWithCursor(selector)
	}
	return null
})
meteorPublish(MeteorPubSub.snapshots, async function (token: string | undefined) {
	const selector0: MongoQuery<SnapshotItem> = {
		created: {
			$gt: getCurrentTime() - 30 * 24 * 3600 * 1000, // last 30 days
		},
	}

	const { cred, selector } = await AutoFillSelector.organizationId<SnapshotItem>(this.userId, selector0, token)
	if (!cred || (await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) {
		return Snapshots.findWithCursor(selector)
	}
	return null
})
meteorPublish(
	MeteorPubSub.userActionsLog,
	async function (dateFrom: number, dateTo: number, token: string | undefined) {
		const selector0: MongoQuery<UserActionsLogItem> = {
			timestamp: {
				$gte: dateFrom,
				$lt: dateTo,
			},
		}

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
