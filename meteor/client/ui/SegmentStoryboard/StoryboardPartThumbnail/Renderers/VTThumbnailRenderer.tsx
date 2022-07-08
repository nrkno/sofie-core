import React from 'react'
import classNames from 'classnames'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'
import { RundownUtils } from '../../../../lib/rundown'
import { IProps } from './ThumbnailRendererFactory'
import { getPreviewUrlForPieceUi, getThumbnailUrlForPieceUi } from '../../../../lib/ui/clipPreview'
import { RundownTimingConsumer } from '../../../RundownView/RundownTiming/RundownTimingConsumer'
import { unprotectString } from '../../../../../lib/lib'
import { FreezeFrameIcon } from '../../../../lib/ui/icons/freezeFrame'
import { PieceStatusIcon } from '../../../../lib/ui/PieceStatusIcon'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'

export function VTThumbnailRenderer({
	partId,
	pieceInstance,
	partAutoNext,
	isLive,
	isFinished,
	hovering,
	hoverScrubTimePosition,
	originPosition,
	studio,
	layer,
}: IProps) {
	const mediaPreviewUrl = studio.settings.mediaPreviewsUrl

	const status = pieceInstance.instance.piece.status

	const vtContent = pieceInstance.instance.piece.content as VTContent

	const previewUrl: string | undefined = getPreviewUrlForPieceUi(pieceInstance, studio, mediaPreviewUrl)
	const thumbnailUrl: string | undefined = getThumbnailUrlForPieceUi(pieceInstance, studio, mediaPreviewUrl)

	const noticeLevel = status !== null && status !== undefined ? getNoticeLevelForPieceStatus(status) : null

	return (
		<>
			<VTFloatingInspector
				status={status || PieceStatusCode.UNKNOWN}
				showMiniInspector={hovering}
				timePosition={hoverScrubTimePosition}
				content={vtContent}
				floatingInspectorStyle={{
					top: originPosition.top + 'px',
					left: originPosition.left + 'px',
					transform: 'translate(0, -100%)',
				}}
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
				itemElement={null}
				contentMetaData={pieceInstance.contentMetaData || null}
				noticeMessage={pieceInstance.message || null}
				noticeLevel={noticeLevel}
				mediaPreviewUrl={mediaPreviewUrl}
				contentPackageInfos={pieceInstance.contentPackageInfos}
				pieceId={pieceInstance.instance.piece._id}
				expectedPackages={pieceInstance.instance.piece.expectedPackages}
				studio={studio}
			/>
			<RundownTimingConsumer
				filter={(timingContext) => ({
					partPlayed: timingContext.partPlayed && timingContext.partPlayed[unprotectString(partId)],
					partDisplayDurations:
						timingContext.partDisplayDurations && timingContext.partDisplayDurations[unprotectString(partId)],
				})}
			>
				{(timingContext) => {
					if (!timingContext.partPlayed || !timingContext.partDisplayDurations) return null

					const partPlayed = timingContext.partPlayed[unprotectString(partId)] ?? 0
					const contentEnd =
						(vtContent?.sourceDuration ?? 0) - (vtContent?.seek ?? 0) + (pieceInstance.renderedInPoint ?? 0)

					const contentLeft = contentEnd - partPlayed

					const partExpectedDuration = timingContext.partDisplayDurations[unprotectString(partId)]

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
									'segment-storyboard__thumbnail__countdown-icon--flash': isLive && contentLeft < 5000,
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
