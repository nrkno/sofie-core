import { RundownId } from '../../../lib/collections/Rundowns'
import { isProtectedString } from '../../../lib/lib'
import { RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'

enum RundownListDragDropTypes {
	RUNDOWN = 'rundown',
	PLAYLIST = 'playlist',
}

interface IRundownDragObject {
	id: RundownId
}

function isRundownDragObject(obj: any): obj is IRundownDragObject {
	if (!obj) {
		return false
	}

	const { id } = obj

	return isProtectedString(id)
}

enum RundownPlaylistUiActionTypes {
	HANDLE_RUNDOWN_DROP = 'HANDLE_RUNDOWN_DROP',
	/* no-op to use when a drop is handled but no further action is necessary */
	NOOP = 'NOOP',
}

interface IRundownPlaylistUiAction {
	type: string
	rundownId: RundownId
	targetPlaylistId: RundownPlaylistId
}

function isRundownPlaylistUiAction(obj: any): obj is IRundownPlaylistUiAction {
	if (!obj) {
		return false
	}

	const { type, rundownId } = obj

	if (!isProtectedString(rundownId)) {
		return false
	}

	return typeof type === 'string' && type in RundownPlaylistUiActionTypes
}

export {
	IRundownDragObject,
	IRundownPlaylistUiAction,
	isRundownDragObject,
	isRundownPlaylistUiAction,
	RundownListDragDropTypes,
	RundownPlaylistUiActionTypes,
}
