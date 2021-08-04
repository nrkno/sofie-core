import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { clone, getHash, getRandomString, getRank, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectObjectArray, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	OrderMoveRundownToPlaylistProps,
	OrderRestoreToDefaultProps,
	RegeneratePlaylistProps,
	RemovePlaylistProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { ReadonlyDeep } from 'type-fest'
import { BlueprintResultOrderedRundowns } from '@sofie-automation/blueprints-integration'
import { JobContext } from './jobs'
import { logger } from './logging'
import { resetRundownPlaylist } from './playout/lib'
import { runAsPlayoutLock, runWithPlaylistCache } from './playout/lock'
import { updateTimeline } from './playout/timeline'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { WrappedStudioBlueprint } from './blueprints/cache'
import { StudioUserContext } from './blueprints/context'
import { getCurrentTime } from './lib'
import _ = require('underscore')
import { mongoFindOptions } from '@sofie-automation/corelib/dist/mongo'
import { regeneratePlaylistAndRundownOrder, updatePlayoutAfterChangingRundownInPlaylist } from './ingest/commit'
import { DbCacheWriteCollection } from './cache/CacheCollection'
import { allowedToMoveRundownOutOfPlaylist } from './rundown'

export async function handleRemoveRundownPlaylist(context: JobContext, data: RemovePlaylistProps): Promise<void> {
	// TODO - should this lock each rundown for removal? Perhaps by putting work onto the ingest queue?
	await runAsPlayoutLock(context, data, async (playlist) => {
		if (playlist) {
			await removeRundownPlaylistFromDb(context, playlist)
		}
	})
}

/**
 * Run the cached data through blueprints in order to re-generate the Rundown
 */
export async function handleRegenerateRundownPlaylist(
	context: JobContext,
	data: RegeneratePlaylistProps
): Promise<void> {
	const ingestData = await runAsPlayoutLock(context, data, async (playlist, playlistLock) => {
		if (!playlist) throw new Error(`Rundown Playlist "${data.playlistId}" not found`)

		logger.info(`Regenerating rundown playlist ${playlist.name} (${playlist._id})`)

		const rundowns: Array<Pick<DBRundown, '_id' | 'externalId'>> =
			await context.directCollections.Rundowns.findFetch(
				{ playlistId: playlist },
				{ projection: { _id: 1, externalId: 1 } }
			)
		if (rundowns.length === 0) return []

		// Cleanup old state
		if (data.purgeExisting) {
			await removeRundownsFromDb(
				context,
				rundowns.map((r) => r._id)
			)
		} else {
			await runWithPlaylistCache(context, playlist, playlistLock, null, async (cache) => {
				await resetRundownPlaylist(context, cache)

				if (cache.Playlist.doc.activationId) {
					await updateTimeline(context, cache)
				}
			})
		}

		// exit the sync function, so the cache is written back
		return rundowns.map((rundown) => ({
			rundownExternalId: rundown.externalId,
		}))
	})

	// Fire off all the updates in parallel, in their own low-priority tasks
	await Promise.all(
		ingestData.map(async ({ rundownExternalId }) => {
			const job = await context.queueIngestJob(IngestJobs.RegenerateRundown, {
				rundownExternalId: rundownExternalId,
				peripheralDeviceId: null,
			})

			// Attach a catch, to 'handle' the rejection in the background
			job.complete.catch((e: any) => {
				logger.error(
					`Regenerate of Rundown "${rundownExternalId}" for RundownPlaylist "${data.playlistId}" failed: ${e}`
				)
			})
		})
	)
}

/**
 * Convert the playlistExternalId into a playlistId.
 * When we've received an externalId for a playlist, that can directly be used to reference a playlistId
 */
export function getPlaylistIdFromExternalId(studioId: StudioId, playlistExternalId: string): RundownPlaylistId {
	return protectString(getHash(`${studioId}_${playlistExternalId}`))
}

export async function removeRundownPlaylistFromDb(
	context: JobContext,
	playlist: ReadonlyDeep<DBRundownPlaylist>
): Promise<void> {
	if (playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is active and cannot be removed`)

	// We assume we have the master lock at this point
	const rundownIds = (
		await context.directCollections.Rundowns.findFetch({ playlistId: playlist._id }, { projection: { _id: 1 } })
	).map((r) => r._id)

	await Promise.allSettled([
		context.directCollections.RundownPlaylists.remove({ _id: playlist._id }),
		removeRundownsFromDb(context, rundownIds),
	])
}
export async function removeRundownsFromDb(context: JobContext, rundownIds: RundownId[]): Promise<void> {
	// Note: playlists are not removed by this, one could be left behind empty
	if (rundownIds.length > 0) {
		await Promise.allSettled([
			context.directCollections.Rundowns.remove({ _id: { $in: rundownIds } }),
			context.directCollections.AdLibActions.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.AdLibPieces.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.ExpectedMediaItems.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.ExpectedPlayoutItems.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.ExpectedPackages.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.IngestDataCache.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.RundownBaselineAdLibPieces.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.Segments.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.Parts.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.PartInstances.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.Pieces.remove({ startRundownId: { $in: rundownIds } }),
			context.directCollections.PieceInstances.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.RundownBaselineAdLibActions.remove({ rundownId: { $in: rundownIds } }),
			context.directCollections.RundownBaselineObjects.remove({ rundownId: { $in: rundownIds } }),
		])
	}
}

export interface RundownPlaylistAndOrder {
	rundownPlaylist: DBRundownPlaylist
	order: BlueprintResultOrderedRundowns
}

export function produceRundownPlaylistInfoFromRundown(
	context: JobContext,
	studio: ReadonlyDeep<DBStudio>,
	studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint> | undefined,
	existingPlaylist: ReadonlyDeep<DBRundownPlaylist> | undefined,
	playlistId: RundownPlaylistId,
	playlistExternalId: string,
	rundowns: ReadonlyDeep<Array<DBRundown>>
): RundownPlaylistAndOrder {
	const playlistInfo = studioBlueprint?.blueprint?.getRundownPlaylistInfo
		? studioBlueprint.blueprint.getRundownPlaylistInfo(
				new StudioUserContext(
					{
						name: 'produceRundownPlaylistInfoFromRundown',
						identifier: `studioId=${studio._id},playlistId=${playlistId},rundownIds=${rundowns
							.map((r) => r._id)
							.join(',')}`,
						tempSendUserNotesIntoBlackHole: true,
					},
					studio,
					context.studioBlueprint
				),
				unprotectObjectArray(clone<Array<DBRundown>>(rundowns))
		  )
		: null

	const rundownsInDefaultOrder = sortDefaultRundownInPlaylistOrder(rundowns)

	let newPlaylist: DBRundownPlaylist
	if (playlistInfo) {
		newPlaylist = {
			created: getCurrentTime(),
			currentPartInstanceId: null,
			nextPartInstanceId: null,
			previousPartInstanceId: null,

			...clone<DBRundownPlaylist | undefined>(existingPlaylist),

			_id: playlistId,
			externalId: playlistExternalId,
			organizationId: studio.organizationId,
			studioId: studio._id,
			name: playlistInfo.playlist.name,
			expectedStart: playlistInfo.playlist.expectedStart,
			expectedDuration: playlistInfo.playlist.expectedDuration,

			loop: playlistInfo.playlist.loop,

			outOfOrderTiming: playlistInfo.playlist.outOfOrderTiming,
			timeOfDayCountdowns: playlistInfo.playlist.timeOfDayCountdowns,

			modified: getCurrentTime(),
		}
	} else {
		newPlaylist = {
			...defaultPlaylistForRundown(rundownsInDefaultOrder[0], studio, existingPlaylist),
			_id: playlistId,
			externalId: playlistExternalId,
		}
	}

	// If no order is provided, fall back to default sorting:
	const order =
		playlistInfo?.order ??
		_.object(
			literal<Array<[string, number]>>(
				rundownsInDefaultOrder.map((i, index) => [unprotectString(i._id), index + 1])
			)
		)

	return {
		rundownPlaylist: newPlaylist,
		order: order, // Note: if playlist.rundownRanksAreSetInSofie is set, this order should be ignored later
	}
}

function defaultPlaylistForRundown(
	rundown: ReadonlyDeep<DBRundown>,
	studio: ReadonlyDeep<DBStudio>,
	existingPlaylist?: ReadonlyDeep<DBRundownPlaylist>
): Omit<DBRundownPlaylist, '_id' | 'externalId'> {
	return {
		created: getCurrentTime(),
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,

		...clone<DBRundownPlaylist | undefined>(existingPlaylist),

		organizationId: studio.organizationId,
		studioId: studio._id,
		name: rundown.name,
		expectedStart: rundown.expectedStart,
		expectedDuration: rundown.expectedDuration,

		modified: getCurrentTime(),
	}
}

/** Set _rank and playlistId of rundowns in a playlist */
export function updateRundownsInPlaylist(
	_playlist: DBRundownPlaylist,
	rundownRanks: BlueprintResultOrderedRundowns,
	rundownCollection: DbCacheWriteCollection<DBRundown>
): void {
	let maxRank: number = Number.NEGATIVE_INFINITY
	const unrankedRundowns: DBRundown[] = []

	for (const rundown of rundownCollection.findFetch({})) {
		const rundownRank = rundownRanks[unprotectString(rundown._id)]
		if (rundownRank !== undefined) {
			rundown._rank = rundownRank
			rundownCollection.update(rundown._id, { $set: { _rank: rundownRank } })
		} else {
			unrankedRundowns.push(rundown)
		}

		if (!_.isNaN(Number(rundown._rank))) {
			maxRank = Math.max(maxRank, rundown._rank)
		} else {
			unrankedRundowns.push(rundown)
		}
	}

	// Place new/unknown rundowns at the end:

	const orderedUnrankedRundowns = sortDefaultRundownInPlaylistOrder(unrankedRundowns)

	orderedUnrankedRundowns.forEach((rundown) => {
		rundownCollection.update(rundown._id, { $set: { _rank: ++maxRank } })
	})
}

/** Move a rundown manually (by a user in Sofie)  */
export async function moveRundownIntoPlaylist(
	context: JobContext,
	data: OrderMoveRundownToPlaylistProps
): Promise<void> {
	const studio = await context.directCollections.Studios.findOne(context.studioId)
	if (!studio) throw new Error(`Studio "${context.studioId}" not found`)

	// TODO - this feels dangerously like it will clash with ingest/playout operations due to all the locking. Perhaps it should be done as an 'ingest' operation?

	const rundown = await context.directCollections.Rundowns.findOne(data.rundownId)
	if (!rundown || rundown.studioId !== context.studioId) throw new Error(`Rundown "${data.rundownId}" not found`)

	if (data.intoPlaylistId) {
		const tmpIntoPlaylist = await context.directCollections.RundownPlaylists.findOne(data.intoPlaylistId, {
			projection: { studioId: 1 },
		})
		if (!tmpIntoPlaylist || tmpIntoPlaylist.studioId !== context.studioId)
			throw new Error(`RundownPlaylist "${data.intoPlaylistId}" not found`)
	}

	if (data.intoPlaylistId && rundown.playlistId !== data.intoPlaylistId) {
		// Do a check if we're allowed to move out of currently playing playlist:
		await runAsPlayoutLock(context, { playlistId: rundown.playlistId }, async (oldPlaylist, oldPlaylistLock) => {
			if (!oldPlaylist)
				throw new Error(`RundownPlaylists "${rundown.playlistId}" for rundown "${rundown._id}" not found!`)

			if (!(await allowedToMoveRundownOutOfPlaylist(context, oldPlaylist, rundown))) {
				throw new Error(`Not allowed to move currently playing rundown!`)
			}

			// Quickly Remove it from the old playlist so that we can free the lock
			await context.directCollections.Rundowns.update(rundown._id, {
				$set: { playlistId: protectString('__TMP__'), playlistIdIsSetInSofie: true },
			})

			// Regenerate the playlist
			const newPlaylist = await regeneratePlaylistAndRundownOrder(context, studio, oldPlaylist)
			if (newPlaylist) {
				// ensure the 'old' playout is updated to remove any references to the rundown
				await updatePlayoutAfterChangingRundownInPlaylist(context, newPlaylist, oldPlaylistLock, null)
			}
		})
	}

	if (data.intoPlaylistId) {
		// Move into an existing playlist:
		await runAsPlayoutLock(context, { playlistId: data.intoPlaylistId }, async (intoPlaylist, intoPlaylistLock) => {
			if (!intoPlaylist)
				throw new Error(`RundownPlaylists "${data.intoPlaylistId}" for rundown "${rundown._id}" not found!`)

			const rundownsCollection = await DbCacheWriteCollection.createFromDatabase(
				context,
				context.directCollections.Rundowns,
				{
					playlistId: intoPlaylist._id,
				}
			)

			if (!intoPlaylist.rundownRanksAreSetInSofie) {
				intoPlaylist.rundownRanksAreSetInSofie = true
				await context.directCollections.RundownPlaylists.update(intoPlaylist._id, {
					$set: {
						rundownRanksAreSetInSofie: true,
					},
				})
			}
			if (intoPlaylist._id === rundown.playlistId) {
				// Move the rundown within the playlist
				const i = data.rundownsIdsInPlaylistInOrder.indexOf(data.rundownId)
				if (i === -1) throw new Error(`RundownId "${data.rundownId}" not found in rundownsIdsInPlaylistInOrder`)

				const rundownIdBefore: RundownId | undefined = data.rundownsIdsInPlaylistInOrder[i - 1]
				const rundownIdAfter: RundownId | undefined = data.rundownsIdsInPlaylistInOrder[i + 1]
				const rundownBefore: DBRundown | undefined =
					rundownIdBefore && rundownsCollection.findOne(rundownIdBefore)
				const rundownAfter: DBRundown | undefined = rundownIdAfter && rundownsCollection.findOne(rundownIdAfter)

				const newRank: number | undefined = getRank(rundownBefore, rundownAfter)
				if (newRank === undefined) throw new Error(`newRank is undefined`)

				rundownsCollection.update(rundown._id, {
					$set: {
						_rank: newRank,
					},
				})
			} else {
				// Moving from another playlist
				rundownsCollection.replace(rundown)

				// Note: When moving into another playlist, the rundown is placed last.
				rundownsCollection.update(rundown._id, {
					$set: {
						playlistId: intoPlaylist._id,
						playlistIdIsSetInSofie: true,
						_rank: 99999, // The rank will be set later, in updateRundownsInPlaylist
					},
				})
				rundown.playlistId = intoPlaylist._id
				rundown.playlistIdIsSetInSofie = true

				// When updating the rundowns in the playlist, the newly moved rundown will be given it's proper _rank:
				updateRundownsInPlaylist(
					intoPlaylist,
					_.object(
						literal<Array<[string, number]>>(
							data.rundownsIdsInPlaylistInOrder.map((id, index) => [unprotectString(id), index + 1])
						)
					),
					rundownsCollection
				)
			}

			// Update the playlist and the order of the contents
			const newPlaylist = await regeneratePlaylistAndRundownOrder(
				context,
				studio,
				intoPlaylist,
				rundownsCollection
			)
			if (!newPlaylist) {
				throw new Error(`RundownPlaylist must still be valid as it has some Rundowns`)
			}

			await rundownsCollection.updateDatabaseWithData()

			// If the playlist is active this could have changed lookahead
			await updatePlayoutAfterChangingRundownInPlaylist(context, newPlaylist, intoPlaylistLock, rundown)
		})
	} else {
		// Move into a new playlist:

		// No point locking, as we are creating something fresh and unique here

		const externalId = getRandomString()
		const playlist: DBRundownPlaylist = {
			...defaultPlaylistForRundown(rundown, studio),
			externalId: externalId,
			_id: getPlaylistIdFromExternalId(studio._id, externalId),
		}
		await context.directCollections.RundownPlaylists.insertOne(playlist)

		await context.directCollections.Rundowns.update(rundown._id, {
			$set: {
				playlistId: playlist._id,
				playlistIdIsSetInSofie: true,
				_rank: 1,
			},
		})
	}
}

/** Restore the order of rundowns in a playlist, giving control over the ordering back to the NRCS */
export async function restoreRundownsInPlaylistToDefaultOrder(
	context: JobContext,
	data: OrderRestoreToDefaultProps
): Promise<void> {
	await runAsPlayoutLock(context, data, async (playlist, playlistLock) => {
		if (playlist) {
			const studio = await context.directCollections.Studios.findOne(playlist.studioId)

			if (!studio) throw new Error(`Studio "${playlist.studioId}" of playlist "${playlist._id}" not found!`)

			// Update the playlist
			await context.directCollections.RundownPlaylists.update(playlist._id, {
				$set: {
					rundownRanksAreSetInSofie: false,
				},
			})
			const newPlaylist = clone<DBRundownPlaylist>(playlist)
			newPlaylist.rundownRanksAreSetInSofie = false

			// Update the _rank of the rundowns
			const updatedPlaylist = await regeneratePlaylistAndRundownOrder(context, studio, newPlaylist)

			if (updatedPlaylist) {
				// If the playlist is active this could have changed lookahead
				await updatePlayoutAfterChangingRundownInPlaylist(context, updatedPlaylist, playlistLock, null)
			}
		}
	})
}

function sortDefaultRundownInPlaylistOrder(rundowns: ReadonlyDeep<Array<DBRundown>>): ReadonlyDeep<Array<DBRundown>> {
	return mongoFindOptions<ReadonlyDeep<DBRundown>>(rundowns, {
		sort: {
			expectedStart: 1,
			name: 1,
			_id: 1,
		},
	})
}
