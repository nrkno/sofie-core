import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { RundownLayouts, RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { ShowStyleReadAccess } from '../security/showStyle'
import { OrganizationReadAccess } from '../security/organization'
import { FindOptions } from '../../lib/collections/lib'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { TriggeredActions } from '../../lib/collections/TriggeredActions'

meteorPublish(PubSub.showStyleBases, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.organizationId<ShowStyleBase>(this.userId, selector0, token)
	const modifier: FindOptions<ShowStyleBase> = {
		fields: {},
	}
	if (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector.organizationId &&
			(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
		(selector._id && (await ShowStyleReadAccess.showStyleBase(selector, cred)))
	) {
		return ShowStyleBases.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.showStyleVariants, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

	const modifier: FindOptions<ShowStyleVariant> = {
		fields: {},
	}
	if (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector.showStyleBaseId && (await ShowStyleReadAccess.showStyleBaseContent(selector, cred))) ||
		(selector._id && (await ShowStyleReadAccess.showStyleVariant(selector._id, cred)))
	) {
		return ShowStyleVariants.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.rundownLayouts, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

	const modifier: FindOptions<RundownLayoutBase> = {
		fields: {},
	}
	if (!cred || (await ShowStyleReadAccess.showStyleBaseContent(selector, cred))) {
		return RundownLayouts.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.triggeredActions, async function (selector0, token) {
	const { cred, selector } = await AutoFillSelector.showStyleBaseId(this.userId, selector0, token)

	const modifier: FindOptions<RundownLayoutBase> = {
		fields: {},
	}

	if (
		!cred ||
		NoSecurityReadAccess.any() ||
		(selector.showStyleBaseId && (await ShowStyleReadAccess.showStyleBaseContent(selector, cred)))
	) {
		return TriggeredActions.find(selector, modifier)
	}
	return null
})
