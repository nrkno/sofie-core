import React, { useLayoutEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { Studio } from '../../../../lib/collections/Studios'
import { unprotectString } from '../../../../lib/lib'
import { RundownUtils } from '../../../lib/rundown'
import { PartUi, SegmentUi } from '../SegmentTimelineContainer'
import { SegmentTimelinePart } from '../Parts/SegmentTimelinePart'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'

export const SegmentTimelinePartHoverPreview = ({
	t,
	showMiniInspector,
	parts,
	followingPart,
	segment,
	playlist,
	studio,
	collapsedOutputs,
	autoNextPart,
	liveLineHistorySize,
	isLastSegment,
	isLastInSegment,
	totalSegmentDuration,
	parentTimeScale,
	showDurationSourceLayers,
}: {
	t: TFunction
	showMiniInspector: boolean
	parts: PartUi[]
	followingPart: PartUi | undefined

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
	parentTimeScale: number
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
}) => {
	const [miniInspectorEl, setMiniInnspectorEl] = useState<HTMLDivElement | null>(null)
	const [containOffset, setContainOffset] = useState(0)
	const followingPartPreviewDuration = 0.15 * totalSegmentDuration
	const previewWindowDuration =
		totalSegmentDuration + (followingPart || isLastInSegment ? followingPartPreviewDuration : 0)

	useLayoutEffect(() => {
		if (miniInspectorEl) {
			const inspectorRect = miniInspectorEl.getBoundingClientRect()
			const timelineRect = miniInspectorEl.parentElement?.parentElement?.parentElement?.getBoundingClientRect()
			if (timelineRect && timelineRect.right < inspectorRect.right) {
				setContainOffset(inspectorRect.right - timelineRect.right - containOffset)
			}
		} else {
			setContainOffset(0)
		}
	}, [miniInspectorEl, parentTimeScale, totalSegmentDuration])

	return showMiniInspector ? (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--small-parts"
			style={{
				left: `${totalSegmentDuration * parentTimeScale * -1 - containOffset}px`,
			}}
			ref={(el) => setMiniInnspectorEl(el)}
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
							isBudgetGap={false}
							showDurationSourceLayers={showDurationSourceLayers}
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
						isBudgetGap={false}
						showDurationSourceLayers={showDurationSourceLayers}
					/>
				)}
			</div>
		</div>
	) : null
}
