import { Meteor } from 'meteor/meteor'
import { Snapshots, SnapshotItem } from '../../lib/collections/Snapshots'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { logNotAllowed } from './lib/lib'
import { MongoQueryKey } from '../../lib/typings/meteor'
import { allowAccessToOrganization } from './lib/security'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { Settings } from '../../lib/Settings'
import { MethodContext } from '../../lib/api/methods'
import { triggerWriteAccess } from './lib/securityVerify'
import { isProtectedString } from '../../lib/lib'
import {
	fetchShowStyleBaseLight,
	fetchStudioLight,
	ShowStyleBaseLight,
	StudioLight,
} from '../../lib/collections/optimizations'
import {
	BlueprintId,
	OrganizationId,
	ShowStyleBaseId,
	SnapshotId,
	StudioId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

export type BasicAccessContext = { organizationId: OrganizationId | null; userId: UserId | null }

export interface OrganizationContentAccess {
	userId: UserId | null
	organizationId: OrganizationId | null
	cred: ResolvedCredentials | Credentials
}

export namespace OrganizationReadAccess {
	export async function organization(
		organizationId: MongoQueryKey<OrganizationId>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		return organizationContent(organizationId, cred)
	}
	/** Handles read access for all organization content (UserActions, Evaluations etc..) */
	export async function organizationContent(
		organizationId: MongoQueryKey<OrganizationId | null | undefined> | undefined,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!organizationId || !isProtectedString(organizationId))
			throw new Meteor.Error(400, 'selector must contain organizationId')

		const access = await allowAccessToOrganization(cred, organizationId)
		if (!access.read) return logNotAllowed('Organization content', access.reason)

		return true
	}
	export async function adminUsers(
		organizationId: MongoQueryKey<OrganizationId> | undefined,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		// TODO: User roles
		return organizationContent(organizationId, cred)
	}
}
export namespace OrganizationContentWriteAccess {
	// These functions throws if access is not allowed.

	export async function organization(
		cred0: Credentials,
		organizationId: OrganizationId
	): Promise<OrganizationContentAccess> {
		return anyContent(cred0, { organizationId })
	}

	export async function studio(
		cred0: Credentials,
		existingStudio?: StudioLight | StudioId
	): Promise<OrganizationContentAccess & { studio: StudioLight | undefined }> {
		triggerWriteAccess()
		if (existingStudio && isProtectedString(existingStudio)) {
			const studioId = existingStudio
			existingStudio = await fetchStudioLight(studioId)
			if (!existingStudio) throw new Meteor.Error(404, `Studio "${studioId}" not found!`)
		}
		return { ...(await anyContent(cred0, existingStudio)), studio: existingStudio }
	}
	export async function evaluation(cred0: Credentials): Promise<OrganizationContentAccess> {
		return anyContent(cred0)
	}
	export async function mediaWorkFlows(cred0: Credentials): Promise<OrganizationContentAccess> {
		// "All mediaWOrkflows in all devices of an organization"
		return anyContent(cred0)
	}
	export async function blueprint(
		cred0: Credentials,
		existingBlueprint?: Blueprint | BlueprintId,
		allowMissing?: boolean
	): Promise<OrganizationContentAccess & { blueprint: Blueprint | undefined }> {
		triggerWriteAccess()
		if (existingBlueprint && isProtectedString(existingBlueprint)) {
			const blueprintId = existingBlueprint
			existingBlueprint = await Blueprints.findOneAsync(blueprintId)
			if (!existingBlueprint && !allowMissing)
				throw new Meteor.Error(404, `Blueprint "${blueprintId}" not found!`)
		}
		return { ...(await anyContent(cred0, existingBlueprint)), blueprint: existingBlueprint }
	}
	export async function snapshot(
		cred0: Credentials,
		existingSnapshot?: SnapshotItem | SnapshotId
	): Promise<OrganizationContentAccess & { snapshot: SnapshotItem | undefined }> {
		triggerWriteAccess()
		if (existingSnapshot && isProtectedString(existingSnapshot)) {
			const snapshotId = existingSnapshot
			existingSnapshot = await Snapshots.findOneAsync(snapshotId)
			if (!existingSnapshot) throw new Meteor.Error(404, `Snapshot "${snapshotId}" not found!`)
		}
		return { ...(await anyContent(cred0, existingSnapshot)), snapshot: existingSnapshot }
	}
	export async function dataFromSnapshot(
		cred0: Credentials,
		organizationId: OrganizationId
	): Promise<OrganizationContentAccess> {
		return anyContent(cred0, { organizationId: organizationId })
	}
	export async function translationBundle(
		cred0: Credentials,
		existingObj?: { organizationId: OrganizationId | null }
	): Promise<OrganizationContentAccess> {
		return anyContent(cred0, existingObj)
	}
	export async function showStyleBase(
		cred0: Credentials,
		existingShowStyleBase?: ShowStyleBaseLight | ShowStyleBaseId
	): Promise<OrganizationContentAccess & { showStyleBase: ShowStyleBaseLight | undefined }> {
		triggerWriteAccess()
		if (existingShowStyleBase && isProtectedString(existingShowStyleBase)) {
			const showStyleBaseId = existingShowStyleBase
			existingShowStyleBase = await fetchShowStyleBaseLight(showStyleBaseId)
			if (!existingShowStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${showStyleBaseId}" not found!`)
		}
		return { ...(await anyContent(cred0, existingShowStyleBase)), showStyleBase: existingShowStyleBase }
	}
	/** Return credentials if writing is allowed, throw otherwise */
	async function anyContent(
		cred0: Credentials | MethodContext,
		existingObj?: { organizationId: OrganizationId | null }
	): Promise<OrganizationContentAccess> {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) {
			return { userId: null, organizationId: null, cred: cred0 }
		}
		const cred = await resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organizationId) throw new Meteor.Error(500, `User has no organization`)

		const access = await allowAccessToOrganization(
			cred,
			existingObj ? existingObj.organizationId : cred.organizationId
		)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return {
			userId: cred.user._id,
			organizationId: cred.organizationId,
			cred: cred,
		}
	}
}
