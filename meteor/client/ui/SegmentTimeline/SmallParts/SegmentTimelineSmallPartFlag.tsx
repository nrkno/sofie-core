import React, { useRef, useState } from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { SegmentTimelineSmallPartFlagIcon } from './SegmentTimelineSmallPartFlagIcon'
import { unprotectString } from '../../../../lib/lib'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../../lib/collections/Studios'
import { SegmentTimelinePartHoverPreview } from './SegmentTimelinePartHoverPreview'
import { TFunction } from 'i18next'

export const SegmentTimelineSmallPartFlag = ({
	t,
	parts,
	followingPart,
	sourceLayers,
	timeScale,

	segment,
	playlist,
	studio,
	collapsedOutputs,
	autoNextPart,
	liveLineHistorySize,
	isLastSegment,
}: {
	t: TFunction
	parts: [PartUi, number][]
	followingPart: PartUi | undefined
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	timeScale: number

	segment: SegmentUi
	playlist: RundownPlaylist
	studio: Studio
	collapsedOutputs: {
		[key: string]: boolean
	}
	autoNextPart: boolean
	liveLineHistorySize: number
	isLastSegment: boolean
}) => {
	const flagRef = useRef<HTMLDivElement>(null)

	const [isHover, setHover] = useState(false)
	const onMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
		setHover(true)
	}
	const onMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
		setHover(false)
	}

	let partDurations = 0
	const partFlags = parts.map(([part, duration], index) => {
		partDurations += duration
		return (
			<SegmentTimelineSmallPartFlagIcon
				key={unprotectString(part.instance._id)}
				partInstance={part}
				sourceLayers={sourceLayers}
				isNext={playlist.nextPartInstanceId === part.instance._id}
				isLive={playlist.currentPartInstanceId === part.instance._id}
			/>
		)
	})
	return (
		<div className="segment-timeline__small-parts-flag-hoist">
			<div
				className="segment-timeline__small-parts-flag"
				ref={flagRef}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				style={{
					transform: `translateX(${(partDurations * timeScale) / -2}px)`,
				}}
			>
				{partFlags}
			</div>
			<SegmentTimelinePartHoverPreview
				t={t}
				autoNextPart={autoNextPart}
				collapsedOutputs={collapsedOutputs}
				studio={studio}
				showMiniInspector={isHover}
				followingPart={followingPart}
				parts={parts.map(([part]) => part)}
				segment={segment}
				playlist={playlist}
				liveLineHistorySize={liveLineHistorySize}
				isLastSegment={isLastSegment}
				totalSegmentDuration={partDurations}
				floatingInspectorStyle={{
					left: `${partDurations * timeScale * -1}px`,
				}}
			/>
		</div>
	)
}
