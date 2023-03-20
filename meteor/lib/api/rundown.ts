import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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
	rundownPlaylistNeedsResync(playlistId: RundownPlaylistId): Promise<string[]>
	rundownPlaylistValidateBlueprintConfig(
		playlistId: RundownPlaylistId
	): Promise<RundownPlaylistValidateBlueprintConfigResult>
}

export enum RundownAPIMethods {
	'rundownPlaylistNeedsResync' = 'rundown.rundownPlaylistNeedsResync',
	'rundownPlaylistValidateBlueprintConfig' = 'rundown.rundownPlaylistValidateBlueprintConfig',
}
