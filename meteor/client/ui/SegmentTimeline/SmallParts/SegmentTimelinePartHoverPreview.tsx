import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../../lib/collections/Studios'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { FloatingInspector } from '../../FloatingInspector'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer'
import { SegmentTimelinePart } from '../SegmentTimelinePart'

export const SegmentTimelinePartHoverPreview = ({
	showMiniInspector,
	displayOn,
	parts,
	floatingInspectorStyle,
	segment,
	playlist,
	studio,
	collapsedOutputs,
	autoNextPart,
	liveLineHistorySize,
	isLastSegment,
	totalSegmentDuration,
}: {
	showMiniInspector: boolean
	displayOn?: 'document' | 'viewport'
	parts: PartUi[]
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
	totalSegmentDuration: number
}) => {
	return showMiniInspector ? (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--small-parts"
			style={floatingInspectorStyle}
		>
			<span className="segment-timeline__mini-inspector--small-parts__duration">
				{RundownUtils.formatDiffToTimecode(totalSegmentDuration, false, false, true, false, true)}
			</span>
			<div className="segment-timeline__mini-inspector__mini-timeline">
				{parts.map((part) => {
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
							totalSegmentDuration={totalSegmentDuration}
							relative={true}
							scrollWidth={1}
							isLastSegment={isLastSegment}
							isLastInSegment={false}
							isAfterLastValidInSegmentAndItsLive={false}
							part={part}
							isPreview={true}
						/>
					)
				})}
			</div>
		</div>
	) : null
}
