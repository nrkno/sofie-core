import {
	ShowStyleBlueprintManifest,
	BlueprintSyncIngestPartInstance,
	BlueprintSyncIngestNewData,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { PartNote, SegmentNote } from '../../../lib/api/notes'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { unprotectObject, unprotectObjectArray, waitForPromise, literal, clone } from '../../../lib/lib'
import { ReadOnlyCache } from '../../cache/DatabaseCaches'
import { logger } from '../../logging'
import { SyncIngestUpdateToPartInstanceContext } from '../blueprints/context'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites'
import { isTooCloseToAutonext } from '../playout/lib'
import { CacheForIngest } from './cache'

export function syncChangesToPartInstances(
	cache: CacheForPlayout,
	ingestCache: ReadOnlyCache<CacheForIngest>,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>,
	rundown: ReadonlyDeep<Rundown>
) {
	if (cache.Playlist.doc.activationId) {
		if (blueprint.syncIngestUpdateToPartInstance) {
			const playlistPartInstances = getSelectedPartInstancesFromCache(cache)
			const instances: Array<{
				existingPartInstance: PartInstance
				previousPartInstance: PartInstance | undefined
				playStatus: 'current' | 'next'
			}> = []
			if (playlistPartInstances.currentPartInstance)
				instances.push({
					existingPartInstance: playlistPartInstances.currentPartInstance,
					previousPartInstance: playlistPartInstances.previousPartInstance,
					playStatus: 'current',
				})
			if (playlistPartInstances.nextPartInstance)
				instances.push({
					existingPartInstance: playlistPartInstances.nextPartInstance,
					previousPartInstance: playlistPartInstances.currentPartInstance,
					playStatus: isTooCloseToAutonext(playlistPartInstances.currentPartInstance, false)
						? 'current'
						: 'next',
				})

			for (const { existingPartInstance, previousPartInstance, playStatus } of instances) {
				const pieceInstancesInPart = cache.PieceInstances.findFetch({
					partInstanceId: existingPartInstance._id,
				})

				const partId = existingPartInstance.part._id
				const newPart = cache.Parts.findOne(partId)

				if (newPart) {
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
						newPart,
						waitForPromise(fetchPiecesThatMayBeActiveForPart(cache, newPart)),
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
					} catch (e) {
						logger.error(e)
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
						syncPlayheadInfinitesForNextPartInstance(cache)
					}
				} else {
					// the part has been removed, don't sync that
				}
			}
		} else {
			// blueprint.syncIngestUpdateToPartInstance is not set, default behaviour is to not sync the partInstance at all.
		}
	}
}
