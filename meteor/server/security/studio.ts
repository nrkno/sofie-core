import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import {
	ExternalMessageQueue,
	ExternalMessageQueueObj,
	ExternalMessageQueueObjId,
} from '../../lib/collections/ExternalMessageQueue'
import { OrganizationId } from '../../lib/collections/Organization'
import { RecordedFile, RecordedFileId, RecordedFiles } from '../../lib/collections/RecordedFiles'
import { RundownPlaylist, RundownPlaylistId, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Studio, StudioId, Studios } from '../../lib/collections/Studios'
import { isProtectedString } from '../../lib/lib'
import { Settings } from '../../lib/Settings'
import { MongoQuery, UserId } from '../../lib/typings/meteor'
import { Credentials, resolveCredentials, ResolvedCredentials } from './lib/credentials'
import { logNotAllowed } from './lib/lib'
import { allowAccessToStudio } from './lib/security'
import { triggerWriteAccess } from './lib/securityVerify'

type StudioContent = { studioId: StudioId }
export namespace StudioReadAccess {
	export function studio(selector: MongoQuery<{ _id: StudioId }>, cred: Credentials | ResolvedCredentials): boolean {
		return studioContent({ studioId: selector._id }, cred)
	}
	/** Handles read access for all studioId content */
	export function studioContent(
		selector: MongoQuery<StudioContent>,
		cred: Credentials | ResolvedCredentials
	): boolean {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.studioId) throw new Meteor.Error(400, 'selector must contain studioId')

		const access = allowAccessToStudio(cred, selector.studioId)
		if (!access.read) return logNotAllowed('Studio content', access.reason)

		return true
	}
}
export namespace StudioContentWriteAccess {
	// These functions throws if access is not allowed.

	export function rundownPlaylist(cred0: Credentials, existingPlaylist: RundownPlaylist | RundownPlaylistId) {
		triggerWriteAccess()
		if (existingPlaylist && isProtectedString(existingPlaylist)) {
			const playlistId = existingPlaylist
			const m = RundownPlaylists.findOne(playlistId)
			if (!m) throw new Meteor.Error(404, `RundownPlaylist "${playlistId}" not found!`)
			existingPlaylist = m
		}
		return { ...anyContent(cred0, existingPlaylist.studioId), playlist: existingPlaylist }
	}
	export function dataFromSnapshot(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}
	export function recordedFiles(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}
	export function timeline(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}
	export function recordedFile(cred0: Credentials, existingFile: RecordedFile | RecordedFileId) {
		triggerWriteAccess()
		if (existingFile && isProtectedString(existingFile)) {
			const fileId = existingFile
			const m = RecordedFiles.findOne(fileId)
			if (!m) throw new Meteor.Error(404, `RecordedFile "${fileId}" not found!`)
			existingFile = m
		}
		return { ...anyContent(cred0, existingFile.studioId), file: existingFile }
	}
	export function baseline(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}
	export function bucket(cred0: Credentials, studioId: StudioId) {
		return anyContent(cred0, studioId)
	}
	export function externalMessage(
		cred0: Credentials,
		existingMessage: ExternalMessageQueueObj | ExternalMessageQueueObjId
	) {
		triggerWriteAccess()
		if (existingMessage && isProtectedString(existingMessage)) {
			const messageId = existingMessage
			const m = ExternalMessageQueue.findOne(messageId)
			if (!m) throw new Meteor.Error(404, `ExternalMessage "${messageId}" not found!`)
			existingMessage = m
		}
		return { ...anyContent(cred0, existingMessage.studioId), message: existingMessage }
	}
	/** Return credentials if writing is allowed, throw otherwise */
	export function anyContent(
		cred0: Credentials,
		studioId: StudioId
	): {
		userId: UserId | null
		organizationId: OrganizationId | null
		studioId: StudioId | null
		studio: Studio | null
		cred: ResolvedCredentials | Credentials
	} {
		triggerWriteAccess()
		if (!Settings.enableUserAccounts) {
			return {
				userId: null,
				organizationId: null,
				studioId: studioId,
				studio: Studios.findOne(studioId) || null,
				cred: cred0,
			}
		}
		const cred = resolveCredentials(cred0)
		if (!cred.user) throw new Meteor.Error(403, `Not logged in`)
		if (!cred.organization) throw new Meteor.Error(500, `User has no organization`)
		const access = allowAccessToStudio(cred, studioId)
		if (!access.update) throw new Meteor.Error(403, `Not allowed: ${access.reason}`)

		return {
			userId: cred.user._id,
			organizationId: cred.organization._id,
			studioId: studioId,
			studio: access.document,
			cred: cred,
		}
	}
}
export function studioContentAllowWrite(userId, doc: StudioContent): boolean {
	const access = allowAccessToStudio({ userId: userId }, doc.studioId)
	if (!access.update) return logNotAllowed('Studio content', access.reason)
	return true
}
