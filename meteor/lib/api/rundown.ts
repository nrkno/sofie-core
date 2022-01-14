import { RundownId } from '../collections/Rundowns'
import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from './userActions'

export interface RundownPlaylistValidateBlueprintConfigResult {
	studio: string[]
	showStyles: Array<{
		id: string
		name: string
		checkFailed: boolean
		fields: string[]
	}>
}

export interface NewRundownAPI {
	removeRundownPlaylist(playlistId: RundownPlaylistId): Promise<void>
	resyncRundownPlaylist(playlistId: RundownPlaylistId): Promise<ReloadRundownPlaylistResponse>
	rundownPlaylistNeedsResync(playlistId: RundownPlaylistId): Promise<string[]>
	rundownPlaylistValidateBlueprintConfig(
		playlistId: RundownPlaylistId
	): Promise<RundownPlaylistValidateBlueprintConfigResult>
	removeRundown(rundownId: RundownId): Promise<void>
	resyncRundown(rundownId: RundownId): Promise<TriggerReloadDataResponse>
	unsyncRundown(rundownId: RundownId): Promise<void>
	moveRundown(
		rundownId: RundownId,
		intoPlaylistId: RundownPlaylistId | null,
		rundownsIdsInPlaylistInOrder: RundownId[]
	): Promise<void>
	restoreRundownsInPlaylistToDefaultOrder(playlistId: RundownPlaylistId): Promise<void>
}

export enum RundownAPIMethods {
	'removeRundownPlaylist' = 'rundown.removeRundownPlaylist',
	'resyncRundownPlaylist' = 'rundown.resyncRundownPlaylist',
	'rundownPlaylistNeedsResync' = 'rundown.rundownPlaylistNeedsResync',
	'rundownPlaylistValidateBlueprintConfig' = 'rundown.rundownPlaylistValidateBlueprintConfig',

	'removeRundown' = 'rundown.removeRundown',
	'resyncRundown' = 'rundown.resyncRundown',
	'unsyncRundown' = 'rundown.unsyncRundown',
	'moveRundown' = 'rundown.moveRundown',
	'restoreRundownsInPlaylistToDefaultOrder' = 'rundown.restoreRundownsInPlaylistToDefaultOrder',
}
