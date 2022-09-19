import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { logNotAllowed } from './lib/lib'
import { ShowStyleVariants, ShowStyleVariantId, ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { RundownLayouts, RundownLayoutId, RundownLayoutBase } from '../../lib/collections/RundownLayouts'
import { MongoQuery, MongoQueryKey, UserId } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { allowAccessToShowStyleBase, allowAccessToShowStyleVariant } from './lib/security'
import { OrganizationId } from '../../lib/collections/Organization'
import { triggerWriteAccess } from './lib/securityVerify'
import { Settings } from '../../lib/Settings'
import { isProtectedString } from '../../lib/lib'
import { TriggeredActionId, TriggeredActions, TriggeredActionsObj } from '../../lib/collections/TriggeredActions'
import { SystemWriteAccess } from './system'
import { fetchShowStyleBaseLight, ShowStyleBaseLight } from '../../lib/collections/optimizations'

export namespace ShowStyleReadAccess {
	/** Handles read access for all showstyle document */
	export async function showStyleBase(
		selector: MongoQuery<{ _id: ShowStyleBaseId }>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		return showStyleBaseContent({ showStyleBaseId: selector._id }, cred)
	}

	/** Handles read access for all showstyle content */
	export async function showStyleBaseContent<T extends { showStyleBaseId: ShowStyleBaseId | null }>(
		selector: MongoQuery<T>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.showStyleBaseId || !isProtectedString(selector.showStyleBaseId))
			throw new Meteor.Error(400, 'selector must contain showStyleBaseId')

		const access = await allowAccessToShowStyleBase(cred, selector.showStyleBaseId)
		if (!access.read) return logNotAllowed('ShowStyleBase content', access.reason)

		return true
	}

	/** Check for read access to the showstyle variants */
	export async function showStyleVariant(
		showStyleVariantId: MongoQueryKey<ShowStyleVariantId>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!showStyleVariantId) throw new Meteor.Error(400, 'selector must contain _id')

		const access = await allowAccessToShowStyleVariant(cred, showStyleVariantId)
		if (!access.read) return logNotAllowed('ShowStyleVariant', access.reason)

		return true
	}
}
export namespace ShowStyleContentWriteAccess {
	// These functions throws if access is not allowed.

	/** Check permissions for write access to a showStyleVariant */
	export async function showStyleVariant(cred0: Credentials, existingVariant: ShowStyleVariant | ShowStyleVariantId) {
		triggerWriteAccess()
		if (existingVariant && isProtectedString(existingVariant)) {
			const variantId = existingVariant
			const m = await ShowStyleVariants.findOneAsync(variantId)
			if (!m) throw new Meteor.Error(404, `ShowStyleVariant "${variantId}" not found!`)
			existingVariant = m
		}
		return { ...(await anyContent(cred0, existingVariant.showStyleBaseId)), showStyleVariant: existingVariant }
	}
	/** Check permissions for write access to a rundownLayout */
	export async function rundownLayout(cred0: Credentials, existingLayout: RundownLayoutBase | RundownLayoutId) {
		triggerWriteAccess()
		if (existingLayout && isProtectedString(existingLayout)) {
			const layoutId = existingLayout
			const m = await RundownLayouts.findOneAsync(layoutId)
			if (!m) throw new Meteor.Error(404, `RundownLayout "${layoutId}" not found!`)
			existingLayout = m
		}
		return { ...(await anyContent(cred0, existingLayout.showStyleBaseId)), rundownLayout: existingLayout }
	}
	/** Check permissions for write access to a triggeredAction */
	export async function triggeredActions(
		cred0: Credentials,
		existingTriggeredAction: TriggeredActionsObj | TriggeredActionId
	) {
		triggerWriteAccess()
		if (existingTriggeredAction && isProtectedString(existingTriggeredAction)) {
			const layoutId = existingTriggeredAction
			const m = await TriggeredActions.findOneAsync(layoutId)
			if (!m) throw new Meteor.Error(404, `RundownLayout "${layoutId}" not found!`)
			existingTriggeredAction = m
		}
		if (existingTriggeredAction.showStyleBaseId) {
			return {
				...(await anyContent(cred0, existingTriggeredAction.showStyleBaseId)),
				triggeredActions: existingTriggeredAction,
			}
		} else {
			return SystemWriteAccess.coreSystem(cred0)
		}
	}
	/** Return credentials if writing is allowed, throw otherwise */
	export async function anyContent(
		cred0: Credentials,
		showStyleBaseId: ShowStyleBaseId
	): Promise<{
		userId: UserId | null
		organizationId: OrganizationId | null
		showStyleBaseId: ShowStyleBaseId | null
		showStyleBase: ShowStyleBaseLight | null
		cred: ResolvedCredentials | Credentials
	}> {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) {
			return {
				userId: null,
				organizationId: null,
				showStyleBaseId: showStyleBaseId,
				showStyleBase: (await fetchShowStyleBaseLight(showStyleBaseId)) || null,
				cred: cred0,
			}
		}
		const cred = await resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organizationId) throw new Meteor.Error(500, `User has no organization`)

		const access = await allowAccessToShowStyleBase(cred, showStyleBaseId)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return {
			userId: cred.user._id,
			organizationId: cred.organizationId,
			showStyleBaseId: showStyleBaseId,
			showStyleBase: access.document,
			cred: cred,
		}
	}
}
