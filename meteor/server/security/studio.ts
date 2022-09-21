import { Meteor } from 'meteor/meteor'
import { allowAccessToStudio } from './lib/security'
import { StudioId } from '../../lib/collections/Studios'
import { MongoQueryKey, UserId } from '../../lib/typings/meteor'
import { logNotAllowed } from './lib/lib'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObjId,
	ExternalMessageQueueObj,
} from '../../lib/collections/ExternalMessageQueue'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { RundownPlaylist, RundownPlaylistId, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Settings } from '../../lib/Settings'
import { OrganizationId } from '../../lib/collections/Organization'
import { triggerWriteAccess } from './lib/securityVerify'
import { isProtectedString } from '../../lib/lib'
import { fetchStudioLight, StudioLight } from '../../lib/collections/optimizations'

export namespace StudioReadAccess {
	/** Handles read access for all studio document */
	export async function studio(
		studioId: MongoQueryKey<StudioId>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		return studioContent(studioId, cred)
	}
	/** Handles read access for all studioId content */
	export async function studioContent(
		studioId: MongoQueryKey<StudioId | undefined> | undefined,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!studioId || !isProtectedString(studioId)) throw new Meteor.Error(400, 'selector must contain studioId')

		const access = await allowAccessToStudio(cred, studioId)
		if (!access.read) return logNotAllowed('Studio content', access.reason)

		return true
	}
}

/**
 * This is returned from a check of access to a studio.
 * Fields will be populated about the user, and the studio if they have permission
 */
export interface StudioContentAccess {
	userId: UserId | null
	organizationId: OrganizationId | null
	studioId: StudioId
	studio: StudioLight
	cred: ResolvedCredentials | Credentials
}

export interface ExternalMessageContentAccess extends StudioContentAccess {
	message: ExternalMessageQueueObj
}

export namespace StudioContentWriteAccess {
	// These functions throws if access is not allowed.

	export async function rundownPlaylist(cred0: Credentials, existingPlaylist: RundownPlaylist | RundownPlaylistId) {
		triggerWriteAccess()
		if (existingPlaylist && isProtectedString(existingPlaylist)) {
			const playlistId = existingPlaylist
			const m = await RundownPlaylists.findOneAsync(playlistId)
			if (!m) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)
			existingPlaylist = m
		}
		return { ...(await anyContent(cred0, existingPlaylist.studioId)), playlist: existingPlaylist }
	}

	/** Check for permission to restore snapshots into the studio */
	export async function dataFromSnapshot(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}

	/** Check for permission to select active routesets in the studio */
	export async function routeSet(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}

	/** Check for permission to update the studio baseline */
	export async function baseline(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}

	/** Check for permission to modify a bucket or its contents belonging to the studio */
	export async function bucket(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}

	/** Check for permission to execute a function on a PeripheralDevice in the studio */
	export async function executeFunction(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}

	/** Check for permission to modify an ExternalMessageQueueObj */
	export async function externalMessage(
		cred0: Credentials,
		existingMessage: ExternalMessageQueueObj | ExternalMessageQueueObjId
	): Promise<ExternalMessageContentAccess> {
		triggerWriteAccess()
		if (existingMessage && isProtectedString(existingMessage)) {
			const messageId = existingMessage
			const m = await ExternalMessageQueue.findOneAsync(messageId)
			if (!m) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)
			existingMessage = m
		}
		return { ...(await anyContent(cred0, existingMessage.studioId)), message: existingMessage }
	}

	/**
	 * We don't have user levels, so we can use a simple check for all cases
	 * Return credentials if writing is allowed, throw otherwise
	 */
	async function anyContent(cred0: Credentials, studioId: StudioId): Promise<StudioContentAccess> {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) {
			const studio = await fetchStudioLight(studioId)
			if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

			return {
				userId: null,
				organizationId: null,
				studioId: studioId,
				studio: studio,
				cred: cred0,
			}
		}
		const cred = await resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organizationId) throw new Meteor.Error(500, `User has no organization`)

		const access = await allowAccessToStudio(cred, studioId)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)
		if (!access.document) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

		return {
			userId: cred.user._id,
			organizationId: cred.organizationId,
			studioId: studioId,
			studio: access.document,
			cred: cred,
		}
	}
}
