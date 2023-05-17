import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { ShowStyleReadAccess } from '../security/showStyle'
import { OrganizationReadAccess } from '../security/organization'
import { FindOptions } from '../../lib/collections/lib'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownLayouts, ShowStyleBases, ShowStyleVariants, TriggeredActions } from '../collections'
import { MongoQuery } from '../../lib/typings/meteor'
import { DBTriggeredActions } from '../../lib/collections/TriggeredActions'

meteorPublish(
	PubSub.showStyleBases,
	async function (selector0: MongoQuery<DBShowStyleBase>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.organizationId<DBShowStyleBase>(this.userId, selector0, token)
		const modifier: FindOptions<DBShowStyleBase> = {
			fields: {},
		}
		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector._id && (await ShowStyleReadAccess.showStyleBase(selector, cred)))
		) {
			return ShowStyleBases.findWithCursor(selector, modifier)
		}
		return null
	}
)

meteorPublish(
	PubSub.showStyleVariants,
	async function (selector0: MongoQuery<DBShowStyleVariant>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

		const modifier: FindOptions<DBShowStyleVariant> = {
			fields: {},
		}
		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.showStyleBaseId && (await ShowStyleReadAccess.showStyleBaseContent(selector, cred))) ||
			(selector._id && (await ShowStyleReadAccess.showStyleVariant(selector._id, cred)))
		) {
			return ShowStyleVariants.findWithCursor(selector, modifier)
		}
		return null
	}
)

meteorPublish(
	PubSub.rundownLayouts,
	async function (selector0: MongoQuery<RundownLayoutBase>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

		const modifier: FindOptions<RundownLayoutBase> = {
			fields: {},
		}
		if (!cred || (await ShowStyleReadAccess.showStyleBaseContent(selector, cred))) {
			return RundownLayouts.findWithCursor(selector, modifier)
		}
		return null
	}
)

meteorPublish(
	PubSub.triggeredActions,
	async function (selector0: MongoQuery<DBTriggeredActions>, token: string | undefined) {
		const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

		const modifier: FindOptions<DBTriggeredActions> = {
			fields: {},
		}

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.showStyleBaseId && (await ShowStyleReadAccess.showStyleBaseContent(selector, cred)))
		) {
			return TriggeredActions.findWithCursor(selector, modifier)
		}
		return null
	}
)
