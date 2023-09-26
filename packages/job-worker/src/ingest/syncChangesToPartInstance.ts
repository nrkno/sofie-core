import { BlueprintSyncIngestNewData, BlueprintSyncIngestPartInstance } from '@sofie-automation/blueprints-integration'
import { ReadOnlyCache } from '../cache/CacheBase'
import { JobContext } from '../jobs'
import { PlayoutModel } from '../playout/cacheModel/PlayoutModel'
import { PartInstanceWithPieces } from '../playout/cacheModel/PartInstanceWithPieces'
import { CacheForIngest } from './cache'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartNote, SegmentNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
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
import { validateScratchpartPartInstanceProperties } from '../playout/scratchpad'
import { ReadonlyDeep } from 'type-fest'
import { hackConvertIngestCacheToRundownWithSegments } from './commit'

type PlayStatus = 'previous' | 'current' | 'next'
type SyncedInstance = {
	existingPartInstance: PartInstanceWithPieces
	previousPartInstance: PartInstanceWithPieces | null
	playStatus: PlayStatus
	newPart: ReadonlyDeep<DBPart> | undefined
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
	cache: PlayoutModel,
	ingestCache: ReadOnlyCache<CacheForIngest>
): Promise<void> {
	if (cache.Playlist.activationId) {
		// Get the final copy of the rundown
		const rundownWrapped = hackConvertIngestCacheToRundownWithSegments(ingestCache)

		const showStyle = await context.getShowStyleCompound(
			rundownWrapped.Rundown.showStyleVariantId,
			rundownWrapped.Rundown.showStyleBaseId
		)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		if (blueprint.blueprint.syncIngestUpdateToPartInstance) {
			const currentPartInstance = cache.CurrentPartInstance
			const nextPartInstance = cache.NextPartInstance
			const previousPartInstance = cache.PreviousPartInstance

			const instances: SyncedInstance[] = []
			if (currentPartInstance) {
				// If the currentPartInstance is adlibbed we probably also need to find the earliest
				// non-adlibbed Part within this segment and check it for updates too. It may have something
				// changed (like timing) that will affect what's going on.
				// The previous "planned" Part Instance needs to be inserted into the `instances` first, so that
				// it's ran first through the blueprints.
				if (currentPartInstance.PartInstance.orphaned === 'adlib-part') {
					const partAndPartInstance = findLastUnorphanedPartInstanceInSegment(
						cache,
						currentPartInstance.PartInstance
					)
					if (partAndPartInstance) {
						insertToSyncedInstanceCandidates(
							context,
							instances,
							cache,
							ingestCache,
							partAndPartInstance.partInstance,
							null,
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
					currentPartInstance,
					previousPartInstance,
					'current'
				)
			}
			if (nextPartInstance) {
				findPartAndInsertToSyncedInstanceCandidates(
					context,
					instances,
					cache,
					ingestCache,
					nextPartInstance,
					currentPartInstance,
					isTooCloseToAutonext(currentPartInstance?.PartInstance, false) ? 'current' : 'next'
				)
			}

			for (const {
				existingPartInstance,
				previousPartInstance,
				playStatus,
				newPart,
				piecesThatMayBeActive,
			} of instances) {
				const pieceInstancesInPart = existingPartInstance.PieceInstances

				const partId = existingPartInstance.PartInstance.part._id
				const existingResultPartInstance: BlueprintSyncIngestPartInstance = {
					partInstance: convertPartInstanceToBlueprints(existingPartInstance.PartInstance),
					pieceInstances: pieceInstancesInPart.map(convertPieceInstanceToBlueprints),
				}

				const proposedPieceInstances = getPieceInstancesForPart(
					context,
					cache,
					previousPartInstance,
					rundownWrapped,
					newPart ?? existingPartInstance.PartInstance.part,
					await piecesThatMayBeActive,
					existingPartInstance.PartInstance._id
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

				const clonedPartInstance = existingPartInstance.clone()

				const syncContext = new SyncIngestUpdateToPartInstanceContext(
					context,
					{
						name: `Update to ${clonedPartInstance.PartInstance.part.externalId}`,
						identifier: `rundownId=${clonedPartInstance.PartInstance.part.rundownId},segmentId=${clonedPartInstance.PartInstance.part.segmentId}`,
					},
					cache.Playlist.activationId,
					context.studio,
					showStyle,
					rundownWrapped.Rundown,
					clonedPartInstance,
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
					// TODO - save clonedPartInstance
					cache.replacePartInstance(clonedPartInstance)
				} catch (err) {
					logger.error(`Error in showStyleBlueprint.syncIngestUpdateToPartInstance: ${stringifyError(err)}`)
				}

				if (playStatus === 'next') {
					updateExpectedDurationWithPrerollForPartInstance(cache, clonedPartInstance.PartInstance._id)
				}

				// Save notes:
				const newNotes: PartNote[] = []
				for (const note of syncContext.notes) {
					newNotes.push(
						literal<SegmentNote>({
							type: note.type,
							message: note.message,
							origin: {
								name: '', // TODO
							},
						})
					)
				}
				if (newNotes.length) {
					// TODO - these dont get shown to the user currently
					// TODO - old notes from the sync may need to be pruned, or we will end up with duplicates and 'stuck' notes?+
					clonedPartInstance.appendNotes(newNotes)

					validateScratchpartPartInstanceProperties(context, cache, existingPartInstance.PartInstance._id)
				}

				if (clonedPartInstance.PartInstance._id === cache.Playlist.currentPartInfo?.partInstanceId) {
					// This should be run after 'current', before 'next':
					await syncPlayheadInfinitesForNextPartInstance(
						context,
						cache,
						cache.CurrentPartInstance,
						cache.NextPartInstance
					)
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
	cache: PlayoutModel,
	ingestCache: ReadOnlyCache<CacheForIngest>,
	thisPartInstance: PartInstanceWithPieces,
	previousPartInstance: PartInstanceWithPieces | null,
	part: ReadonlyDeep<DBPart> | undefined,
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
			part ?? thisPartInstance.PartInstance.part
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
	cache: PlayoutModel,
	ingestCache: ReadOnlyCache<CacheForIngest>,
	thisPartInstance: PartInstanceWithPieces,
	previousPartInstance: PartInstanceWithPieces | null,
	playStatus: PlayStatus
): void {
	const newPart = cache.findPart(thisPartInstance.PartInstance.part._id)

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
	cache: PlayoutModel,
	currentPartInstance: ReadonlyDeep<DBPartInstance>
): {
	partInstance: PartInstanceWithPieces
	part: ReadonlyDeep<DBPart>
} | null {
	// Find the "latest" (last played), non-orphaned PartInstance in this Segment, in this play-through
	const previousPartInstance = cache.SortedLoadedPartInstances.reverse().find(
		(p) =>
			p.PartInstance.playlistActivationId === currentPartInstance.playlistActivationId &&
			p.PartInstance.segmentId === currentPartInstance.segmentId &&
			p.PartInstance.segmentPlayoutId === currentPartInstance.segmentPlayoutId &&
			p.PartInstance.takeCount < currentPartInstance.takeCount &&
			!!p.PartInstance.orphaned &&
			!p.PartInstance.reset
	)

	if (!previousPartInstance) return null

	const previousPart = cache.findPart(previousPartInstance.PartInstance.part._id)
	if (!previousPart) return null

	return {
		partInstance: previousPartInstance,
		part: previousPart,
	}
}
