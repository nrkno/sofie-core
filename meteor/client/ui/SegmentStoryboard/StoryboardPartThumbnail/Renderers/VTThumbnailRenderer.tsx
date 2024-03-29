import React from 'react'
import classNames from 'classnames'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../../../../lib/notifications/notifications'
import { RundownUtils } from '../../../../lib/rundown'
import { IProps } from './ThumbnailRendererFactory'
import { RundownTimingConsumer } from '../../../RundownView/RundownTiming/RundownTimingConsumer'
import { unprotectString } from '../../../../../lib/lib'
import { FreezeFrameIcon } from '../../../../lib/ui/icons/freezeFrame'
import { PieceStatusIcon } from '../../../../lib/ui/PieceStatusIcon'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { FREEZE_FRAME_FLASH } from '../../../SegmentContainer/withResolvedSegment'

export function VTThumbnailRenderer({
	partId,
	pieceInstance,
	partAutoNext,
	partPlannedStoppedPlayback,
	isLive,
	hovering,
	hoverScrubTimePosition,
	originPosition,
	studio,
	layer,
	height,
}: IProps): JSX.Element {
	const status = pieceInstance.contentStatus?.status

	const vtContent = pieceInstance.instance.piece.content as VTContent

	const previewUrl: string | undefined = pieceInstance.contentStatus?.previewUrl
	const thumbnailUrl: string | undefined = pieceInstance.contentStatus?.thumbnailUrl

	const noticeLevel = getNoticeLevelForPieceStatus(status)

	return (
		<>
			<VTFloatingInspector
				status={status || PieceStatusCode.UNKNOWN}
				showMiniInspector={hovering}
				timePosition={hoverScrubTimePosition}
				content={vtContent}
				position={{
					top: originPosition.top,
					left: originPosition.left,
					height,
					anchor: 'start',
					position: 'top-start',
				}}
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
				itemElement={null}
				noticeMessages={pieceInstance.contentStatus?.messages || null}
				noticeLevel={noticeLevel}
				studio={studio}
				previewUrl={pieceInstance.contentStatus?.previewUrl}
			/>
			<RundownTimingConsumer
				filter={(timingContext) => ({
					partPlayed: timingContext.partPlayed && timingContext.partPlayed[unprotectString(partId)],
					partDisplayDurations:
						timingContext.partDisplayDurations && timingContext.partDisplayDurations[unprotectString(partId)],
					currentTime: timingContext.currentTime,
				})}
			>
				{(timingContext) => {
					if (!timingContext.partPlayed || !timingContext.partDisplayDurations) return null

					const partPlayed = timingContext.partPlayed[unprotectString(partId)] ?? 0
					const contentEnd =
						(vtContent?.sourceDuration ?? 0) - (vtContent?.seek ?? 0) + (pieceInstance.renderedInPoint ?? 0)

					const contentLeft = contentEnd - partPlayed

					const partExpectedDuration = timingContext.partDisplayDurations[unprotectString(partId)]

					const isFinished =
						!!partPlannedStoppedPlayback &&
						!!timingContext.currentTime &&
						partPlannedStoppedPlayback < timingContext.currentTime

					const partLeft = partExpectedDuration - partPlayed

					return !isFinished &&
						!(hovering && thumbnailUrl && previewUrl) &&
						(contentLeft < 10000 || contentEnd < partExpectedDuration) &&
						(!partAutoNext || partLeft > contentLeft) ? (
						<div
							className={classNames('segment-storyboard__thumbnail__countdown', {
								'segment-storyboard__thumbnail__countdown--playing': isLive,
							})}
						>
							<span
								className={classNames('segment-storyboard__thumbnail__countdown-icon', {
									'segment-storyboard__thumbnail__countdown-icon--flash': isLive && contentLeft < FREEZE_FRAME_FLASH,
								})}
							>
								<FreezeFrameIcon />
							</span>
							{contentLeft > 0 ? (
								<span>{RundownUtils.formatDiffToTimecode(contentLeft, false, false, true, false, true, '+')}</span>
							) : null}
						</div>
					) : null
				}}
			</RundownTimingConsumer>
			<div className="segment-storyboard__thumbnail__label">
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
