import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ActivateScratchpadProps } from '@sofie-automation/corelib/dist/worker/studio'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { runJobWithPlayoutCache } from './lock'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { performTakeToNextedPart } from './take'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CacheForPlayout } from './cache'

export async function handleActivateScratchpad(context: JobContext, data: ActivateScratchpadProps): Promise<void> {
	if (!context.studio.settings.allowScratchpad) throw UserError.create(UserErrorMessage.ScratchpadNotAllowed)

	return runJobWithPlayoutCache(
		context,
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.currentPartInfo) throw UserError.create(UserErrorMessage.RundownAlreadyActive)
		},
		async (cache) => {
			let playlist = cache.Playlist.doc
			if (!playlist.activationId) throw new Error(`Playlist has no activationId!`)

			const rundown = cache.Rundowns.findOne(data.rundownId)
			if (!rundown) throw new Error(`Rundown "${data.rundownId}" not found!`)

			const segment = cache.Segments.findOne(
				(s) => s.orphaned === SegmentOrphanedReason.SCRATCHPAD && s.rundownId === data.rundownId
			)
			if (segment) throw UserError.create(UserErrorMessage.ScratchpadAlreadyActive)

			const minSegmentRank = Math.min(0, ...cache.Segments.findAll(null).map((s) => s._rank))

			const segmentId = cache.Segments.insert(
				literal<DBSegment>({
					_id: getRandomId(),
					_rank: minSegmentRank - 1,
					externalId: '__scratchpad__',
					externalModified: getCurrentTime(),
					rundownId: data.rundownId,
					orphaned: SegmentOrphanedReason.SCRATCHPAD,
					name: '',
				})
			)

			const newPartInstance: DBPartInstance = {
				_id: getRandomId(),
				rundownId: data.rundownId,
				segmentId: segmentId,
				playlistActivationId: playlist.activationId,
				segmentPlayoutId: getRandomId(),
				takeCount: 1,
				rehearsal: !!playlist.rehearsal,
				orphaned: 'adlib-part',
				part: {
					_id: getRandomId(),
					_rank: 0,
					externalId: '',
					rundownId: data.rundownId,
					segmentId: segmentId,
					title: 'Scratchpad',
					expectedDuration: 0,
					expectedDurationWithPreroll: 0, // Filled in later
					untimed: true,
				},
			}
			cache.PartInstances.insert(newPartInstance)

			// Set the part as next
			cache.Playlist.update((playlist) => {
				playlist.nextPartInfo = {
					partInstanceId: newPartInstance._id,
					rundownId: newPartInstance.rundownId,
					manuallySelected: true,
					consumesQueuedSegmentId: false,
				}

				return playlist
			})
			playlist = cache.Playlist.doc

			// Take into the newly created Part
			await performTakeToNextedPart(context, cache, getCurrentTime())
		}
	)
}

/**
 * Validate and cleanup a PartInstance being added to a SCRATCHPAD segment.
 * If PartInstance is not in the scratchpad, do nothing
 */
export function validateScratchpartPartInstanceProperties(
	_context: JobContext,
	cache: CacheForPlayout,
	partInstanceId: PartInstanceId
): void {
	const partInstance = cache.PartInstances.findOne(partInstanceId)
	if (!partInstance) return

	const segment = cache.Segments.findOne(partInstance.segmentId)
	if (!segment)
		throw new Error(`Failed to find Segment "${partInstance.segmentId}" for PartInstance "${partInstance._id}"`)

	// Check if this applies
	if (segment.orphaned !== SegmentOrphanedReason.SCRATCHPAD) return

	cache.PartInstances.updateOne(partInstance._id, (partInstance) => {
		partInstance.orphaned = 'adlib-part'

		// Autonext isn't allowed to begin with, to avoid accidentally exiting the scratchpad
		delete partInstance.part.autoNext

		// Force this to not affect rundown timing
		partInstance.part.untimed = true

		return partInstance
	})
}
