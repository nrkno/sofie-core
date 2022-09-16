import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { MongoQuery, UserId } from '../../lib/typings/meteor'
import { logNotAllowed } from './lib/lib'
import { allowAccessToRundownPlaylist } from './lib/security'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import { Credentials, ResolvedCredentials, resolveCredentials } from './lib/credentials'
import { triggerWriteAccess } from './lib/securityVerify'
import { isProtectedString } from '../../lib/lib'
import { Rundown, RundownId, Rundowns } from '../../lib/collections/Rundowns'
import { OrganizationId } from '../../lib/collections/Organization'
import { Settings } from '../../lib/Settings'
import { StudioId } from '../../lib/collections/Studios'

type RundownPlaylistContent = { playlistId: RundownPlaylistId }
export namespace RundownPlaylistReadAccess {
	export function rundownPlaylist(
		selector: MongoQuery<{ _id: RundownPlaylistId }>,
		cred: Credentials | ResolvedCredentials
	): boolean {
		return rundownPlaylistContent({ playlistId: selector._id }, cred)
	}
	/** Handles read access for all rundown content (segments, parts, pieces etc..) */
	export function rundownPlaylistContent(
		selector: MongoQuery<RundownPlaylistContent>,
		cred: Credentials | ResolvedCredentials
	): boolean {
		triggerWriteAccess()
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.playlistId) throw new Meteor.Error(400, 'selector must contain playlistId')

		const access = allowAccessToRundownPlaylist(cred, selector.playlistId)
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
	playlist: RundownPlaylist | null
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
	export function rundown(cred0: Credentials, existingRundown: Rundown | RundownId): RundownContentAccess {
		triggerWriteAccess()
		if (existingRundown && isProtectedString(existingRundown)) {
			const rundownId = existingRundown
			const m = Rundowns.findOne(rundownId)
			if (!m) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
			existingRundown = m
		}
		return { ...anyContent(cred0, existingRundown.playlistId), rundown: existingRundown }
	}
	export function playout(cred0: Credentials, playlistId: RundownPlaylistId): RundownPlaylistContentAccess {
		return anyContent(cred0, playlistId)
	}
	/** Return credentials if writing is allowed, throw otherwise */
	export function anyContent(cred0: Credentials, playlistId: RundownPlaylistId): RundownPlaylistContentAccess {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) {
			const playlist = RundownPlaylists.findOne(playlistId) || null
			return {
				userId: null,
				organizationId: null,
				studioId: playlist?.studioId || null,
				playlist: playlist,
				cred: cred0,
			}
		}
		const cred = resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organization) throw new Meteor.Error(500, `User has no organization`)
		const access = allowAccessToRundownPlaylist(cred, playlistId)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return {
			userId: cred.user._id,
			organizationId: cred.organization._id,
			studioId: access.document?.studioId || null,
			playlist: access.document,
			cred: cred,
		}
	}
}
