import React from 'react'
import { TFunction } from 'i18next'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../../lib/collections/Studios'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer'
import { SegmentTimelinePart } from '../SegmentTimelinePart'

export const SegmentTimelinePartHoverPreview = ({
	t,
	showMiniInspector,
	parts,
	followingPart,
	floatingInspectorStyle,
	segment,
	playlist,
	studio,
	collapsedOutputs,
	autoNextPart,
	liveLineHistorySize,
	isLastSegment,
	isLastInSegment,
	totalSegmentDuration,
}: {
	t: TFunction
	showMiniInspector: boolean
	parts: PartUi[]
	followingPart: PartUi | undefined
	floatingInspectorStyle: React.CSSProperties

	segment: SegmentUi
	playlist: RundownPlaylist
	studio: Studio
	collapsedOutputs: {
		[key: string]: boolean
	}
	autoNextPart: boolean
	liveLineHistorySize: number
	isLastSegment: boolean
	isLastInSegment: boolean
	totalSegmentDuration: number
}) => {
	const followingPartPreviewDuration = 0.15 * totalSegmentDuration
	const previewWindowDuration =
		totalSegmentDuration + (followingPart || isLastInSegment ? followingPartPreviewDuration : 0)
	return showMiniInspector ? (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--small-parts"
			style={floatingInspectorStyle}
		>
			<div className="segment-timeline__mini-inspector--small-parts__duration">
				<span className="segment-timeline__mini-inspector--small-parts__duration__label">{t('Parts Duration')}</span>
				{RundownUtils.formatDiffToTimecode(totalSegmentDuration, false, false, true, false, true)}
			</div>
			<div className="segment-timeline__mini-inspector__mini-timeline">
				{parts.map((part, index) => {
					return (
						<SegmentTimelinePart
							key={unprotectString(part.instance._id)}
							segment={segment}
							playlist={playlist}
							studio={studio}
							collapsedOutputs={collapsedOutputs}
							scrollLeft={0}
							timeScale={0}
							autoNextPart={autoNextPart}
							followLiveLine={false}
							liveLineHistorySize={liveLineHistorySize}
							livePosition={0}
							totalSegmentDuration={previewWindowDuration}
							relative={true}
							scrollWidth={1}
							isLastSegment={isLastSegment}
							isLastInSegment={isLastInSegment && !followingPart && parts.length - 1 === index}
							isAfterLastValidInSegmentAndItsLive={false}
							part={part}
							isPreview={true}
						/>
					)
				})}
				{followingPart && (
					<SegmentTimelinePart
						key={unprotectString(followingPart.instance._id)}
						className="segment-timeline__part--shaded"
						segment={segment}
						playlist={playlist}
						studio={studio}
						collapsedOutputs={collapsedOutputs}
						scrollLeft={0}
						timeScale={0}
						autoNextPart={autoNextPart}
						followLiveLine={false}
						liveLineHistorySize={liveLineHistorySize}
						livePosition={0}
						totalSegmentDuration={previewWindowDuration}
						relative={true}
						scrollWidth={1}
						isLastSegment={isLastSegment}
						isLastInSegment={false}
						isAfterLastValidInSegmentAndItsLive={false}
						part={followingPart}
						isPreview={true}
						cropDuration={followingPartPreviewDuration}
					/>
				)}
				{!followingPart && isLastInSegment && (
					<div className="segment-timeline__part segment-timeline__part--end-of-segment"></div>
				)}
			</div>
		</div>
	) : null
}
