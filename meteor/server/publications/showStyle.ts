import { meteorPublish, AutoFillSelector } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { ShowStyleReadAccess } from '../security/showStyle'
import { OrganizationReadAccess } from '../security/organization'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownLayouts, ShowStyleBases, ShowStyleVariants, TriggeredActions } from '../collections'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check, Match } from '../../lib/check'

meteorPublish(
	CorelibPubSub.showStyleBases,
	async function (showStyleBaseIds: ShowStyleBaseId[] | null, token: string | undefined) {
		check(showStyleBaseIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.organizationId<DBShowStyleBase>(this.userId, {}, token)

		// Add the requested filter
		if (showStyleBaseIds) selector._id = { $in: showStyleBaseIds }

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector._id && (await ShowStyleReadAccess.showStyleBase(selector.id, cred)))
		) {
			return ShowStyleBases.findWithCursor(selector)
		}
		return null
	}
)

meteorPublish(
	CorelibPubSub.showStyleVariants,
	async function (showStyleVariantIds: ShowStyleVariantId[] | null, token: string | undefined) {
		check(showStyleVariantIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (showStyleVariantIds && showStyleVariantIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.showStyleBaseId<DBShowStyleVariant>(this.userId, {}, token)

		// Add the requested filter
		if (showStyleVariantIds) selector._id = { $in: showStyleVariantIds }

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.showStyleBaseId && (await ShowStyleReadAccess.showStyleBaseContent(selector, cred))) ||
			(selector._id && (await ShowStyleReadAccess.showStyleVariant(selector._id, cred)))
		) {
			return ShowStyleVariants.findWithCursor(selector)
		}
		return null
	}
)

meteorPublish(
	MeteorPubSub.rundownLayouts,
	async function (showStyleBaseIds: ShowStyleBaseId[] | null, token: string | undefined) {
		check(showStyleBaseIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

		const selector0: MongoQuery<RundownLayoutBase> = {}
		if (showStyleBaseIds) selector0.showStyleBaseId = { $in: showStyleBaseIds }

		const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

		if (!cred || (await ShowStyleReadAccess.showStyleBaseContent(selector, cred))) {
			return RundownLayouts.findWithCursor(selector)
		}
		return null
	}
)

meteorPublish(
	MeteorPubSub.triggeredActions,
	async function (selector0: MongoQuery<DBTriggeredActions>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.showStyleBaseId && (await ShowStyleReadAccess.showStyleBaseContent(selector, cred)))
		) {
			return TriggeredActions.findWithCursor(selector)
		}
		return null
	}
)
