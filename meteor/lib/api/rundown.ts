import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from './userActions'

export interface NewRundownAPI {
	resyncRundownPlaylist(playlistId: RundownPlaylistId): Promise<ReloadRundownPlaylistResponse>
	rundownPlaylistNeedsResync(playlistId: RundownPlaylistId): Promise<string[]>

	removeRundown(rundownId: RundownId): Promise<void>
	resyncRundown(rundownId: RundownId): Promise<TriggerReloadDataResponse>
	unsyncRundown(rundownId: RundownId): Promise<void>
}

export enum RundownAPIMethods {
	'removeRundownPlaylist' = 'rundown.removeRundownPlaylist',
	'resyncRundownPlaylist' = 'rundown.resyncRundownPlaylist',
	'rundownPlaylistNeedsResync' = 'rundown.rundownPlaylistNeedsResync',

	'removeRundown' = 'rundown.removeRundown',
	'resyncRundown' = 'rundown.resyncRundown',
	'unsyncRundown' = 'rundown.unsyncRundown',
	'moveRundown' = 'rundown.moveRundown',
	'restoreRundownsInPlaylistToDefaultOrder' = 'rundown.restoreRundownsInPlaylistToDefaultOrder',
}
