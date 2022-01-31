import {
	ShowStyleBlueprintManifest,
	BlueprintSyncIngestPartInstance,
	BlueprintSyncIngestNewData,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { PartNote, SegmentNote } from '../../../lib/api/notes'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { unprotectObject, unprotectObjectArray, literal, clone, stringifyError } from '../../../lib/lib'
import { ReadOnlyCache } from '../../cache/CacheBase'
import { logger } from '../../logging'
import { SyncIngestUpdateToPartInstanceContext } from '../blueprints/context'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites'
import { isTooCloseToAutonext, updateExpectedDurationWithPrerollForPartInstance } from '../playout/lib'
import { CacheForIngest } from './cache'

type PlayStatus = 'previous' | 'current' | 'next'
type ReadOnlyIngestCacheWithoutRundown = Omit<ReadOnlyCache<CacheForIngest>, 'Rundown'>
type SyncedInstance = {
	existingPartInstance: PartInstance
	previousPartInstance: PartInstance | undefined
	playStatus: PlayStatus
	newPart: Part
	piecesThatMayBeActive: Promise<Piece[]>
}

export async function syncChangesToPartInstances(
	cache: CacheForPlayout,
	ingestCache: ReadOnlyIngestCacheWithoutRundown,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>,
	rundown: ReadonlyDeep<Rundown>
): Promise<void> {
	if (cache.Playlist.doc.activationId) {
		if (blueprint.syncIngestUpdateToPartInstance) {
			const playlistPartInstances = getSelectedPartInstancesFromCache(cache)
			const instances: SyncedInstance[] = []
			if (playlistPartInstances.currentPartInstance) {
				findPartAndInsertToSyncedInstanceCandidates(
					instances,
					cache,
					ingestCache,
					playlistPartInstances.currentPartInstance,
					playlistPartInstances.previousPartInstance,
					'current'
				)
				// If the currentPartInstance is adlibbed we probably also need to find the earliest
				// non-adlibbed Part within this segment and check it for updates too. It may have something
				// changed (like timing) that will affect what's going on.
				if (playlistPartInstances.currentPartInstance.orphaned === 'adlib-part') {
					const partAndPartInstance = findLastUnorphanedPartInstanceInSegment(
						cache,
						playlistPartInstances.currentPartInstance
					)
					if (partAndPartInstance) {
						insertToSyncedInstanceCandidates(
							instances,
							cache,
							ingestCache,
							partAndPartInstance.partInstance,
							undefined,
							partAndPartInstance.part,
							'previous'
						)
					}
				}
			}
			if (playlistPartInstances.nextPartInstance) {
				findPartAndInsertToSyncedInstanceCandidates(
					instances,
					cache,
					ingestCache,
					playlistPartInstances.nextPartInstance,
					playlistPartInstances.currentPartInstance,
					isTooCloseToAutonext(playlistPartInstances.currentPartInstance, false) ? 'current' : 'next'
				)
			}

			for (const {
				existingPartInstance,
				previousPartInstance,
				playStatus,
				newPart,
				piecesThatMayBeActive,
			} of instances) {
				const pieceInstancesInPart = cache.PieceInstances.findFetch({
					partInstanceId: existingPartInstance._id,
				})

				const partId = existingPartInstance.part._id
				const existingResultPartInstance: BlueprintSyncIngestPartInstance = {
					partInstance: unprotectObject(existingPartInstance),
					pieceInstances: unprotectObjectArray(pieceInstancesInPart),
				}

				const referencedAdlibIds = _.compact(pieceInstancesInPart.map((p) => p.adLibSourceId))
				const referencedAdlibs = ingestCache.AdLibPieces.findFetch({ _id: { $in: referencedAdlibIds } })

				const adlibPieces = ingestCache.AdLibPieces.findFetch({ partId: partId })
				const adlibActions = ingestCache.AdLibActions.findFetch({ partId: partId })

				const proposedPieceInstances = getPieceInstancesForPart(
					cache,
					previousPartInstance,
					rundown,
					newPart,
					await piecesThatMayBeActive,
					existingPartInstance._id,
					false
				)

				const newResultData: BlueprintSyncIngestNewData = {
					part: unprotectObject(newPart),
					pieceInstances: unprotectObjectArray(proposedPieceInstances),
					adLibPieces: unprotectObjectArray(adlibPieces),
					actions: unprotectObjectArray(adlibActions),
					referencedAdlibs: unprotectObjectArray(referencedAdlibs),
				}

				const syncContext = new SyncIngestUpdateToPartInstanceContext(
					{
						name: `Update to ${newPart.externalId}`,
						identifier: `rundownId=${newPart.rundownId},segmentId=${newPart.segmentId}`,
					},
					cache.Playlist.doc.activationId,
					cache.Studio.doc,
					showStyle,
					rundown,
					existingPartInstance,
					pieceInstancesInPart,
					proposedPieceInstances,
					playStatus
				)
				// TODO - how can we limit the frequency we run this? (ie, how do we know nothing affecting this has changed)
				try {
					// The blueprint handles what in the updated part is going to be synced into the partInstance:
					blueprint.syncIngestUpdateToPartInstance(
						syncContext,
						existingResultPartInstance,
						clone(newResultData),
						playStatus
					)

					// If the blueprint function throws, no changes will be synced to the cache:
					syncContext.applyChangesToCache(cache)
				} catch (err) {
					logger.error(`Error in showStyleBlueprint.syncIngestUpdateToPartInstance: ${stringifyError(err)}`)
				}

				if (playStatus === 'next') {
					updateExpectedDurationWithPrerollForPartInstance(cache, existingPartInstance._id)
				}

				// Save notes:
				if (!existingPartInstance.part.notes) existingPartInstance.part.notes = []
				const notes: PartNote[] = existingPartInstance.part.notes
				let changed = false
				for (const note of syncContext.notes) {
					changed = true
					notes.push(
						literal<SegmentNote>({
							type: note.type,
							message: note.message,
							origin: {
								name: '', // TODO
							},
						})
					)
				}
				if (changed) {
					// TODO - these dont get shown to the user currently
					// TODO - old notes from the sync may need to be pruned, or we will end up with duplicates and 'stuck' notes?
					cache.PartInstances.update(existingPartInstance._id, {
						$set: {
							'part.notes': notes,
						},
					})
				}

				if (existingPartInstance._id === cache.Playlist.doc.currentPartInstanceId) {
					// This should be run after 'current', before 'next':
					await syncPlayheadInfinitesForNextPartInstance(cache)
				}
			}
		} else {
			// blueprint.syncIngestUpdateToPartInstance is not set, default behaviour is to not sync the partInstance at all.
		}
	}
}

/**
 * Inserts given PartInstances and underlying Part to the list of PartInstances to be synced
 */
function insertToSyncedInstanceCandidates(
	instances: SyncedInstance[],
	cache: CacheForPlayout,
	ingestCache: ReadOnlyIngestCacheWithoutRundown,
	thisPartInstance: PartInstance,
	previousPartInstance: PartInstance | undefined,
	part: Part,
	playStatus: PlayStatus
): void {
	instances.push({
		existingPartInstance: thisPartInstance,
		previousPartInstance: previousPartInstance,
		playStatus,
		newPart: part,
		piecesThatMayBeActive: fetchPiecesThatMayBeActiveForPart(cache, ingestCache, part),
	})
}

/**
 * Finds the underlying Part for a given `thisPartInstance` and inserts it to the list of PartInstances to be synced.
 * Doesn't do anything if it can't find the underlying Part in `cache`.
 */
function findPartAndInsertToSyncedInstanceCandidates(
	instances: SyncedInstance[],
	cache: CacheForPlayout,
	ingestCache: ReadOnlyIngestCacheWithoutRundown,
	thisPartInstance: PartInstance,
	previousPartInstance: PartInstance | undefined,
	playStatus: PlayStatus
): void {
	const newPart = cache.Parts.findOne(thisPartInstance.part._id)
	if (!newPart) return

	insertToSyncedInstanceCandidates(
		instances,
		cache,
		ingestCache,
		thisPartInstance,
		previousPartInstance,
		newPart,
		playStatus
	)
}

/**
 * Finds the most recent Part before a given `currentPartInstance` within the current Segment. Then finds the
 * PartInstance that matches that Part. Returns them if found or returns `null` if it can't find anything.
 */
function findLastUnorphanedPartInstanceInSegment(
	cache: CacheForPlayout,
	currentPartInstance: PartInstance
): {
	partInstance: PartInstance
	part: Part
} | null {
	const previousParts = cache.Parts.findFetch(
		{
			segmentId: currentPartInstance.segmentId,
			_rank: {
				$lte: currentPartInstance.part._rank,
			},
		},
		{
			sort: {
				_rank: -1,
			},
		}
	)
	// No previous Part found, abort now
	if (previousParts.length === 0) return null

	// Go through the Previous Parts and find one that has been played. Ideally, this will return on the first iteration.
	for (const previousPart of previousParts) {
		// If we've found an old Part that matches what we need, let's look for it's corresponding
		// non-reset, same-playthrough PartInstance as the currentPartInstance
		const oldPartInstance = cache.PartInstances.findOne(
			(p) =>
				p.part._id === previousPart._id &&
				!p.orphaned &&
				!p.reset &&
				p.playlistActivationId === cache.Playlist.doc.activationId &&
				p.segmentPlayoutId === currentPartInstance.segmentPlayoutId
		)

		// No matching PartInstance found, continue to the next Part
		if (!oldPartInstance) continue

		return {
			partInstance: oldPartInstance,
			part: previousPart,
		}
	}

	return null
}
