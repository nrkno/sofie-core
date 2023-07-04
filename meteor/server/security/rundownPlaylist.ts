import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { logNotAllowed } from './lib/lib'
import { allowAccessToRundownPlaylist } from './lib/security'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { triggerWriteAccess } from './lib/securityVerify'
import { isProtectedString } from '../../lib/lib'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { Settings } from '../../lib/Settings'
import {
	OrganizationId,
	RundownId,
	RundownPlaylistId,
	StudioId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists, Rundowns } from '../collections'

export namespace RundownPlaylistReadAccess {
	/** Handles read access for all playlist document */
	export async function rundownPlaylist(
		id: RundownPlaylistId,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		return rundownPlaylistContent(id, cred)
	}
	/** Handles read access for all playlist content (segments, parts, pieces etc..) */
	export async function rundownPlaylistContent(
		id: RundownPlaylistId,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		triggerWriteAccess()
		check(id, String)
		if (!Settings.enableUserAccounts) return true
		if (!id) throw new Meteor.Error(400, 'selector must contain playlistId')

		const access = await allowAccessToRundownPlaylist(cred, id)
		if (!access.read) return logNotAllowed('RundownPlaylist content', access.reason)

		return true
	}
}

/**
 * This is returned from a check of access to a playlist.
 * Fields will be populated about the user, and the playlist if they have permission
 */
export interface RundownPlaylistContentAccess {
	userId: UserId | null
	organizationId: OrganizationId | null
	studioId: StudioId | null
	playlist: DBRundownPlaylist | null
	cred: ResolvedCredentials | Credentials
}

/**
 * This is returned from a check of access to a rundown.
 * Fields will be populated about the user, and the rundown if they have permission
 */
export interface RundownContentAccess {
	userId: UserId | null
	organizationId: OrganizationId | null
	studioId: StudioId | null
	rundown: Rundown | null
	cred: ResolvedCredentials | Credentials
}

export namespace RundownPlaylistContentWriteAccess {
	/** Access to playout for a playlist, from a rundown. ie the playlist and everything inside it. */
	export async function rundown(
		cred0: Credentials,
		existingRundown: Rundown | RundownId
	): Promise<RundownContentAccess> {
		triggerWriteAccess()
		if (existingRundown && isProtectedString(existingRundown)) {
			const rundownId = existingRundown
			const m = await Rundowns.findOneAsync(rundownId)
			if (!m) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			existingRundown = m
		}

		const access = await anyContent(cred0, existingRundown.playlistId)
		return { ...access, rundown: existingRundown }
	}
	/** Access to playout for a playlist. ie the playlist and everything inside it. */
	export async function playout(
		cred0: Credentials,
		playlistId: RundownPlaylistId
	): Promise<RundownPlaylistContentAccess> {
		return anyContent(cred0, playlistId)
	}
	/**
	 * We don't have user levels, so we can use a simple check for all cases
	 * Return credentials if writing is allowed, throw otherwise
	 */
	async function anyContent(
		cred0: Credentials,
		playlistId: RundownPlaylistId
	): Promise<RundownPlaylistContentAccess> {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) {
			const playlist = await RundownPlaylists.findOneAsync(playlistId)
			return {
				userId: null,
				organizationId: null,
				studioId: playlist?.studioId || null,
				playlist: playlist || null,
				cred: cred0,
			}
		}
		const cred = await resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organizationId) throw new Meteor.Error(500, `User has no organization`)
		const access = await allowAccessToRundownPlaylist(cred, playlistId)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return {
			userId: cred.user._id,
			organizationId: cred.organizationId,
			studioId: access.document?.studioId || null,
			playlist: access.document,
			cred: cred,
		}
	}
}
