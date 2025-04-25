import { assertNever, getRandomId, generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { PartId, PartInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutModel } from './model/PlayoutModel'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS } from '@sofie-automation/shared-lib/dist/core/constants'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import _ = require('underscore')
import { resetPartInstancesWithPieceInstances } from './lib'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SelectNextPartResult } from './selectNextPart'
import { ReadonlyDeep } from 'type-fest'
import { QueueNextSegmentResult } from '@sofie-automation/corelib/dist/worker/studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { OnSetAsNextContext } from '../blueprints/context'
import { logger } from '../logging'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import {
	PartAndPieceInstanceActionService,
	applyActionSideEffects,
} from '../blueprints/context/services/PartAndPieceInstanceActionService'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { convertNoteToNotification } from '../notifications/util'

/**
 * Set or clear the nexted part, from a given PartInstance, or SelectNextPartResult
 * @param context Context for the running job
 * @param playoutModel The playout model of the playlist
 * @param rawNextPart The Part to set as next
 * @param setManually Whether this was manually chosen by the user
 * @param nextTimeOffset The offset into the Part to start playback
 */
export async function setNextPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	rawNextPart: ReadonlyDeep<Omit<SelectNextPartResult, 'index'>> | PlayoutPartInstanceModel | null,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const span = context.startSpan('setNextPart')

	const attemptedPartIds = new Set<PartId | null>()
	if (rawNextPart && 'part' in rawNextPart) attemptedPartIds.add(rawNextPart.part._id)

	let moveNextToPart = await setNextPartAndCheckForPendingMoveNextPart(
		context,
		playoutModel,
		rawNextPart,
		setManually,
		nextTimeOffset
	)
	while (moveNextToPart) {
		// Ensure that we aren't stuck in an infinite loop. If this while loop is being run for a part twice, then the blueprints are behaving oddly and will likely get stuck
		// Instead of throwing and causing a larger failure, we can stop processing here, and leave something as next
		const nextPartId = moveNextToPart.selectedPart?._id ?? null
		if (attemptedPartIds.has(nextPartId)) {
			logger.error(
				`Blueprint onSetAsNext callback moved the next part "${nextPartId}" (trace: ${JSON.stringify(
					Array.from(attemptedPartIds.values())
				)}), forming a loop`
			)
			break
		}
		attemptedPartIds.add(nextPartId)

		moveNextToPart = await setNextPartAndCheckForPendingMoveNextPart(
			context,
			playoutModel,
			moveNextToPart.selectedPart
				? {
						part: moveNextToPart.selectedPart,
						consumesQueuedSegmentId: false,
				  }
				: null,
			true
		)
	}

	playoutModel.removeUntakenPartInstances()

	resetPartInstancesWhenChangingSegment(context, playoutModel)

	playoutModel.updateQuickLoopState()

	await cleanupOrphanedItems(context, playoutModel)

	if (span) span.end()
}

