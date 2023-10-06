import { BlueprintSyncIngestNewData, BlueprintSyncIngestPartInstance } from '@sofie-automation/blueprints-integration'
import { ReadOnlyCache } from '../cache/CacheBase'
import { JobContext } from '../jobs'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import { CacheForIngest } from './cache'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartNote, SegmentNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { literal, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites'
import { isTooCloseToAutonext, updateExpectedDurationWithPrerollForPartInstance } from '../playout/lib'
import _ = require('underscore')
import { SyncIngestUpdateToPartInstanceContext } from '../blueprints/context'
import {
	convertAdLibActionToBlueprints,
	convertAdLibPieceToBlueprints,
	convertPartInstanceToBlueprints,
	convertPartToBlueprints,
	convertPieceInstanceToBlueprints,
} from '../blueprints/context/lib'
import { getRundown } from './lib'

type PlayStatus = 'previous' | 'current' | 'next'
type SyncedInstance = {
	existingPartInstance: DBPartInstance
	previousPartInstance: DBPartInstance | undefined
	playStatus: PlayStatus
	newPart: DBPart | undefined
	piecesThatMayBeActive: Promise<Piece[]>
}

/**
 * Attempt to sync the current and next Part into their PartInstances
 * This defers out to the Blueprints to do the syncing
 * @param context Context of the job ebeing run
 * @param cache Playout cache containing containing the Rundown being ingested
 * @param ingestCache Ingest cache for the Rundown
 */
export async function syncChangesToPartInstances(
	context: JobContext,
	cache: CacheForPlayout,
	ingestCache: ReadOnlyCache<CacheForIngest>
): Promise<void> {
	if (cache.Playlist.doc.activationId) {
		// Get the final copy of the rundown
		const rundown = getRundown(ingestCache)

		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		if (blueprint.blueprint.syncIngestUpdateToPartInstance) {
			const playlistPartInstances = getSelectedPartInstancesFromCache(cache)
			const instances: SyncedInstance[] = []
			if (playlistPartInstances.currentPartInstance) {
				// If the currentPartInstance is adlibbed we probably also need to find the earliest
				// non-adlibbed Part within this segment and check it for updates too. It may have something
				// changed (like timing) that will affect what's going on.
				// The previous "planned" Part Instance needs to be inserted into the `instances` first, so that
				// it's ran first through the blueprints.
				if (playlistPartInstances.currentPartInstance.orphaned === 'adlib-part') {
					const partAndPartInstance = findLastUnorphanedPartInstanceInSegment(
						cache,
						playlistPartInstances.currentPartInstance
					)
					if (partAndPartInstance) {
						insertToSyncedInstanceCandidates(
							context,
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
				// We can now run the current Part Instance.
				findPartAndInsertToSyncedInstanceCandidates(
					context,
					instances,
					cache,
					ingestCache,
					playlistPartInstances.currentPartInstance,
					playlistPartInstances.previousPartInstance,
					'current'
				)
			}
			if (playlistPartInstances.nextPartInstance) {
				findPartAndInsertToSyncedInstanceCandidates(
					context,
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
				const pieceInstancesInPart = cache.PieceInstances.findAll(
					(p) => p.partInstanceId === existingPartInstance._id
				)

				const partId = existingPartInstance.part._id
				const existingResultPartInstance: BlueprintSyncIngestPartInstance = {
					partInstance: convertPartInstanceToBlueprints(existingPartInstance),
					pieceInstances: pieceInstancesInPart.map(convertPieceInstanceToBlueprints),
				}

				const proposedPieceInstances = getPieceInstancesForPart(
					context,
					cache,
					previousPartInstance,
					rundown,
					newPart ?? existingPartInstance.part,
					await piecesThatMayBeActive,
					existingPartInstance._id
				)

				logger.info(`Syncing ingest changes for part: ${partId} (orphaned: ${!!newPart})`)

				const referencedAdlibIds = new Set(_.compact(pieceInstancesInPart.map((p) => p.adLibSourceId)))
				const newResultData: BlueprintSyncIngestNewData = {
					part: newPart ? convertPartToBlueprints(newPart) : undefined,
					pieceInstances: proposedPieceInstances.map(convertPieceInstanceToBlueprints),
					adLibPieces: newPart
						? ingestCache.AdLibPieces.findAll((p) => p.partId === newPart._id).map(
								convertAdLibPieceToBlueprints
						  )
						: [],
					actions: newPart
						? ingestCache.AdLibActions.findAll((p) => p.partId === newPart._id).map(
								convertAdLibActionToBlueprints
						  )
						: [],
					referencedAdlibs: ingestCache.AdLibPieces.findAll((p) => referencedAdlibIds.has(p._id)).map(
						convertAdLibPieceToBlueprints
					),
				}

				const syncContext = new SyncIngestUpdateToPartInstanceContext(
					context,
					{
						name: `Update to ${existingPartInstance.part.externalId}`,
						identifier: `rundownId=${existingPartInstance.part.rundownId},segmentId=${existingPartInstance.part.segmentId}`,
					},
					cache.Playlist.doc.activationId,
					context.studio,
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
					blueprint.blueprint.syncIngestUpdateToPartInstance(
						syncContext,
						existingResultPartInstance,
						newResultData,
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
					cache.PartInstances.updateOne(existingPartInstance._id, (p) => {
						p.part.notes = notes
						return p
					})
				}

				if (existingPartInstance._id === cache.Playlist.doc.currentPartInstanceId) {
					// This should be run after 'current', before 'next':
					await syncPlayheadInfinitesForNextPartInstance(context, cache)
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
	context: JobContext,
	instances: SyncedInstance[],
	cache: CacheForPlayout,
	ingestCache: ReadOnlyCache<CacheForIngest>,
	thisPartInstance: DBPartInstance,
	previousPartInstance: DBPartInstance | undefined,
	part: DBPart | undefined,
	playStatus: PlayStatus
): void {
	instances.push({
		existingPartInstance: thisPartInstance,
		previousPartInstance: previousPartInstance,
		playStatus,
		newPart: part,
		piecesThatMayBeActive: fetchPiecesThatMayBeActiveForPart(
			context,
			cache,
			ingestCache,
			part ?? thisPartInstance.part
		),
	})
}

/**
 * Finds the underlying Part for a given `thisPartInstance` and inserts it to the list of PartInstances to be synced.
 * Doesn't do anything if it can't find the underlying Part in `cache`.
 */
function findPartAndInsertToSyncedInstanceCandidates(
	context: JobContext,
	instances: SyncedInstance[],
	cache: CacheForPlayout,
	ingestCache: ReadOnlyCache<CacheForIngest>,
	thisPartInstance: DBPartInstance,
	previousPartInstance: DBPartInstance | undefined,
	playStatus: PlayStatus
): void {
	const newPart = cache.Parts.findOne(thisPartInstance.part._id)

	insertToSyncedInstanceCandidates(
		context,
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
	currentPartInstance: DBPartInstance
): {
	partInstance: DBPartInstance
	part: DBPart
} | null {
	// Find the "latest" (last played), non-orphaned PartInstance in this Segment, in this play-through
	const previousPartInstance = cache.PartInstances.findOne(
		(p) =>
			p.playlistActivationId === currentPartInstance.playlistActivationId &&
			p.segmentId === currentPartInstance.segmentId &&
			p.segmentPlayoutId === currentPartInstance.segmentPlayoutId &&
			p.takeCount < currentPartInstance.takeCount &&
			!!p.orphaned &&
			!p.reset,
		{
			sort: {
				takeCount: -1,
			},
		}
	)

	if (!previousPartInstance) return null

	const previousPart = cache.Parts.findOne(previousPartInstance.part._id)
	if (!previousPart) return null

	return {
		partInstance: previousPartInstance,
		part: previousPart,
	}
}
