import React, { useMemo } from 'react'
import {
	TimingDataResolution,
	TimingTickResolution,
	WithTiming,
	withTiming,
} from '../RundownView/RundownTiming/withTiming'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownUtils } from '../../lib/rundown'
import { FreezeFrameIcon } from '../../lib/ui/icons/freezeFrame'

interface IProps {
	partId: PartId
	maxDuration: number
	timelineBase: number
	mainSourceEnd: number
	endsInFreeze: boolean
	partRenderedDuration: number
}

function timeToPosition(time: number, timelineBase: number, maxDuration: number): string {
	const position = Math.min(1, Math.min(time, maxDuration) / timelineBase)

	return `${position * 100}%`
}

export const OvertimeShadow = withTiming<IProps, {}>((props) => ({
	filter: (data) => data.partPlayed?.[unprotectString(props.partId)],
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
}))(function OvertimeShadow({
	partId,
	timingDurations,
	timelineBase,
	mainSourceEnd,
	endsInFreeze,
	partRenderedDuration,
}: WithTiming<IProps>) {
	const livePosition = timingDurations.partPlayed?.[unprotectString(partId)] ?? 0

	const originalDiff = mainSourceEnd - partRenderedDuration
	const diff = mainSourceEnd - Math.max(livePosition, partRenderedDuration)

	const overtimeStyle = useMemo<React.CSSProperties>(
		() => ({
			left:
				endsInFreeze && mainSourceEnd
					? timeToPosition(
							diff >= 0
								? Math.min(mainSourceEnd, Math.max(livePosition, partRenderedDuration))
								: Math.max(mainSourceEnd, Math.max(livePosition, partRenderedDuration)),
							timelineBase,
							timelineBase
					  )
					: undefined,
		}),
		[livePosition, timelineBase, mainSourceEnd, partRenderedDuration, diff]
	)

	const freezeFrameIconStyle = useMemo<React.CSSProperties>(
		() => ({
			left: timeToPosition(mainSourceEnd, timelineBase, timelineBase),
		}),
		[mainSourceEnd, timelineBase]
	)

	return endsInFreeze && mainSourceEnd && (originalDiff < 0 || diff > 0) ? (
		<>
			<div className="segment-opl__freeze-marker" style={freezeFrameIconStyle}>
				<FreezeFrameIcon />
			</div>
			<div className="segment-opl__overtime-shadow" style={overtimeStyle}>
				<span className="segment-opl__overtime-timer" role="timer">
					{RundownUtils.formatDiffToTimecode(diff, true, false, true, false, true, undefined, false, true)}
				</span>
			</div>
		</>
	) : null
})
