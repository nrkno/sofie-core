import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { MethodContext } from '../../lib/api/methods'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
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
	playlist: DBRundownPlaylist
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

/**
 * Check that the current user has write access to the specified playlist, and ensure that the playlist exists
 * @param context
 * @param playlistId Id of the playlist
 */
export async function checkAccessToPlaylist(
	context: MethodContext,
	playlistId: RundownPlaylistId
): Promise<VerifiedRundownPlaylistContentAccess> {
	const access = await RundownPlaylistContentWriteAccess.playout(context, playlistId)
	const playlist = access.playlist
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${playlistId}" not found!`)
	return {
		...access,
		playlist,
		studioId: playlist.studioId,
	}
}

/**
 * Check that the current user has write access to the specified rundown, and ensure that the rundown exists
 * @param context
 * @param rundownId Id of the rundown
 */
export async function checkAccessToRundown(
	context: MethodContext,
	rundownId: RundownId
): Promise<VerifiedRundownContentAccess> {
	const access = await RundownPlaylistContentWriteAccess.rundown(context, rundownId)
	const rundown = access.rundown
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found!`)
	return {
		...access,
		rundown,
		studioId: rundown.studioId,
	}
}
