import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import _ from 'underscore'
import { Rundowns } from './libCollections'
import { FindOptions } from './lib'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

/**
 * Direct database accessors for the RundownPlaylist
 * These used to reside on the Rundown class
 */
export class RundownPlaylistCollectionUtil {
	/** Returns an array of all Rundowns in the RundownPlaylist, sorted in playout order */
	static getRundownsOrdered(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		const allRundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlist._id, selector, options)

		const rundownsMap = normalizeArrayToMap(allRundowns, '_id')

		const sortedIds = sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, Array.from(rundownsMap.keys()))

		return _.compact(sortedIds.map((id) => rundownsMap.get(id)))
	}
	/** Returns an array of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownsUnordered(
		playlistId: RundownPlaylistId,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		return Rundowns.find(
			{
				playlistId: playlistId,
				...selector,
			},
			{
				sort: {
					_id: 1,
				},
				...options,
			}
		).fetch()
	}
}
