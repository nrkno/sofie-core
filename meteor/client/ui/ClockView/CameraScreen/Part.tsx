import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import classNames from 'classnames'
import React, { useContext } from 'react'
import { AreaZoom } from '.'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PieceExtended } from '../../../../lib/Rundown'
import { getAllowSpeaking, getAllowVibrating } from '../../../lib/localStorage'
import { AutoNextStatus } from '../../RundownView/RundownTiming/AutoNextStatus'
import { CurrentPartRemaining } from '../../RundownView/RundownTiming/CurrentPartRemaining'
import { PartCountdown } from '../../RundownView/RundownTiming/PartCountdown'
import { PartDisplayDuration } from '../../RundownView/RundownTiming/PartDuration'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../../RundownView/RundownTiming/withTiming'
import { PartUi } from '../../SegmentContainer/withResolvedSegment'
import { Piece } from './Piece'

interface IProps {
	part: PartUi
	piece: PieceExtended
	playlist: RundownPlaylist
	isLive: boolean
	isNext: boolean
}

export const Part = withTiming<IProps, {}>({
	tickResolution: TimingTickResolution.High,
	dataResolution: TimingDataResolution.High,
})(function Part({ playlist, part, piece, timingDurations, isLive, isNext }): JSX.Element | null {
	const areaZoom = useContext(AreaZoom)

	let left =
		timingDurations.partCountdown?.[unprotectString(part.partId)] ??
		0 - (timingDurations.partPlayed?.[unprotectString(part.partId)] ?? 0)
	let width: number | null = timingDurations.partDisplayDurations?.[unprotectString(part.partId)] ?? 0

	if (isLive) {
		left = 0
		width =
			timingDurations.remainingTimeOnCurrentPart !== undefined
				? Math.min(0, timingDurations.remainingTimeOnCurrentPart)
				: null
	}

	if (!part.instance.part.expectedDuration) {
		width = null
	}

	return (
		<div
			className={classNames('camera-screen__part', { live: isLive, next: isNext })}
			data-obj-id={part.instance._id}
			data-part-id={part.instance.part._id}
		>
			{piece && (
				<Piece
					partId={part.instance.part._id}
					piece={piece}
					left={left}
					width={width}
					zoom={areaZoom}
					isLive={isLive}
				/>
			)}
			<div className="camera-screen__countdown">
				<PartCountdown playlist={playlist} partId={part.partId} />
			</div>
			<div className="camera-screen__part-duration-left">
				{isLive && (
					<>
						<span className="camera-screen__part-take-mode">
							<AutoNextStatus />
						</span>
						<CurrentPartRemaining
							currentPartInstanceId={part.instance._id}
							speaking={getAllowSpeaking()}
							vibrating={getAllowVibrating()}
							heavyClassName="overtime"
						/>
					</>
				)}
				{!isLive && <PartDisplayDuration part={part} />}
			</div>
		</div>
	)
})
