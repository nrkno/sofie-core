import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { MethodContext } from '../../lib/api/methods'
import { RundownPlaylistId, RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundown, RundownId } from '../../lib/collections/Rundowns'
import {
	RundownContentAccess,
	RundownPlaylistContentAccess,
	RundownPlaylistContentWriteAccess,
} from '../security/rundownPlaylist'

/**
 * This is returned from a check of access to a playlist, when access is granted.
 * Fields will be populated about the user.
 * It is identical to RundownPlaylistContentAccess, except for confirming access is allowed
 */
export interface VerifiedRundownPlaylistContentAccess extends RundownPlaylistContentAccess {
	playlist: RundownPlaylist
	studioId: StudioId
}
/**
 * This is returned from a check of access to a rundown, when access is granted.
 * Fields will be populated about the user.
 * It is identical to RundownContentAccess, except for confirming access is allowed
 */
export interface VerifiedRundownContentAccess extends RundownContentAccess {
	rundown: Rundown
	studioId: StudioId
}

export function checkAccessToPlaylist(
	context: MethodContext,
	playlistId: RundownPlaylistId
): VerifiedRundownPlaylistContentAccess {
	const access = RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
	return {
		...access,
		playlist,
		studioId: playlist.studioId,
	}
}

export function checkAccessToRundown(context: MethodContext, rundownId: RundownId): VerifiedRundownContentAccess {
	const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
	const rundown = access.rundown
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return {
		...access,
		rundown,
		studioId: rundown.studioId,
	}
}

export function checkAccessAndGetPlaylist(context: MethodContext, playlistId: RundownPlaylistId): RundownPlaylist {
	const access = RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
	return playlist
}

export function checkAccessAndGetRundown(context: MethodContext, rundownId: RundownId): Rundown {
	const access = RundownPlaylistContentWriteAccess.rundown(context, rundownId)
	const rundown = access.rundown
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return rundown
}
