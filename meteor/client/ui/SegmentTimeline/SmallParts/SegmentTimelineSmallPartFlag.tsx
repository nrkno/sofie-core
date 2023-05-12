import React, { CSSProperties, useMemo, useRef, useState } from 'react'
import { SmallPartFlag } from '../../../lib/ui/icons/segment'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { SegmentTimelineSmallPartFlagIcon } from './SegmentTimelineSmallPartFlagIcon'
import { protectString, unprotectString } from '../../../../lib/lib'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { SegmentTimelinePartHoverPreview } from './SegmentTimelinePartHoverPreview'
import RundownViewEventBus, { RundownViewEvents } from '../../../../lib/api/triggers/RundownViewEventBus'
import { UIStudio } from '../../../../lib/api/studios'
import { CalculateTimingsPiece } from '@sofie-automation/corelib/dist/playout/timings'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimingDataResolution, TimingTickResolution, withTiming } from '../../RundownView/RundownTiming/withTiming'

export const SegmentTimelineSmallPartFlag = withTiming<
	{
		parts: [PartUi, number, number][]
		pieces: Map<PartId, CalculateTimingsPiece[]>
		followingPart: PartUi | undefined
		firstPartInSegmentId: PartId
		sourceLayers: {
			[key: string]: ISourceLayer
		}
		timeScale: number

		segment: SegmentUi
		playlist: RundownPlaylist
		studio: UIStudio
		collapsedOutputs: {
			[key: string]: boolean
		}
		autoNextPart: boolean
		liveLineHistorySize: number
		isLastSegment: boolean
		isLastInSegment: boolean
		timelineWidth: number
		showDurationSourceLayers?: Set<ISourceLayer['_id']>
	},
	{}
>((props) => ({
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
	filter: (timings) => [
		timings?.partDisplayStartsAt?.[unprotectString(props.firstPartInSegmentId)],
		timings?.partDisplayStartsAt?.[unprotectString(props.parts[0][0].partId)],
	],
}))(
	({
		parts,
		pieces,
		followingPart,
		sourceLayers,
		timeScale,
		firstPartInSegmentId,

		segment,
		playlist,
		studio,
		collapsedOutputs,
		autoNextPart,
		liveLineHistorySize,
		isLastSegment,
		isLastInSegment,
		showDurationSourceLayers,

		timingDurations,
	}): JSX.Element => {
		const flagRef = useRef<HTMLDivElement>(null)

		const firstPartDisplayStartsAt =
			(timingDurations.partDisplayStartsAt?.[unprotectString(parts[0][0].partId)] ?? 0) -
			(timingDurations.partDisplayStartsAt?.[unprotectString(firstPartInSegmentId)] ?? 0)

		const pixelOffsetPosition = firstPartDisplayStartsAt * timeScale

		const [isHover, setHover] = useState(false)
		const onMouseEnter = () => {
			setHover(true)
		}
		const onMouseLeave = () => {
			setHover(false)
		}

		const onClickFlagIcon = (e: React.MouseEvent<HTMLDivElement>) => {
			const partInstanceId = e.currentTarget.dataset['partInstanceId'] // note this needs to match the contents of the data prop in SegmentTimelineSmallPartFlagIcon
			if (partInstanceId) {
				RundownViewEventBus.emit(RundownViewEvents.GO_TO_PART_INSTANCE, {
					segmentId: segment._id,
					partInstanceId: protectString(partInstanceId),
					zoomInToFit: true,
					context: e,
				})
			}
		}

		const flagHoistStyle = useMemo<CSSProperties>(
			() => ({
				transform: `translateX(${pixelOffsetPosition}px)`,
				willChange: 'transform',
			}),
			[pixelOffsetPosition]
		)

		let partDisplayDurations = 0
		let partActualDurations = 0
		const partFlags = parts.map(([part, displayDuration, actualDuration]) => {
			partDisplayDurations += displayDuration
			partActualDurations += actualDuration
			return (
				<SegmentTimelineSmallPartFlagIcon
					key={unprotectString(part.instance._id)}
					partInstance={part}
					sourceLayers={sourceLayers}
					isNext={playlist.nextPartInfo?.partInstanceId === part.instance._id}
					isLive={playlist.currentPartInfo?.partInstanceId === part.instance._id}
					onClick={onClickFlagIcon}
					data={{
						'data-part-instance-id': unprotectString(part.instance._id), // this needs to match with onFlagClick handler
					}}
				/>
			)
		})
		return (
			<div
				className="segment-timeline__small-parts-flag-hoist"
				style={flagHoistStyle}
				data-test={`translateX(${pixelOffsetPosition})`}
			>
				<div
					className="segment-timeline__small-parts-flag"
					ref={flagRef}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
					style={{
						transform: `translateX(${(partDisplayDurations * timeScale) / 2}px)`,
					}}
				>
					<SmallPartFlag className="segment-timeline__small-parts-flag-pointer" />
					{partFlags}
				</div>
				<SegmentTimelinePartHoverPreview
					autoNextPart={autoNextPart}
					collapsedOutputs={collapsedOutputs}
					studio={studio}
					showMiniInspector={isHover}
					followingPart={followingPart}
					parts={parts.map(([part]) => part)}
					pieces={pieces}
					segment={segment}
					playlist={playlist}
					liveLineHistorySize={liveLineHistorySize}
					isLastSegment={isLastSegment}
					isLastInSegment={isLastInSegment}
					totalSegmentDisplayDuration={partDisplayDurations}
					actualPartsDuration={partActualDurations}
					parentTimeScale={timeScale}
					showDurationSourceLayers={showDurationSourceLayers}
				/>
			</div>
		)
	}
)
