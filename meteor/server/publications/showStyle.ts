import { PubSub } from '../../lib/api/pubsub'
import { RundownLayoutBase, RundownLayouts } from '../../lib/collections/RundownLayouts'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { FindOptions } from '../../lib/typings/meteor'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { ShowStyleReadAccess } from '../security/showStyle'
import { AutoFillSelector, meteorPublish } from './lib'

meteorPublish(PubSub.showStyleBases, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	const modifier: FindOptions<ShowStyleBase> = {
		fields: {},
	}
	if (
		NoSecurityReadAccess.any() ||
		(selector.organizationId && OrganizationReadAccess.organizationContent(selector, cred)) ||
		(selector._id && ShowStyleReadAccess.showStyleBase(selector, cred))
	) {
		return ShowStyleBases.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.showStyleVariants, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.showStyleBaseId(this.userId, selector0, token)
	const modifier: FindOptions<ShowStyleVariant> = {
		fields: {},
	}
	if (
		NoSecurityReadAccess.any() ||
		(selector.showStyleBaseId && ShowStyleReadAccess.showStyleBaseContent(selector, cred)) ||
		(selector._id && ShowStyleReadAccess.showStyleVariant(selector, cred))
	) {
		return ShowStyleVariants.find(selector, modifier)
	}
	return null
})

meteorPublish(PubSub.rundownLayouts, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.showStyleBaseId(this.userId, selector0, token)
	const modifier: FindOptions<RundownLayoutBase> = {
		fields: {},
	}
	if (ShowStyleReadAccess.showStyleBaseContent(selector, cred)) {
		return RundownLayouts.find(selector, modifier)
	}
	return null
})
