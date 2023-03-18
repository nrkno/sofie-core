import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import classNames from 'classnames'
import React, { useContext } from 'react'
import { AreaZoom } from '.'
import { PieceExtended } from '../../../../lib/Rundown'
import { getAllowSpeaking } from '../../../lib/localStorage'
import { AutoNextStatus } from '../../RundownView/RundownTiming/AutoNextStatus'
import { CurrentPartRemaining } from '../../RundownView/RundownTiming/CurrentPartRemaining'
import { PartDisplayDuration } from '../../RundownView/RundownTiming/PartDuration'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../../RundownView/RundownTiming/withTiming'
import { PartUi } from '../../SegmentContainer/withResolvedSegment'
import { Piece } from './Piece'

interface IProps {
	part: PartUi
	piece: PieceExtended
	isLive: boolean
	isNext: boolean
}

export const Part = withTiming<IProps, {}>({
	tickResolution: TimingTickResolution.High,
	dataResolution: TimingDataResolution.High,
})(function Part({ part, piece, timingDurations, isLive, isNext }): JSX.Element | null {
	const areaZoom = useContext(AreaZoom)

	let left =
		(timingDurations.partCountdown?.[unprotectString(part.partId)] ??
			0 - (timingDurations.partPlayed?.[unprotectString(part.partId)] ?? 0)) * areaZoom
	let width = (timingDurations.partDisplayDurations?.[unprotectString(part.partId)] ?? 1 / areaZoom) * areaZoom

	if (isLive) {
		left = 0
		width = Math.max(0, -1 * (timingDurations.remainingTimeOnCurrentPart ?? 0)) * areaZoom
	}

	return (
		<div className={classNames('camera-screen__part', { live: isLive, next: isNext })}>
			{piece && <Piece piece={piece} left={left} width={width} />}
			<div className="camera-screen__part-countdown">
				{isLive && (
					<>
						<AutoNextStatus />
						<CurrentPartRemaining
							currentPartInstanceId={part.instance._id}
							speaking={getAllowSpeaking()}
							heavyClassName="overtime"
						/>
					</>
				)}
				{!isLive && <PartDisplayDuration part={part} />}
			</div>
		</div>
	)
})
