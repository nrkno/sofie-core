import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyDeep } from 'type-fest'

/** Return true if the rundown is allowed to be moved out of that playlist */
export function allowedToMoveRundownOutOfPlaylist(
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'playlistId'>>
): boolean {
	if (rundown.playlistId !== playlist._id)
		throw new Error(
			`Wrong playlist "${playlist._id}" provided for rundown "${rundown._id}" ("${rundown.playlistId}")`
		)

	if (!playlist.activationId) return true

	return (
		!playlist.activationId ||
		(playlist.currentPartInfo?.rundownId !== rundown._id && playlist.nextPartInfo?.rundownId !== rundown._id)
	)
}
