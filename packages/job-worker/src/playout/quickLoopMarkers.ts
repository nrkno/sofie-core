import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { SetQuickLoopMarkerProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs'
import { runJobWithPlayoutModel } from './lock'
import { updateTimeline } from './timeline/generate'
import { selectNextPart } from './selectNextPart'
import { setNextPart } from './setNext'
import { resetPartInstancesWithPieceInstances } from './lib'
import { QuickLoopMarker, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export async function handleSetQuickLoopMarker(context: JobContext, data: SetQuickLoopMarkerProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw new Error(`Playlist has no activationId!`)
			const oldProps = playoutModel.playlist.quickLoop
			const wasQuickLoopRunning = oldProps?.running
			playoutModel.setQuickLoopMarker(data.type, data.marker)

			const markerChanged = (
				markerA: QuickLoopMarker | undefined,
				markerB: QuickLoopMarker | undefined
			): boolean => {
				if (!markerA || !markerB) return false

				if (
					(markerA.type === QuickLoopMarkerType.RUNDOWN ||
						markerA.type === QuickLoopMarkerType.SEGMENT ||
						markerA.type === QuickLoopMarkerType.PART) &&
					(markerB.type === QuickLoopMarkerType.RUNDOWN ||
						markerB.type === QuickLoopMarkerType.SEGMENT ||
						markerB.type === QuickLoopMarkerType.PART)
				) {
					return markerA.id !== markerB.id
				}

				return false
			}

			if (playlist.currentPartInfo) {
				// rundown is on air
				let segmentsToReset: SegmentId[] = []

				if (
					playlist.quickLoop?.start &&
					oldProps?.start &&
					markerChanged(oldProps.start, playlist.quickLoop.start)
				) {
					// start marker changed
					segmentsToReset = playoutModel.getSegmentsBetweenQuickLoopMarker(
						playlist.quickLoop.start,
						oldProps.start
					)
				} else if (
					playlist.quickLoop?.end &&
					oldProps?.end &&
					markerChanged(oldProps.end, playlist.quickLoop.end)
				) {
					// end marker changed
					segmentsToReset = playoutModel.getSegmentsBetweenQuickLoopMarker(
						oldProps.end,
						playlist.quickLoop.end
					)
				} else if (playlist.quickLoop?.start && playlist.quickLoop.end && !(oldProps?.start && oldProps.end)) {
					// a new loop was created
					segmentsToReset = playoutModel.getSegmentsBetweenQuickLoopMarker(
						playlist.quickLoop.start,
						playlist.quickLoop.end
					)
				}

				// reset segments that have been added to the loop and are not on-air
				resetPartInstancesWithPieceInstances(context, playoutModel, {
					segmentId: {
						$in: segmentsToReset.filter(
							(segmentId) =>
								segmentId !== playoutModel.currentPartInstance?.partInstance.segmentId &&
								segmentId !== playoutModel.nextPartInstance?.partInstance.segmentId
						),
					},
				})
			}

			if (wasQuickLoopRunning) {
				const nextPart = selectNextPart(
					context,
					playoutModel.playlist,
					playoutModel.currentPartInstance?.partInstance ?? null,
					playoutModel.nextPartInstance?.partInstance ?? null,
					playoutModel.getAllOrderedSegments(),
					playoutModel.getAllOrderedParts(),
					{ ignoreUnplayable: true, ignoreQuickLoop: false }
				)
				if (nextPart?.part._id !== playoutModel.nextPartInstance?.partInstance.part._id) {
					await setNextPart(context, playoutModel, nextPart, false)
				}
			}
			await updateTimeline(context, playoutModel)
		}
	)
}
