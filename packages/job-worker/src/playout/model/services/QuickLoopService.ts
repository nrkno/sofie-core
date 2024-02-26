import { MarkerPosition, compareMarkerPositions } from '@sofie-automation/corelib/dist/playout/playlist'
import { PlayoutModelReadonly } from '../PlayoutModel'
import {
	ForceQuickLoopAutoNext,
	QuickLoopMarker,
	QuickLoopMarkerType,
	QuickLoopProps,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutPartInstanceModel } from '../PlayoutPartInstanceModel'
import { JobContext } from '../../../jobs'
import { DEFAULT_FALLBACK_PART_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import { clone } from '@sofie-automation/corelib/dist/lib'

export class QuickLoopService {
	constructor(private readonly context: JobContext, private readonly playoutModel: PlayoutModelReadonly) {}

	getUpdatedProps(hasJustSetMarker?: 'start' | 'end'): QuickLoopProps | undefined {
		if (this.playoutModel.playlist.quickLoop == null) return undefined
		const quickLoopProps = clone(this.playoutModel.playlist.quickLoop)
		const wasLoopRunning = quickLoopProps.running

		this.resetDynamicallyInsertedPartOverrideIfNoLongerNeeded(quickLoopProps)

		let isNextBetweenMarkers = false
		if (quickLoopProps.start == null || quickLoopProps.end == null) {
			quickLoopProps.running = false
		} else {
			const orderedParts = this.playoutModel.getAllOrderedParts()

			const rundownIds = this.playoutModel.getRundownIds()

			const startPosition = this.findQuickLoopMarkerPosition(
				quickLoopProps.start,
				'start',
				orderedParts,
				rundownIds
			)
			const endPosition = this.findQuickLoopMarkerPosition(quickLoopProps.end, 'end', orderedParts, rundownIds)

			let isCurrentBetweenMarkers = false

			if (this.areMarkersFlipped(startPosition, endPosition)) {
				if (hasJustSetMarker === 'start') {
					delete quickLoopProps.end
				} else if (hasJustSetMarker === 'end') {
					delete quickLoopProps.start
				}
			} else {
				const currentPartPosition = this.findPartPosition(this.playoutModel.currentPartInstance, rundownIds)
				const nextPartPosition = this.findPartPosition(this.playoutModel.nextPartInstance, rundownIds)

				isCurrentBetweenMarkers = currentPartPosition
					? compareMarkerPositions(startPosition, currentPartPosition) >= 0 &&
					  compareMarkerPositions(currentPartPosition, endPosition) >= 0
					: false
				isNextBetweenMarkers = nextPartPosition
					? compareMarkerPositions(startPosition, nextPartPosition) >= 0 &&
					  compareMarkerPositions(nextPartPosition, endPosition) >= 0
					: false

				if (this.playoutModel.nextPartInstance && isNextBetweenMarkers) {
					this.updateQuickLoopPartOverrides(this.playoutModel.nextPartInstance, quickLoopProps.forceAutoNext)
				}
			}

			quickLoopProps.running =
				quickLoopProps.start != null && quickLoopProps.end != null && isCurrentBetweenMarkers
		}

		if (this.playoutModel.currentPartInstance && quickLoopProps.running) {
			this.updateQuickLoopPartOverrides(this.playoutModel.currentPartInstance, quickLoopProps.forceAutoNext)
		} else if (this.playoutModel.currentPartInstance && wasLoopRunning) {
			this.revertQuickLoopPartOverrides(this.playoutModel.currentPartInstance)
		}

		if (this.playoutModel.nextPartInstance && !isNextBetweenMarkers) {
			this.revertQuickLoopPartOverrides(this.playoutModel.nextPartInstance)
		}

		if (wasLoopRunning && !quickLoopProps.running) {
			// clears the loop markers after leaving the loop, as per the requirements, but perhaps it should be optional
			return undefined
		}

		return quickLoopProps
	}

	getUpdatedPropsBySettingAMarker(type: 'start' | 'end', marker: QuickLoopMarker | null): QuickLoopProps | undefined {
		if (this.playoutModel.playlist.quickLoop?.locked) {
			throw new Error('Looping is locked')
		}
		const quickLoopProps = {
			running: false,
			locked: false,
			...clone(this.playoutModel.playlist.quickLoop),
			forceAutoNext: this.context.studio.settings.forceQuickLoopAutoNext ?? ForceQuickLoopAutoNext.DISABLED,
		}
		if (type === 'start') {
			if (marker == null) {
				delete quickLoopProps.start
			} else {
				quickLoopProps.start = marker
			}
		} else {
			if (marker == null) {
				delete quickLoopProps.end
			} else {
				quickLoopProps.end = marker
			}
		}

		return quickLoopProps
	}

	getUpdatedPropsByClearingMarkers(): QuickLoopProps | undefined {
		if (!this.playoutModel.playlist.quickLoop || this.playoutModel.playlist.quickLoop.locked) return undefined

		const quickLoopProps = clone(this.playoutModel.playlist.quickLoop)
		delete quickLoopProps.start
		delete quickLoopProps.end
		quickLoopProps.running = false

		return quickLoopProps
	}

	private areMarkersFlipped(startPosition: MarkerPosition, endPosition: MarkerPosition) {
		return compareMarkerPositions(startPosition, endPosition) < 0
	}

	private resetDynamicallyInsertedPartOverrideIfNoLongerNeeded(quickLoopProps: QuickLoopProps) {
		const endMarker = quickLoopProps.end
		if (
			endMarker?.type === QuickLoopMarkerType.PART &&
			endMarker.overridenId &&
			endMarker.id !== this.playoutModel.currentPartInstance?.partInstance.part._id &&
			endMarker.id !== this.playoutModel.nextPartInstance?.partInstance.part._id
		) {
			endMarker.id = endMarker.overridenId
			delete endMarker.overridenId
		}
	}

	private findQuickLoopMarkerPosition(
		marker: QuickLoopMarker,
		type: 'start' | 'end',
		orderedParts: ReadonlyObjectDeep<DBPart>[],
		rundownIds: RundownId[]
	): MarkerPosition {
		let part: ReadonlyObjectDeep<DBPart> | undefined
		let segment: ReadonlyObjectDeep<DBSegment> | undefined
		let rundownRank
		if (marker.type === QuickLoopMarkerType.PART) {
			const partId = marker.id
			const partIndex = orderedParts.findIndex((part) => part._id === partId)
			part = orderedParts[partIndex]
		}
		if (marker.type === QuickLoopMarkerType.SEGMENT) {
			segment = this.playoutModel.findSegment(marker.id)?.segment
		} else if (part != null) {
			segment = this.playoutModel.findSegment(part.segmentId)?.segment
		}
		if (marker.type === QuickLoopMarkerType.RUNDOWN) {
			rundownRank = rundownIds.findIndex((id) => id === marker.id)
		} else if (part ?? segment != null) {
			rundownRank = rundownIds.findIndex((id) => id === (part ?? segment)?.rundownId)
		}
		const fallback = type === 'start' ? -Infinity : Infinity
		return {
			partRank: part?._rank ?? fallback,
			segmentRank: segment?._rank ?? fallback,
			rundownRank: rundownRank ?? fallback,
		}
	}

	private updateQuickLoopPartOverrides(
		partInstance: PlayoutPartInstanceModel,
		forceAutoNext: ForceQuickLoopAutoNext
	): void {
		const partPropsToUpdate: Partial<DBPart> = {}
		if (
			!partInstance.partInstance.part.expectedDuration &&
			forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION
		) {
			partPropsToUpdate.expectedDuration =
				this.context.studio.settings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION
		}
		if (
			(partInstance.partInstance.part.expectedDuration || partPropsToUpdate.expectedDuration) &&
			forceAutoNext !== ForceQuickLoopAutoNext.DISABLED &&
			!partInstance.partInstance.part.autoNext
		) {
			partPropsToUpdate.autoNext = true
		}
		if (Object.keys(partPropsToUpdate).length) {
			partInstance.overridePartProps(partPropsToUpdate)
			if (partPropsToUpdate.expectedDuration) partInstance.recalculateExpectedDurationWithPreroll()
		}
	}

	private revertQuickLoopPartOverrides(partInstance: PlayoutPartInstanceModel) {
		const overridenProperties = partInstance.partInstance.part.overridenProperties
		if (overridenProperties) {
			partInstance.revertOverridenPartProps()
			if (overridenProperties.expectedDuration) {
				partInstance.recalculateExpectedDurationWithPreroll()
			}
		}
	}

	private findPartPosition(
		partInstance: PlayoutPartInstanceModel | null,
		rundownIds: RundownId[]
	): MarkerPosition | undefined {
		if (partInstance == null) return undefined
		const currentSegment = this.playoutModel.findSegment(partInstance.partInstance.segmentId)?.segment
		const currentRundownIndex = rundownIds.findIndex((id) => id === partInstance.partInstance.rundownId)

		return {
			partRank: partInstance.partInstance.part._rank,
			segmentRank: currentSegment?._rank ?? 0,
			rundownRank: currentRundownIndex ?? 0,
		}
	}
}
