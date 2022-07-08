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
import classNames from 'classnames'

interface IProps {
	partId: PartId
	maxDuration: number
	timelineBase: number
	mainSourceEnd: number
	endsInFreeze: boolean
	partRenderedDuration: number
	isPartZeroBudget: boolean
	isLive: boolean
	hasAlreadyPlayed: boolean
}

function timeToPosition(time: number, timelineBase: number, maxDuration: number): string {
	const position = Math.min(1, Math.min(time, maxDuration) / timelineBase)

	return `${position * 100}%`
}

// TODO: This should use RundownTimingConsumer
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
	isPartZeroBudget,
	isLive,
	hasAlreadyPlayed,
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
								: Math.max(livePosition, Math.max(mainSourceEnd, partRenderedDuration)),
							timelineBase,
							timelineBase
					  )
					: timeToPosition(Math.max(livePosition, partRenderedDuration), timelineBase, timelineBase),
			display: endsInFreeze && livePosition > mainSourceEnd ? 'none' : undefined,
		}),
		[livePosition, timelineBase, mainSourceEnd, partRenderedDuration, diff]
	)

	const freezeFrameIconStyle = useMemo<React.CSSProperties>(
		() => ({
			left: timeToPosition(mainSourceEnd, timelineBase, timelineBase),
		}),
		[mainSourceEnd, timelineBase]
	)

	return (
		//mainSourceEnd && (originalDiff < 0 || diff > 0) ?
		<>
			<div
				className={classNames('segment-opl__overtime-shadow', {
					'segment-opl__overtime-shadow--no-end': isPartZeroBudget && !endsInFreeze,
				})}
				style={overtimeStyle}
			>
				{mainSourceEnd && !isLive && !hasAlreadyPlayed && (originalDiff < 0 || diff > 0) && (
					<span className="segment-opl__overtime-timer" role="timer">
						{RundownUtils.formatDiffToTimecode(diff, true, false, true, false, true, undefined, false, true)}
					</span>
				)}
			</div>
			{endsInFreeze && (
				<div className="segment-opl__freeze-marker" style={freezeFrameIconStyle}>
					<FreezeFrameIcon />
					{mainSourceEnd &&
						isLive &&
						(originalDiff < 0 || Math.floor(diff / 1000) > 0) &&
						livePosition > partRenderedDuration && (
							<span className="segment-opl__freeze-marker-timer" role="timer">
								{RundownUtils.formatDiffToTimecode(diff, true, false, true, false, true, undefined, false, true)}
							</span>
						)}
				</div>
			)}
		</>
	)
})
