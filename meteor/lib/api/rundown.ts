import { Rundown, RundownId } from '../collections/Rundowns'
import { NoteType } from './notes'
import * as _ from 'underscore'
import { RundownPlaylistId } from '../collections/RundownPlaylists'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from './userActions'
import { SegmentId } from '../collections/Segments'

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
	resyncSegment(rundownId: RundownId, segmentId: SegmentId): Promise<TriggerReloadDataResponse>
	unsyncRundown(rundownId: RundownId): Promise<void>
	unsyncSegment(rundownId: RundownId, segmentId: SegmentId): Promise<void>
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
	'resyncSegment' = 'rundown.resyncSegment',
	'unsyncRundown' = 'rundown.unsyncRundown',
	'unsyncSegment' = 'rundown.unsyncSegment',
	'moveRundown' = 'rundown.moveRundown',
	'restoreRundownsInPlaylistToDefaultOrder' = 'rundown.restoreRundownsInPlaylistToDefaultOrder',
}

export namespace RundownAPI {
	/** A generic list of playback availability statuses for a Piece */
	export enum PieceStatusCode {
		/** No status has been determined (yet) */
		UNKNOWN = -1,
		/** No fault with piece, can be played */
		OK = 0,
		/** The source (file, live input) is missing and cannot be played, as it would result in BTA */
		SOURCE_MISSING = 1,
		/** The source is present, but should not be played due to a technical malfunction (file is broken, camera robotics failed, REMOTE input is just bars, etc.) */
		SOURCE_BROKEN = 2,
		/** Source not set - the source object is not set to an actual source */
		SOURCE_NOT_SET = 3,
	}
}

/** Run function in context of a rundown. If an error is encountered, the runnningOrder will be notified */
export function runInRundownContext<T>(rundown: Rundown, fcn: () => T, errorInformMessage?: string): T {
	try {
		const result = fcn() as any
		if (_.isObject(result) && result.then && result.catch) {
			// is promise

			// Intercept the error, then throw:
			result.catch((e) => {
				handleRundownContextError(rundown, errorInformMessage, e)
				throw e
			})
		}
		return result
	} catch (e) {
		// Intercept the error, then throw:
		handleRundownContextError(rundown, errorInformMessage, e)
		throw e
	}
}
function handleRundownContextError(rundown: Rundown, errorInformMessage: string | undefined, error: any) {
	rundown.appendNote({
		type: NoteType.ERROR,
		message:
			(errorInformMessage ? errorInformMessage : 'Something went wrong when processing data this rundown.') +
			`Error message: ${(error || 'N/A').toString()}`,
		origin: {
			name: rundown.name,
		},
	})
}
