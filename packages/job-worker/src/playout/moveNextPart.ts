import { groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutModel } from './model/PlayoutModel'
import { sortPartsInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'
import { setNextPartFromPart } from './setNext'
import { logger } from '../logging'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReadonlyDeep } from 'type-fest'

export async function moveNextPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	partDelta: number,
	segmentDelta: number
): Promise<PartId | null> {
	const playlist = playoutModel.playlist

	const currentPartInstance = playoutModel.currentPartInstance?.partInstance
	const nextPartInstance = playoutModel.nextPartInstance?.partInstance

	const refPartInstance = nextPartInstance ?? currentPartInstance
	const refPart = refPartInstance?.part
	if (!refPart || !refPartInstance)
		throw new Error(`RundownPlaylist "${playlist._id}" has no next and no current part!`)

	const rawSegments = playoutModel.getAllOrderedSegments()
	const rawParts = playoutModel.getAllOrderedParts()

	if (segmentDelta) {
		// Ignores horizontalDelta
		const considerSegments = rawSegments.filter(
			(s) =>
				s.segment._id === refPart.segmentId ||
				!s.segment.isHidden ||
				s.segment.orphaned === SegmentOrphanedReason.SCRATCHPAD
		)
		const refSegmentIndex = considerSegments.findIndex((s) => s.segment._id === refPart.segmentId)
		if (refSegmentIndex === -1) throw new Error(`Segment "${refPart.segmentId}" not found!`)

		const targetSegmentIndex = refSegmentIndex + segmentDelta
		const targetSegment = considerSegments[targetSegmentIndex]
		if (!targetSegment) return null

		// find the allowable segment ids
		const allowedSegments =
			segmentDelta > 0
				? considerSegments.slice(targetSegmentIndex)
				: considerSegments.slice(0, targetSegmentIndex + 1).reverse()

		const playablePartsBySegment = groupByToMap(
			rawParts.filter((p) => isPartPlayable(p)),
			'segmentId'
		)

		// Iterate through segments and find the first part
		let selectedPart: ReadonlyDeep<DBPart> | undefined
		for (const segment of allowedSegments) {
			const parts = playablePartsBySegment.get(segment.segment._id) ?? []
			// Cant go to the current part (yet)
			const filteredParts = parts.filter((p) => p._id !== currentPartInstance?.part._id)
			if (filteredParts.length > 0) {
				selectedPart = filteredParts[0]
				break
			}
		}

		// TODO - looping playlists
		if (selectedPart) {
			// Switch to that part
			await setNextPartFromPart(context, playoutModel, selectedPart, true)
			return selectedPart._id
		} else {
			// Nothing looked valid so do nothing
			// Note: we should try and a smaller delta if it is not -1/1
			logger.info(`moveNextPart: Found no new part (verticalDelta=${segmentDelta})`)
			return null
		}
	} else if (partDelta) {
		let playabaleParts: ReadonlyDeep<DBPart>[] = rawParts.filter((p) => refPart._id === p._id || isPartPlayable(p))
		let refPartIndex = playabaleParts.findIndex((p) => p._id === refPart._id)
		if (refPartIndex === -1) {
			const tmpRefPart = { ...refPart, invalid: true } // make sure it won't be found as playable
			playabaleParts = sortPartsInSortedSegments(
				[...playabaleParts, tmpRefPart],
				rawSegments.map((s) => s.segment)
			)
			refPartIndex = playabaleParts.findIndex((p) => p._id === refPart._id)
			if (refPartIndex === -1) throw new Error(`Part "${refPart._id}" not found after insert!`)
		}

		// Get the past we are after
		const targetPartIndex = refPartIndex + partDelta
		let targetPart = playabaleParts[targetPartIndex]
		if (targetPart && targetPart._id === currentPartInstance?.part._id) {
			// Cant go to the current part (yet)
			const newIndex = targetPartIndex + (partDelta > 0 ? 1 : -1)
			targetPart = playabaleParts[newIndex]
		}

		if (targetPart) {
			// Switch to that part
			await setNextPartFromPart(context, playoutModel, targetPart, true)
			return targetPart._id
		} else {
			// Nothing looked valid so do nothing
			// Note: we should try and a smaller delta if it is not -1/1
			logger.info(`moveNextPart: Found no new part (horizontalDelta=${partDelta})`)
			return null
		}
	} else {
		throw new Error(`Missing delta to move by!`)
	}
}
