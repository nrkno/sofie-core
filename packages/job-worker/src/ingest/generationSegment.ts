import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentNote, PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { SegmentUserContext } from '../blueprints/context'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { postProcessAdLibActions, postProcessAdLibPieces, postProcessPieces } from '../blueprints/postProcess'
import { logger } from '../logging'
import { IngestModel, IngestModelReadonly } from './model/IngestModel'
import { LocalIngestSegment, LocalIngestRundown } from './ingestCache'
import { getSegmentId, getPartId, canSegmentBeUpdated } from './lib'
import { JobContext } from '../jobs'
import { CommitIngestData } from './lock'
import { BlueprintResultSegment, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { updateExpectedPackagesForPartModel } from './expectedPackages'

async function getWatchedPackagesHelper(
	context: JobContext,
	allRundownWatchedPackages0: WatchedPackagesHelper | null,
	ingestModel: IngestModelReadonly,
	ingestSegments: LocalIngestSegment[]
): Promise<WatchedPackagesHelper> {
	if (allRundownWatchedPackages0) {
		return allRundownWatchedPackages0
	} else {
		const segmentExternalIds = ingestSegments.map((s) => s.externalId)
		return WatchedPackagesHelper.createForIngestSegment(context, ingestModel, segmentExternalIds)
	}
}

/**
 * Generate and return the content for an array segments
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestSegments The segments to regenerate
 * @param allRundownWatchedPackages0 Optional WatchedPackagesHelper for all Packages in the Rundown. If not provided, packages will be loaded from the database
 * @returns Newly generated documents
 */
export async function calculateSegmentsFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestSegments: LocalIngestSegment[],
	allRundownWatchedPackages0: WatchedPackagesHelper | null
): Promise<SegmentId[]> {
	const span = context.startSpan('ingest.rundownInput.calculateSegmentsFromIngestData')

	const rundown = ingestModel.getRundown()

	const changedSegmentIds: SegmentId[] = []

	if (ingestSegments.length > 0) {
		const pShowStyle = context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const pAllRundownWatchedPackages = getWatchedPackagesHelper(
			context,
			allRundownWatchedPackages0,
			ingestModel,
			ingestSegments
		)

		const showStyle = await pShowStyle
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		const allRundownWatchedPackages = await pAllRundownWatchedPackages

		for (const ingestSegment of ingestSegments) {
			const segmentId = getSegmentId(ingestModel.rundownId, ingestSegment.externalId)

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
				ingestModel.replaceSegment(newSegment)
				changedSegmentIds.push(newSegment._id)

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
			const segmentModel = ingestModel.replaceSegment(newSegment)
			changedSegmentIds.push(newSegment._id)

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

					expectedDurationWithPreroll: undefined, // Below
				})

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
				const adlibPieces = postProcessAdLibPieces(
					context,
					blueprint.blueprintId,
					rundown._id,
					part._id,
					blueprintPart.adLibPieces
				)

				const adlibActions = postProcessAdLibActions(
					blueprint.blueprintId,
					rundown._id,
					part._id,
					blueprintPart.actions || []
				)

				const partModel = segmentModel.replacePart(part, processedPieces, adlibPieces, adlibActions)
				updateExpectedPackagesForPartModel(context, partModel)
			})

			preserveOrphanedSegmentPositionInRundown(context, ingestModel, newSegment)
		}
	}

	span?.end()
	return changedSegmentIds
}

/**
 * Preserve the position of `orphaned: deleted` segments in the Rundown, when regenerating
 * Danger: This has been written and tested only for the iNews gateway.
 * It may work for mos-gateway, but this has not yet been tested and so is behind a feature/config field until it has been verified or adapted
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param newSegment The changed Segment that could affect ordering
 */