async function setNextPartAndCheckForPendingMoveNextPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	rawNextPart: ReadonlyDeep<Omit<SelectNextPartResult, 'index'>> | PlayoutPartInstanceModel | null,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<{ selectedPart: ReadonlyDeep<DBPart> | null } | undefined> {
	if (rawNextPart) {
		if (!playoutModel.playlist.activationId)
			throw new Error(`RundownPlaylist "${playoutModel.playlist._id}" is not active`)

		// create new instance
		let newPartInstance: PlayoutPartInstanceModel
		let consumesQueuedSegmentId: boolean
		if ('partInstance' in rawNextPart) {
			const inputPartInstance: PlayoutPartInstanceModel = rawNextPart
			if (inputPartInstance.partInstance.part.invalid) {
				throw new Error('Part is marked as invalid, cannot set as next.')
			}

			if (!playoutModel.getRundown(inputPartInstance.partInstance.rundownId)) {
				throw new Error(
					`PartInstance "${inputPartInstance.partInstance._id}" of rundown "${inputPartInstance.partInstance.rundownId}" not part of RundownPlaylist "${playoutModel.playlist._id}"`
				)
			}

			consumesQueuedSegmentId = false
			newPartInstance = await prepareExistingPartInstanceForBeingNexted(context, playoutModel, inputPartInstance)
		} else {
			const selectedPart: ReadonlyDeep<Omit<SelectNextPartResult, 'index'>> = rawNextPart
			if (selectedPart.part.invalid) {
				throw new Error('Part is marked as invalid, cannot set as next.')
			}

			if (!playoutModel.getRundown(selectedPart.part.rundownId)) {
				throw new Error(
					`Part "${selectedPart.part._id}" of rundown "${selectedPart.part.rundownId}" not part of RundownPlaylist "${playoutModel.playlist._id}"`
				)
			}

			consumesQueuedSegmentId = selectedPart.consumesQueuedSegmentId ?? false

			const currentPartInstance = playoutModel.currentPartInstance
			const nextPartInstance = playoutModel.nextPartInstance

			if (nextPartInstance && nextPartInstance.partInstance.part._id === selectedPart.part._id) {
				// Re-use existing

				newPartInstance = await prepareExistingPartInstanceForBeingNexted(
					context,
					playoutModel,
					nextPartInstance
				)
			} else {
				// Create new instance
				newPartInstance = await preparePartInstanceForPartBeingNexted(
					context,
					playoutModel,
					currentPartInstance,
					selectedPart.part
				)
			}
		}

		const selectedPartInstanceIds = _.compact([
			newPartInstance.partInstance._id,
			playoutModel.playlist.currentPartInfo?.partInstanceId,
			playoutModel.playlist.previousPartInfo?.partInstanceId,
		])

		// reset any previous instances of this part
		resetPartInstancesWithPieceInstances(context, playoutModel, {
			_id: { $nin: selectedPartInstanceIds },
			rundownId: newPartInstance.partInstance.rundownId,
			'part._id': newPartInstance.partInstance.part._id,
		})

		playoutModel.setPartInstanceAsNext(newPartInstance, setManually, consumesQueuedSegmentId, nextTimeOffset)

		return executeOnSetAsNextCallback(playoutModel, newPartInstance, context)
	} else {
		// Set to null

		playoutModel.setPartInstanceAsNext(null, setManually, false, nextTimeOffset)
		return undefined
	}
}

