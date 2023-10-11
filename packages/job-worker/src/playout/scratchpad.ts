import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ActivateScratchpadProps } from '@sofie-automation/corelib/dist/worker/studio'
import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { runJobWithPlayoutModel } from './lock'
import { performTakeToNextedPart } from './take'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutModel } from './model/PlayoutModel'

export async function handleActivateScratchpad(context: JobContext, data: ActivateScratchpadProps): Promise<void> {
	if (!context.studio.settings.allowScratchpad) throw UserError.create(UserErrorMessage.ScratchpadNotAllowed)

	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.Playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.currentPartInfo) throw UserError.create(UserErrorMessage.RundownAlreadyActive)
		},
		async (playoutModel) => {
			const playlist = playoutModel.Playlist
			if (!playlist.activationId) throw new Error(`Playlist has no activationId!`)

			const rundown = playoutModel.getRundown(data.rundownId)
			if (!rundown) throw new Error(`Rundown "${data.rundownId}" not found!`)

			// Create the segment
			rundown.insertScratchpadSegment()

			// Create the first PartInstance for the segment
			const newPartInstance = playoutModel.createScratchpadPartInstance(rundown, {
				_id: getRandomId(),
				_rank: 0,
				externalId: '',
				title: 'Scratchpad',
				expectedDuration: 0,
				expectedDurationWithPreroll: 0, // Filled in later
				untimed: true,
			})

			// Set the part as next
			playoutModel.setPartInstanceAsNext(newPartInstance, true, false)

			// Take into the newly created Part
			await performTakeToNextedPart(context, playoutModel, getCurrentTime())
		}
	)
}

/**
 * Validate and cleanup a PartInstance being added to a SCRATCHPAD segment.
 * If PartInstance is not in the scratchpad, do nothing
 */
export function validateScratchpartPartInstanceProperties(
	_context: JobContext,
	playoutModel: PlayoutModel,
	partInstanceId: PartInstanceId
): void {
	const partInstance = playoutModel.getPartInstance(partInstanceId)
	if (!partInstance) return

	const rundown = playoutModel.getRundown(partInstance.PartInstance.rundownId)
	if (!rundown)
		throw new Error(
			`Failed to find Rundown "${partInstance.PartInstance.rundownId}" for PartInstance "${partInstance.PartInstance._id}"`
		)

	const segment = rundown.getSegment(partInstance.PartInstance.segmentId)
	if (!segment)
		throw new Error(
			`Failed to find Segment "${partInstance.PartInstance.segmentId}" for PartInstance "${partInstance.PartInstance._id}"`
		)

	// Check if this applies
	if (segment.Segment.orphaned !== SegmentOrphanedReason.SCRATCHPAD) return

	partInstance.validateScratchpadSegmentProperties()
}
