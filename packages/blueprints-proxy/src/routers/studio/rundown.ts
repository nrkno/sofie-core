import { BlueprintResultRundownPlaylist, StudioBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { StudioGetRundownPlaylistInfo, StudioGetShowStyleIdArgs } from '@sofie-automation/shared-lib'
import { StudioUserContext } from '../../context/studioUserContext'
import { MySocket } from '../util'

export async function studio_getShowStyleId(
	studioBlueprint: StudioBlueprintManifest,
	socket: MySocket,
	id: string,
	msg: StudioGetShowStyleIdArgs
): Promise<string | null> {
	const context = new StudioUserContext('getShowStyleId', socket, id, msg)

	return studioBlueprint.getShowStyleId(context, msg.showStyles, msg.ingestRundown)
}

export async function studio_getRundownPlaylistInfo(
	studioBlueprint: StudioBlueprintManifest,
	socket: MySocket,
	id: string,
	msg: StudioGetRundownPlaylistInfo
): Promise<BlueprintResultRundownPlaylist | null> {
	if (!studioBlueprint.getRundownPlaylistInfo) throw new Error('Not supported') // TODO - this will have broken our ability to know if it is implemented or not..

	const context = new StudioUserContext('getRundownPlaylistInfo', socket, id, msg)

	return studioBlueprint.getRundownPlaylistInfo(context, msg.rundowns, msg.playlistExternalId)
}