function preserveOrphanedSegmentPositionInRundown(
	context: JobContext,
	ingestModel: IngestModel,
	newSegment: DBSegment
) {
	if (context.studio.settings.preserveOrphanedSegmentPositionInRundown) {
		// When we have orphaned segments, try to keep the order correct when adding and removing other segments
		const allSegmentsByRank = ingestModel.getOrderedSegments()
		const orphanedDeletedSegments = allSegmentsByRank.filter(
			(s) => s.segment.orphaned === SegmentOrphanedReason.DELETED
		)
		if (orphanedDeletedSegments.length) {
			// Rank padding
			const rankPad = 0.0001
			for (const orphanedSegment of orphanedDeletedSegments) {
				const removedInd = allSegmentsByRank.findIndex((s) => s.segment._id === orphanedSegment.segment._id)
				let newRank = Number.MIN_SAFE_INTEGER
				const previousSegment = allSegmentsByRank[removedInd + 1]
				const nextSegment = allSegmentsByRank[removedInd - 1]
				const previousPreviousSegment = allSegmentsByRank[removedInd + 2]

				if (previousSegment) {
					newRank = previousSegment.segment._rank + rankPad
					if (previousSegment.segment._id === newSegment._id) {
						if (previousSegment.segment._rank > newSegment._rank) {
							// Moved previous segment up: follow it
							newRank = newSegment._rank + rankPad
						} else if (previousSegment.segment._rank < newSegment._rank && previousPreviousSegment) {
							// Moved previous segment down: stay behind more previous
							newRank = previousPreviousSegment.segment._rank + rankPad
						}
					} else if (
						nextSegment &&
						nextSegment.segment._id === newSegment._id &&
						nextSegment.segment._rank > newSegment._rank
					) {
						// Next segment was moved uo
						if (previousPreviousSegment) {
							if (previousPreviousSegment.segment._rank < newSegment._rank) {
								// Swapped segments directly before and after
								// Will always result in both going below the unsynced
								// Will also affect multiple segents moved directly above the previous
								newRank = previousPreviousSegment.segment._rank + rankPad
							}
						} else {
							newRank = Number.MIN_SAFE_INTEGER
						}
					}
				}
				orphanedSegment.setRank(newRank)
			}
		}
	}
}

/**
 * Regenerate and save the content for a Segment
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestSegment The segment to regenerate
 * @param isNewSegment True if the segment is being created.
 * @returns Details on the changes
 */
export async function updateSegmentFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestSegment: LocalIngestSegment,
	isNewSegment: boolean
): Promise<CommitIngestData | null> {
	const span = context.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	const rundown = ingestModel.getRundown()

	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
	const segment = ingestModel.getSegment(segmentId)
	if (!isNewSegment && !segment) throw new Error(`Segment "${segmentId}" not found`)
	if (!canSegmentBeUpdated(rundown, segment, isNewSegment)) return null

	const changedSegmentIds = await calculateSegmentsFromIngestData(context, ingestModel, [ingestSegment], null)

	span?.end()
	return {
		changedSegmentIds: changedSegmentIds,
		removedSegmentIds: [],
		renamedSegments: new Map(),

		removeRundown: false,
	}
}

/**
 * Regenerate and save the content for all list of Segment Ids in a Rundown
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param segmentIds Ids of the segments to regenerate
 * @returns Details on the changes, and any SegmentIds that were not found in the ingestRundown
 */
export async function regenerateSegmentsFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: LocalIngestRundown,
	segmentIds: SegmentId[]
): Promise<{ result: CommitIngestData | null; skippedSegments: SegmentId[] }> {
	const span = context.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	if (segmentIds.length === 0) {
		return { result: null, skippedSegments: [] }
	}

	const rundown = ingestModel.getRundown()

	const skippedSegments: SegmentId[] = []
	const ingestSegments: LocalIngestSegment[] = []

	for (const segmentId of segmentIds) {
		const segment = ingestModel.getSegment(segmentId)
		if (!segment) {
			skippedSegments.push(segmentId)
		} else if (!canSegmentBeUpdated(rundown, segment, false)) {
			skippedSegments.push(segmentId)
		} else {
			const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segment.segment.externalId)
			if (!ingestSegment) {
				skippedSegments.push(segmentId)
			} else {
				ingestSegments.push(ingestSegment)
			}
		}
	}

	const changedSegmentIds = await calculateSegmentsFromIngestData(context, ingestModel, ingestSegments, null)

	const result: CommitIngestData = {
		changedSegmentIds: changedSegmentIds,
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
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The Rundown to regenerate
 * @param allRundownWatchedPackages0 WatchedPackagesHelper for all Packages used in the Rundown
 * @returns Newly generated documents, and list of those to remove
 */
export async function calculateSegmentsAndRemovalsFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: LocalIngestRundown,
	allRundownWatchedPackages: WatchedPackagesHelper
): Promise<{ changedSegmentIds: SegmentId[]; removedSegmentIds: SegmentId[] }> {
	const changedSegmentIds = await calculateSegmentsFromIngestData(
		context,
		ingestModel,
		ingestRundown.segments,
		allRundownWatchedPackages
	)

	/** Don't remove segments for now, orphan them instead. The 'commit' phase will clean them up if possible */
	const changedSegmentIdsSet = new Set(changedSegmentIds)
	const segmentsToBeRemoved = ingestModel.getAllSegments().filter((s) => !changedSegmentIdsSet.has(s.segment._id))
	const removedSegmentIds: SegmentId[] = []
	for (const oldSegment of segmentsToBeRemoved) {
		removedSegmentIds.push(oldSegment.segment._id)
		changedSegmentIds.push(oldSegment.segment._id)
		oldSegment.setOrphaned(SegmentOrphanedReason.DELETED)
	}

	return { changedSegmentIds, removedSegmentIds }
}
