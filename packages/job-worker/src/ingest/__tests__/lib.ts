import { JobContext } from '../../jobs'
import { removeRundownFromDb } from '../../rundownPlaylists'
import { RundownLock } from '../../jobs/lock'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

class FakeRundownLock extends RundownLock {
	constructor(rundownId: RundownId) {
		super(rundownId)
	}
	get isLocked(): boolean {
		return true
	}
	async release(): Promise<void> {
		// Nothing
	}
	//
}

/** For tests, cleanup a playlist and all of its rundowns */
export async function removeRundownPlaylistFromDb(
	context: JobContext,
	playlistIds: RundownPlaylistId[]
): Promise<void> {
	const rundowns: Pick<DBRundown, '_id'>[] = await context.directCollections.Rundowns.findFetch(
		{ playlistId: { $in: playlistIds } },
		{ projection: { _id: 1 } }
	)

	await Promise.allSettled([
		context.directCollections.RundownPlaylists.remove({ _id: { $in: playlistIds } }),
		rundowns.map(async (rd) => removeRundownFromDb(context, new FakeRundownLock(rd._id))),
	])
}
