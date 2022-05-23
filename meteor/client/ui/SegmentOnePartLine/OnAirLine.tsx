import React, { useEffect, useMemo, useState } from 'react'
import {
	TimingDataResolution,
	TimingTickResolution,
	WithTiming,
	withTiming,
} from '../RundownView/RundownTiming/withTiming'
import { SIMULATED_PLAYBACK_HARD_MARGIN } from '../SegmentTimeline/SegmentTimelineContainer'
import { PartInstanceLimited } from '../../../lib/Rundown'
import { useTranslation } from 'react-i18next'
import { getAllowSpeaking } from '../../lib/localStorage'
import { CurrentPartRemaining } from '../RundownView/RundownTiming/CurrentPartRemaining'
import { AutoNextStatus } from '../RundownView/RundownTiming/AutoNextStatus'

interface IProps {
	partInstance: PartInstanceLimited
	maxDuration: number
	timelineBase: number
}

function timeToPosition(time: number, timelineBase: number, maxDuration: number): React.CSSProperties {
	const position = Math.min(1, Math.min(time, maxDuration) / timelineBase)

	return {
		left: `${position * 100}%`,
	}
}

function timeToSize(time: number, timelineBase: number, maxDuration: number): React.CSSProperties {
	const position = Math.min(1, Math.min(time, maxDuration) / timelineBase)

	return {
		width: `${position * 100}%`,
	}
}

export const OnAirLine = withTiming<IProps, {}>({
	filter: 'currentTime',
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
})(function OnAirLine({ partInstance, timingDurations, timelineBase, maxDuration }: WithTiming<IProps>) {
	const [livePosition, setLivePosition] = useState(0)
	const { t } = useTranslation()

	useEffect(() => {
		if (!timingDurations || !timingDurations.currentTime) return

		let isExpectedToPlay = !!partInstance.timings?.startedPlayback
		const lastTake = partInstance.timings?.take
		const lastStartedPlayback = partInstance.timings?.startedPlayback
		const lastTakeOffset = partInstance.timings?.playOffset || 0
		const virtualStartedPlayback =
			(lastTake || 0) > (lastStartedPlayback || -1)
				? lastTake
				: lastStartedPlayback !== undefined
				? lastStartedPlayback - lastTakeOffset
				: undefined

		if (lastTake && lastTake + SIMULATED_PLAYBACK_HARD_MARGIN > timingDurations.currentTime) {
			isExpectedToPlay = true
		}

		const newLivePosition =
			isExpectedToPlay && virtualStartedPlayback
				? timingDurations.currentTime - virtualStartedPlayback + lastTakeOffset
				: lastTakeOffset

		setLivePosition(newLivePosition)
	}, [timingDurations.currentTime])

	const style = useMemo(
		() => timeToPosition(livePosition, timelineBase, maxDuration),
		[livePosition, timelineBase, maxDuration]
	)

	const shadowStyle = useMemo(
		() => timeToSize(livePosition, timelineBase, maxDuration),
		[livePosition, timelineBase, maxDuration]
	)

	return (
		<>
			<div className="segment-opl__timeline-shadow" style={shadowStyle}></div>
			<div className="segment-opl__timeline-flag segment-opl__on-air-line" style={style}>
				<div className="segment-opl__timeline-flag__label">{t('On Air')}</div>
				<div className="segment-opl__on-air-line__countdown">
					<AutoNextStatus />
					<CurrentPartRemaining
						currentPartInstanceId={partInstance._id}
						speaking={getAllowSpeaking()}
						heavyClassName="overtime"
					/>
				</div>
			</div>
		</>
	)
})