async function executeOnSetAsNextCallback(
	playoutModel: PlayoutModel,
	newPartInstance: PlayoutPartInstanceModel,
	context: JobContext
) {
	const NOTIFICATION_CATEGORY = 'onSetAsNext'

	const rundownOfNextPart = playoutModel.getRundown(newPartInstance.partInstance.rundownId)
	if (!rundownOfNextPart) return undefined

	const blueprint = await context.getShowStyleBlueprint(rundownOfNextPart.rundown.showStyleBaseId)
	if (!blueprint.blueprint.onSetAsNext) return undefined

	const showStyle = await context.getShowStyleCompound(
		rundownOfNextPart.rundown.showStyleVariantId,
		rundownOfNextPart.rundown.showStyleBaseId
	)

	const rundownId = rundownOfNextPart.rundown._id
	const partInstanceId = playoutModel.playlist.nextPartInfo?.partInstanceId

	const watchedPackagesHelper = WatchedPackagesHelper.empty(context)
	const onSetAsNextContext = new OnSetAsNextContext(
		{
			name: `${rundownOfNextPart.rundown.name}(${playoutModel.playlist.name})`,
			identifier: `playlist=${playoutModel.playlist._id},rundown=${rundownId},currentPartInstance=${
				playoutModel.playlist.currentPartInfo?.partInstanceId
			},nextPartInstance=${partInstanceId},execution=${getRandomId()}`,
		},
		context,
		playoutModel,
		showStyle,
		watchedPackagesHelper,
		new PartAndPieceInstanceActionService(context, playoutModel, showStyle, rundownOfNextPart)
	)

	// Clear any existing notifications for this partInstance. This will clear any from the previous setAsNext
	playoutModel.clearAllNotifications(NOTIFICATION_CATEGORY)

	try {
		await blueprint.blueprint.onSetAsNext(onSetAsNextContext)
		await applyOnSetAsNextSideEffects(context, playoutModel, onSetAsNextContext)

		for (const note of onSetAsNextContext.notes) {
			// Update the notifications. Even though these are related to a partInstance, they will be cleared on the next take
			playoutModel.setNotification(NOTIFICATION_CATEGORY, {
				...convertNoteToNotification(note, [blueprint.blueprintId]),
				relatedTo: partInstanceId
					? {
							type: 'partInstance',
							rundownId,
							partInstanceId,
					  }
					: { type: 'playlist' },
			})
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.onSetAsNext: ${stringifyError(err)}`)

		playoutModel.setNotification(NOTIFICATION_CATEGORY, {
			id: 'onSetNextError',
			severity: NoteSeverity.ERROR,
			message: generateTranslation('An error while setting the next Part, playout may be impacted'),
			relatedTo: partInstanceId
				? {
						type: 'partInstance',
						rundownId,
						partInstanceId,
				  }
				: { type: 'playlist' },
		})
	}

	return onSetAsNextContext.pendingMoveNextPart
}

async function applyOnSetAsNextSideEffects(
	context: JobContext,
	playoutModel: PlayoutModel,
	onSetAsNextContext: OnSetAsNextContext
): Promise<void> {
	await applyActionSideEffects(context, playoutModel, onSetAsNextContext)
}

async function prepareExistingPartInstanceForBeingNexted(
	context: JobContext,
	playoutModel: PlayoutModel,
	instance: PlayoutPartInstanceModel
): Promise<PlayoutPartInstanceModel> {
	await syncPlayheadInfinitesForNextPartInstance(context, playoutModel, playoutModel.currentPartInstance, instance)

	return instance
}

async function preparePartInstanceForPartBeingNexted(
	context: JobContext,
	playoutModel: PlayoutModel,
	currentPartInstance: PlayoutPartInstanceModel | null,
	nextPart: ReadonlyDeep<DBPart>
): Promise<PlayoutPartInstanceModel> {
	const rundown = playoutModel.getRundown(nextPart.rundownId)
	if (!rundown) throw new Error(`Could not find rundown ${nextPart.rundownId}`)

	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, playoutModel, undefined, nextPart)
	const newPieceInstances = getPieceInstancesForPart(
		context,
		playoutModel,
		currentPartInstance,
		rundown,
		nextPart,
		possiblePieces,
		protectString('') // Replaced inside playoutModel.createInstanceForPart
	)

	return playoutModel.createInstanceForPart(nextPart, newPieceInstances)
}

/**
 * When entering a segment, or moving backwards in a segment, reset any partInstances in that window
 * In theory the new segment should already be reset, as we do that upon leaving, but it wont be if jumping to earlier in the same segment or maybe if the rundown wasnt reset
 */
function resetPartInstancesWhenChangingSegment(context: JobContext, playoutModel: PlayoutModel) {
	const currentPartInstance = playoutModel.currentPartInstance?.partInstance
	const nextPartInstance = playoutModel.nextPartInstance?.partInstance

	if (nextPartInstance) {
		const resetPartInstanceIds = new Set<PartInstanceId>()
		if (currentPartInstance) {
			// Always clean the current segment, anything after the current part (except the next part)
			const trailingInOldSegment = playoutModel.loadedPartInstances.filter(
				(p) =>
					!p.partInstance.reset &&
					p.partInstance._id !== currentPartInstance._id &&
					p.partInstance._id !== nextPartInstance._id &&
					p.partInstance.segmentId === currentPartInstance.segmentId &&
					p.partInstance.part._rank > currentPartInstance.part._rank
			)

			for (const part of trailingInOldSegment) {
				resetPartInstanceIds.add(part.partInstance._id)
			}
		}

		if (
			!currentPartInstance ||
			nextPartInstance.segmentId !== currentPartInstance.segmentId ||
			(nextPartInstance.segmentId === currentPartInstance.segmentId &&
				nextPartInstance.part._rank < currentPartInstance.part._rank)
		) {
			// clean the whole segment if new, or jumping backwards
			const newSegmentParts = playoutModel.loadedPartInstances.filter(
				(p) =>
					!p.partInstance.reset &&
					p.partInstance._id !== nextPartInstance._id &&
					p.partInstance._id !== currentPartInstance?._id &&
					p.partInstance.segmentId === nextPartInstance.segmentId
			)
			for (const part of newSegmentParts) {
				resetPartInstanceIds.add(part.partInstance._id)
			}
		}

		if (resetPartInstanceIds.size > 0) {
			resetPartInstancesWithPieceInstances(context, playoutModel, {
				_id: { $in: Array.from(resetPartInstanceIds) },
			})
		}
	}
}

/**
 * Cleanup any orphaned (deleted) segments and partinstances once they are no longer being played
 * @param playoutModel
 */
async function cleanupOrphanedItems(context: JobContext, playoutModel: PlayoutModel) {
	const playlist = playoutModel.playlist

	const selectedPartInstancesSegmentIds = new Set<SegmentId>()

	const previousPartInstance = playoutModel.previousPartInstance?.partInstance
	const currentPartInstance = playoutModel.currentPartInstance?.partInstance
	const nextPartInstance = playoutModel.nextPartInstance?.partInstance

	if (previousPartInstance) selectedPartInstancesSegmentIds.add(previousPartInstance.segmentId)
	if (currentPartInstance) selectedPartInstancesSegmentIds.add(currentPartInstance.segmentId)
	if (nextPartInstance) selectedPartInstancesSegmentIds.add(nextPartInstance.segmentId)

	// Cleanup any orphaned segments once they are no longer being played. This also cleans up any adlib-parts, that have been marked as deleted as a deferred cleanup operation
	const segments = playoutModel.getAllOrderedSegments().filter((s) => !!s.segment.orphaned)
	const orphanedSegmentIds = new Set(segments.map((s) => s.segment._id))

	const alterSegmentsFromRundowns = new Map<RundownId, { deleted: SegmentId[]; hidden: SegmentId[] }>()
	for (const segment of segments) {
		// If the segment is orphaned and not the segment for the previous, current or next partInstance
		if (!selectedPartInstancesSegmentIds.has(segment.segment._id)) {
			let rundownSegments = alterSegmentsFromRundowns.get(segment.segment.rundownId)
			if (!rundownSegments) {
				rundownSegments = { deleted: [], hidden: [] }
				alterSegmentsFromRundowns.set(segment.segment.rundownId, rundownSegments)
			}
			// The segment is finished with. Queue it for attempted removal or reingest
			switch (segment.segment.orphaned) {
				case SegmentOrphanedReason.DELETED: {
					rundownSegments.deleted.push(segment.segment._id)
					break
				}
				case SegmentOrphanedReason.HIDDEN: {
					// The segment is finished with. Queue it for attempted resync
					rundownSegments.hidden.push(segment.segment._id)
					break
				}
				case SegmentOrphanedReason.ADLIB_TESTING:
					// Ignore, as these are owned by playout not ingest
					break
				case undefined:
					// Not orphaned
					break
				default:
					assertNever(segment.segment.orphaned)
					break
			}
		}
	}

	// We need to run this outside of the current lock, and within an ingest lock, so defer to the work queue
	for (const [rundownId, candidateSegmentIds] of alterSegmentsFromRundowns) {
		const rundown = playoutModel.getRundown(rundownId)
		if (rundown?.rundown?.source?.type !== 'nrcs') {
			// This is not valid as the rundownId won't match the externalId, so ingest will fail
			// For now do nothing
		} else if (rundown) {
			await context.queueIngestJob(IngestJobs.RemoveOrphanedSegments, {
				rundownExternalId: rundown.rundown.externalId,
				orphanedHiddenSegmentIds: candidateSegmentIds.hidden,
				orphanedDeletedSegmentIds: candidateSegmentIds.deleted,
			})
		}
	}

	const removePartInstanceIds: PartInstanceId[] = []
	// Cleanup any orphaned partinstances once they are no longer being played (and the segment isnt orphaned)
	const orphanedInstances = playoutModel.loadedPartInstances.filter(
		(p) => p.partInstance.orphaned === 'deleted' && !p.partInstance.reset
	)
	for (const partInstance of orphanedInstances) {
		if (PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS && orphanedSegmentIds.has(partInstance.partInstance.segmentId)) {
			// If the segment is also orphaned, then don't delete it until it is clear
			continue
		}

		if (
			partInstance.partInstance._id !== playlist.currentPartInfo?.partInstanceId &&
			partInstance.partInstance._id !== playlist.nextPartInfo?.partInstanceId
		) {
			removePartInstanceIds.push(partInstance.partInstance._id)
		}
	}

	// Cleanup any instances from above
	if (removePartInstanceIds.length > 0) {
		resetPartInstancesWithPieceInstances(context, playoutModel, { _id: { $in: removePartInstanceIds } })
	}
}

/**
 * Set or clear the queued segment.
 * @param context Context for the running job
 * @param playoutModel The playout model of the playlist
 * @param queuedSegment The segment to queue, or null to clear it
 */
export async function queueNextSegment(
	context: JobContext,
	playoutModel: PlayoutModel,
	queuedSegment: PlayoutSegmentModel | null
): Promise<QueueNextSegmentResult> {
	const span = context.startSpan('queueNextSegment')
	if (queuedSegment) {
		if (queuedSegment.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
			throw new Error(`Segment "${queuedSegment.segment._id}" is an AdlibTesting segment, and cannot be queued!`)

		// Just run so that errors will be thrown if something wrong:
		const firstPlayablePart = findFirstPlayablePartOrThrow(queuedSegment)

		const currentPartInstance = playoutModel.currentPartInstance?.partInstance
		const nextPartInstance = playoutModel.nextPartInstance?.partInstance

		// if there is not currentPartInstance or the nextPartInstance is not in the current segment
		// behave as if user chose SetNextPart on the first playable part of the segment
		if (currentPartInstance === undefined || currentPartInstance.segmentId !== nextPartInstance?.segmentId) {
			// Clear any existing nextSegment, as this call 'replaces' it
			playoutModel.setQueuedSegment(null)

			await setNextPart(
				context,
				playoutModel,
				{
					part: firstPlayablePart,
					consumesQueuedSegmentId: false,
				},
				true
			)

			span?.end()
			return { nextPartId: firstPlayablePart._id }
		}

		playoutModel.setQueuedSegment(queuedSegment)
	} else {
		playoutModel.setQueuedSegment(null)
	}
	span?.end()
	return { queuedSegmentId: queuedSegment?.segment?._id ?? null }
}

/**
 * Set the first playable part of a given segment as next.
 * @param context Context for the running job
 * @param playoutModel The playout model of the playlist
 * @param nextSegment The segment, whose first part is to be set as next
 */
export async function setNextSegment(
	context: JobContext,
	playoutModel: PlayoutModel,
	nextSegment: PlayoutSegmentModel
): Promise<PartId> {
	const span = context.startSpan('setNextSegment')
	// Just run so that errors will be thrown if something wrong:
	const firstPlayablePart = findFirstPlayablePartOrThrow(nextSegment)

	playoutModel.setQueuedSegment(null)

	await setNextPart(
		context,
		playoutModel,
		{
			part: firstPlayablePart,
			consumesQueuedSegmentId: false,
		},
		true
	)

	if (span) span.end()
	return firstPlayablePart._id
}

function findFirstPlayablePartOrThrow(segment: PlayoutSegmentModel): ReadonlyDeep<DBPart> {
	const firstPlayablePart = segment.parts.find((p) => isPartPlayable(p))
	if (!firstPlayablePart) {
		throw new Error('Segment contains no valid parts')
	}
	return firstPlayablePart
}

/**
 * Set the nexted part, from a given DBPart
 * @param context Context for the running job
 * @param playoutModel The playout model of the playlist
 * @param nextPart The Part to set as next
 * @param setManually Whether this was manually chosen by the user
 * @param nextTimeOffset The offset into the Part to start playback
 */
export async function setNextPartFromPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	nextPart: ReadonlyDeep<DBPart>,
	setManually: boolean,
	nextTimeOffset?: number | undefined
): Promise<void> {
	const playlist = playoutModel.playlist
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
	if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
		throw UserError.create(UserErrorMessage.DuringHold)
	}

	const consumesQueuedSegmentId = doesPartConsumeQueuedSegmentId(playoutModel, nextPart)

	await setNextPart(context, playoutModel, { part: nextPart, consumesQueuedSegmentId }, setManually, nextTimeOffset)
}

function doesPartConsumeQueuedSegmentId(playoutModel: PlayoutModel, nextPart: ReadonlyDeep<DBPart>) {
	// If we're setting the next point to somewhere other than the current segment, and in the queued segment, clear the queued segment
	const playlist = playoutModel.playlist
	const currentPartInstance = playoutModel.currentPartInstance?.partInstance

	return !!(
		currentPartInstance &&
		currentPartInstance.segmentId !== nextPart.segmentId &&
		playlist.queuedSegmentId === nextPart.segmentId
	)
}
