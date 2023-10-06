import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentNote, PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { SegmentUserContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { postProcessAdLibActions, postProcessAdLibPieces, postProcessPieces } from '../blueprints/postProcess'
import { saveIntoCache, logChanges } from '../cache/lib'
import { logger } from '../logging'
import { CacheForIngest } from './cache'
import { LocalIngestSegment, LocalIngestRundown } from './ingestCache'
import { getSegmentId, getPartId, getRundown, canSegmentBeUpdated } from './lib'
import { JobContext } from '../jobs'
import { CommitIngestData } from './lock'
import { BlueprintResultSegment, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { ReadOnlyCache } from '../cache/CacheBase'

export interface UpdateSegmentsResult {
	segments: DBSegment[]
	parts: DBPart[]
	pieces: Piece[]
	adlibPieces: AdLibPiece[]
	adlibActions: AdLibAction[]
}

async function getWatchedPackagesHelper(
	context: JobContext,
	allRundownWatchedPackages0: WatchedPackagesHelper | null,
	cache: ReadOnlyCache<CacheForIngest>,
	ingestSegments: LocalIngestSegment[]
): Promise<WatchedPackagesHelper> {
	if (allRundownWatchedPackages0) {
		return allRundownWatchedPackages0
	} else {
		const segmentIds = new Set(ingestSegments.map((s) => getSegmentId(cache.RundownId, s.externalId)))
		return WatchedPackagesHelper.createForIngest(
			context,
			cache,
			(p) => 'segmentId' in p && segmentIds.has(p.segmentId)
		)
	}
}

/**
 * Generate and return the content for an array segments
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestSegments The segments to regenerate
 * @param allRundownWatchedPackages0 Optional WatchedPackagesHelper for all Packages in the Rundown. If not provided, packages will be loaded from the database
 * @returns Newly generated documents
 */
export async function calculateSegmentsFromIngestData(
	context: JobContext,
	cache: ReadOnlyCache<CacheForIngest>,
	ingestSegments: LocalIngestSegment[],
	allRundownWatchedPackages0: WatchedPackagesHelper | null
): Promise<UpdateSegmentsResult> {
	const span = context.startSpan('ingest.rundownInput.calculateSegmentsFromIngestData')

	const rundown = getRundown(cache)

	const res: Omit<UpdateSegmentsResult, 'showStyle' | 'blueprint'> = {
		segments: [],
		parts: [],
		pieces: [],
		adlibPieces: [],
		adlibActions: [],
	}

	if (ingestSegments.length > 0) {
		const pShowStyle = context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const pAllRundownWatchedPackages = getWatchedPackagesHelper(
			context,
			allRundownWatchedPackages0,
			cache,
			ingestSegments
		)

		const showStyle = await pShowStyle
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		const allRundownWatchedPackages = await pAllRundownWatchedPackages

		for (const ingestSegment of ingestSegments) {
			const segmentId = getSegmentId(cache.RundownId, ingestSegment.externalId)

			// Ensure the parts are sorted by rank
			ingestSegment.parts.sort((a, b) => a.rank - b.rank)

			// Filter down to the packages for this segment
			const watchedPackages = allRundownWatchedPackages.filter(
				context,
				(p) => 'segmentId' in p && p.segmentId === segmentId
			)

			const context2 = new SegmentUserContext(
				{
					name: `getSegment=${ingestSegment.name}`,
					// Note: this intentionally does not include the segmentId, as parts may be moved between segemnts later on
					// This isn't much entropy, blueprints may want to add more for each Part they generate
					identifier: `rundownId=${rundown._id}`,
				},
				context,
				showStyle,
				rundown,
				watchedPackages
			)
			let blueprintSegment0: BlueprintResultSegment | null = null
			try {
				blueprintSegment0 = await blueprint.blueprint.getSegment(context2, ingestSegment)
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.getSegment: ${stringifyError(err)}`)
				blueprintSegment0 = null
			}

			if (!blueprintSegment0) {
				// Something went wrong when generating the segment

				const newSegment = literal<DBSegment>({
					_id: segmentId,
					rundownId: rundown._id,
					externalId: ingestSegment.externalId,
					externalModified: ingestSegment.modified,
					_rank: ingestSegment.rank,
					notes: [
						{
							type: NoteSeverity.ERROR,
							message: wrapTranslatableMessageFromBlueprints(
								{
									key: 'Internal Error generating segment',
								},
								[blueprint.blueprintId]
							),
							origin: {
								name: '', // TODO
							},
						},
					],
					name: ingestSegment.name,
				})
				res.segments.push(newSegment)

				continue // Don't generate any content for the faulty segment
			}
			const blueprintSegment: BlueprintResultSegment = blueprintSegment0

			// Ensure all parts have a valid externalId set on them
			const knownPartExternalIds = blueprintSegment.parts.map((p) => p.part.externalId)

			const segmentNotes: SegmentNote[] = []
			for (const note of context2.notes) {
				if (!note.partExternalId || knownPartExternalIds.indexOf(note.partExternalId) === -1) {
					segmentNotes.push(
						literal<SegmentNote>({
							type: note.type,
							message: wrapTranslatableMessageFromBlueprints(note.message, [blueprint.blueprintId]),
							origin: {
								name: '', // TODO
							},
						})
					)
				}
			}

			const newSegment = literal<DBSegment>({
				...blueprintSegment.segment,
				_id: segmentId,
				rundownId: rundown._id,
				externalId: ingestSegment.externalId,
				externalModified: ingestSegment.modified,
				_rank: ingestSegment.rank,
				notes: segmentNotes,
			})
			res.segments.push(newSegment)

			blueprintSegment.parts.forEach((blueprintPart, i) => {
				const partId = getPartId(rundown._id, blueprintPart.part.externalId)

				const notes: PartNote[] = []

				for (const note of context2.notes) {
					if (note.partExternalId === blueprintPart.part.externalId) {
						notes.push(
							literal<PartNote>({
								type: note.type,
								message: wrapTranslatableMessageFromBlueprints(note.message, [blueprint.blueprintId]),
								origin: {
									name: '', // TODO
								},
							})
						)
					}
				}

				const existingPart = cache.Parts.findOne(partId)
				const part = literal<DBPart>({
					...blueprintPart.part,
					_id: partId,
					rundownId: rundown._id,
					segmentId: newSegment._id,
					_rank: i, // This gets updated to a rank unique within its segment in a later step
					notes: notes,
					invalidReason: blueprintPart.part.invalidReason
						? {
								...blueprintPart.part.invalidReason,
								message: wrapTranslatableMessageFromBlueprints(
									blueprintPart.part.invalidReason.message,
									[blueprint.blueprintId]
								),
						  }
						: undefined,

					// Preserve:
					status: existingPart?.status, // This property is 'owned' by core and updated via its own flow
					expectedDurationWithPreroll: undefined, // Below
				})
				res.parts.push(part)

				// Update pieces
				const processedPieces = postProcessPieces(
					context,
					blueprintPart.pieces,
					blueprint.blueprintId,
					rundown._id,
					newSegment._id,
					part._id,
					false,
					part.invalid
				)
				res.pieces.push(...processedPieces)
				res.adlibPieces.push(
					...postProcessAdLibPieces(
						context,
						blueprint.blueprintId,
						rundown._id,
						part._id,
						blueprintPart.adLibPieces
					)
				)
				res.adlibActions.push(
					...postProcessAdLibActions(
						blueprint.blueprintId,
						rundown._id,
						part._id,
						blueprintPart.actions || []
					)
				)

				part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(part, processedPieces)
			})

			preserveOrphanedSegmentPositionInRundown(context, cache, newSegment)
		}
	}

	span?.end()
	return res
}

/**
 * Preserve the position of `orphaned: deleted` segments in the Rundown, when regenerating
 * Danger: This has been written and tested only for the iNews gateway.
 * It may work for mos-gateway, but this has not yet been tested and so is behind a feature/config field until it has been verified or adapted
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param newSegment The changed Segment that could affect ordering
 */
function preserveOrphanedSegmentPositionInRundown(
	context: JobContext,
	cache0: ReadOnlyCache<CacheForIngest>,
	newSegment: DBSegment
) {
	// TODO - is this safe? The caller does not mutate the Cache!
	const cache = cache0 as CacheForIngest

	if (context.studio.settings.preserveOrphanedSegmentPositionInRundown) {
		// When we have orphaned segments, try to keep the order correct when adding and removing other segments
		const orphanedDeletedSegments = cache.Segments.findAll((s) => s.orphaned === SegmentOrphanedReason.DELETED)
		if (orphanedDeletedSegments.length) {
			const allSegmentsByRank = cache.Segments.findAll(null, { sort: { _rank: -1 } })

			// Rank padding
			const rankPad = 0.0001
			for (const orphanedSegment of orphanedDeletedSegments) {
				const removedInd = allSegmentsByRank.findIndex((s) => s._id === orphanedSegment._id)
				let newRank = Number.MIN_SAFE_INTEGER
				const previousSegment = allSegmentsByRank[removedInd + 1]
				const nextSegment = allSegmentsByRank[removedInd - 1]
				const previousPreviousSegment = allSegmentsByRank[removedInd + 2]

				if (previousSegment) {
					newRank = previousSegment._rank + rankPad
					if (previousSegment._id === newSegment._id) {
						if (previousSegment._rank > newSegment._rank) {
							// Moved previous segment up: follow it
							newRank = newSegment._rank + rankPad
						} else if (previousSegment._rank < newSegment._rank && previousPreviousSegment) {
							// Moved previous segment down: stay behind more previous
							newRank = previousPreviousSegment._rank + rankPad
						}
					} else if (
						nextSegment &&
						nextSegment._id === newSegment._id &&
						nextSegment._rank > newSegment._rank
					) {
						// Next segment was moved uo
						if (previousPreviousSegment) {
							if (previousPreviousSegment._rank < newSegment._rank) {
								// Swapped segments directly before and after
								// Will always result in both going below the unsynced
								// Will also affect multiple segents moved directly above the previous
								newRank = previousPreviousSegment._rank + rankPad
							}
						} else {
							newRank = Number.MIN_SAFE_INTEGER
						}
					}
				}
				cache.Segments.updateOne(orphanedSegment._id, (s) => {
					s._rank = newRank
					return s
				})
			}
		}
	}
}

/**
 * Save the calculated UpdateSegmentsResult into the cache
 * Note: this will NOT remove any segments, it is expected for that to be done later
 * @param context Context for the running job
 * @param cache The cache to save into
 * @param data The data to save
 * @param isWholeRundownUpdate Whether this is a whole rundown change (This will remove any stray items)
 */
export function saveSegmentChangesToCache(
	context: JobContext,
	cache: CacheForIngest,
	data: UpdateSegmentsResult,
	isWholeRundownUpdate: boolean
): void {
	const newPartIds = new Set(data.parts.map((p) => p._id))
	const newSegmentIds = new Set(data.segments.map((p) => p._id))

	const partChanges = saveIntoCache<DBPart>(
		context,
		cache.Parts,
		isWholeRundownUpdate ? null : (p) => newSegmentIds.has(p.segmentId) || newPartIds.has(p._id),
		data.parts
	)
	logChanges('Parts', partChanges)
	const affectedPartIds = new Set([...partChanges.removed, ...newPartIds.values()])

	logChanges(
		'Pieces',
		saveIntoCache<Piece>(
			context,
			cache.Pieces,
			isWholeRundownUpdate ? null : (p) => affectedPartIds.has(p.startPartId),
			data.pieces
		)
	)
	logChanges(
		'AdLibActions',
		saveIntoCache<AdLibAction>(
			context,
			cache.AdLibActions,
			isWholeRundownUpdate ? null : (p) => affectedPartIds.has(p.partId),
			data.adlibActions
		)
	)
	logChanges(
		'AdLibPieces',
		saveIntoCache<AdLibPiece>(
			context,
			cache.AdLibPieces,
			isWholeRundownUpdate ? null : (p) => !!p.partId && affectedPartIds.has(p.partId),
			data.adlibPieces
		)
	)

	// Update Segments: Only update, never remove
	for (const segment of data.segments) {
		cache.Segments.replace(segment)
	}
}

/**
 * Regenerate and save the content for a Segment
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestSegment The segment to regenerate
 * @param isNewSegment True if the segment is being created.
 * @returns Details on the changes
 */
export async function updateSegmentFromIngestData(
	context: JobContext,
	cache: CacheForIngest,
	ingestSegment: LocalIngestSegment,
	isNewSegment: boolean
): Promise<CommitIngestData | null> {
	const span = context.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	const rundown = getRundown(cache)

	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
	const segment = cache.Segments.findOne(segmentId)
	if (!isNewSegment && !segment) throw new Error(`Segment "${segmentId}" not found`)
	if (!canSegmentBeUpdated(rundown, segment, isNewSegment)) return null

	const segmentChanges = await calculateSegmentsFromIngestData(context, cache, [ingestSegment], null)
	saveSegmentChangesToCache(context, cache, segmentChanges, false)

	span?.end()
	return {
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: [],
		renamedSegments: new Map(),

		removeRundown: false,
	}
}

/**
 * Regenerate and save the content for all list of Segment Ids in a Rundown
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param segmentIds Ids of the segments to regenerate
 * @returns Details on the changes, and any SegmentIds that were not found in the ingestRundown
 */
export async function regenerateSegmentsFromIngestData(
	context: JobContext,
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	segmentIds: SegmentId[]
): Promise<{ result: CommitIngestData | null; skippedSegments: SegmentId[] }> {
	const span = context.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	if (segmentIds.length === 0) {
		return { result: null, skippedSegments: [] }
	}

	const rundown = getRundown(cache)

	const skippedSegments: SegmentId[] = []
	const ingestSegments: LocalIngestSegment[] = []

	for (const segmentId of segmentIds) {
		const segment = cache.Segments.findOne(segmentId)
		if (!segment) {
			skippedSegments.push(segmentId)
		} else if (!canSegmentBeUpdated(rundown, segment, false)) {
			skippedSegments.push(segmentId)
		} else {
			const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segment.externalId)
			if (!ingestSegment) {
				skippedSegments.push(segmentId)
			} else {
				ingestSegments.push(ingestSegment)
			}
		}
	}

	const segmentChanges = await calculateSegmentsFromIngestData(context, cache, ingestSegments, null)

	saveSegmentChangesToCache(context, cache, segmentChanges, false)

	const result: CommitIngestData = {
		changedSegmentIds: segmentChanges.segments.map((s) => s._id),
		removedSegmentIds: [],
		renamedSegments: new Map(),

		removeRundown: false,
	}

	span?.end()
	return {
		result,
		skippedSegments,
	}
}

/**
 * Generate and return the content for all Segments in a Rundown, along with Segments which should be removed
 * @param context Context for the running job
 * @param cache The ingest cache of the rundown
 * @param ingestRundown The Rundown to regenerate
 * @param allRundownWatchedPackages0 WatchedPackagesHelper for all Packages used in the Rundown
 * @returns Newly generated documents, and list of those to remove
 */
export async function calculateSegmentsAndRemovalsFromIngestData(
	context: JobContext,
	cache: CacheForIngest,
	ingestRundown: LocalIngestRundown,
	allRundownWatchedPackages: WatchedPackagesHelper
): Promise<{ segmentChanges: UpdateSegmentsResult; removedSegments: DBSegment[] }> {
	const segmentChanges = await calculateSegmentsFromIngestData(
		context,
		cache,
		ingestRundown.segments,
		allRundownWatchedPackages
	)

	/** Don't remove segments for now, orphan them instead. The 'commit' phase will clean them up if possible */
	const changedSegmentIds = new Set(segmentChanges.segments.map((s) => s._id))
	const removedSegments = cache.Segments.findAll((s) => !changedSegmentIds.has(s._id))
	for (const oldSegment of removedSegments) {
		segmentChanges.segments.push({
			...oldSegment,
			orphaned: SegmentOrphanedReason.DELETED,
		})
	}

	return { segmentChanges, removedSegments }
}
