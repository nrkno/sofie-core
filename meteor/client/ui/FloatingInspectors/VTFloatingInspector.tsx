import React from 'react'
import { useTranslation } from 'react-i18next'

import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { FloatingInspector } from '../FloatingInspector'
import { NoticeLevel } from '../../lib/notifications/notifications'
import { ExpectedPackage, VTContent } from '@sofie-automation/blueprints-integration'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { ScanInfoForPackages } from '../../../lib/mediaObjects'
import { IStudioSettings, Studio } from '../../../lib/collections/Studios'
import { PieceId, PieceStatusCode } from '../../../lib/collections/Pieces'
import { getPreviewUrlForExpectedPackagesAndContentMetaData } from '../../lib/ui/clipPreview'
import { VideoPreviewPlayer } from '../../lib/VideoPreviewPlayer'
import classNames from 'classnames'

interface IProps {
	status: PieceStatusCode
	mediaPreviewUrl?: string
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	floatingInspectorStyle: React.CSSProperties
	timePosition: number
	content: VTContent | undefined
	noticeLevel: NoticeLevel | null
	noticeMessage: string | null
	contentMetaData: MediaObject | null
	renderedDuration?: number | undefined

	contentPackageInfos: ScanInfoForPackages | undefined
	pieceId: PieceId
	expectedPackages: ExpectedPackage.Any[] | undefined
	studio: Studio | undefined
	displayOn?: 'document' | 'viewport'

	hideHoverscrubPreview?: boolean
}

function renderNotice(noticeLevel: NoticeLevel, noticeMessage: string | null): JSX.Element {
	return (
		<>
			<div className="segment-timeline__mini-inspector__notice-header">
				{noticeLevel === NoticeLevel.CRITICAL ? (
					<CriticalIconSmall />
				) : noticeLevel === NoticeLevel.WARNING ? (
					<WarningIconSmall />
				) : null}
			</div>
			<div className="segment-timeline__mini-inspector__notice">{noticeMessage}</div>
		</>
	)
}

function shouldShowFloatingInspectorContent(status: PieceStatusCode, content: VTContent | undefined): boolean {
	return status !== PieceStatusCode.SOURCE_NOT_SET && !!content?.fileName
}

const VideoPreviewPlayerInspector: React.FC<
	React.PropsWithChildren<{
		itemDuration: number
		loop: boolean
		seek: number
		previewUrl: string
		timePosition: number
		studioSettings: IStudioSettings | undefined
		floatingInspectorStyle: React.CSSProperties
	}>
> = ({ itemDuration, loop, seek, previewUrl, timePosition, studioSettings, floatingInspectorStyle, children }) => {
	return (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
			style={floatingInspectorStyle}
		>
			<VideoPreviewPlayer
				itemDuration={itemDuration}
				loop={loop}
				seek={seek}
				previewUrl={previewUrl}
				timePosition={timePosition}
				studioSettings={studioSettings}
			/>
			{children}
		</div>
	)
}

export const VTFloatingInspector: React.FC<IProps> = ({
	timePosition,
	content,
	renderedDuration,
	pieceId,
	studio,
	expectedPackages,
	contentMetaData,
	hideHoverscrubPreview,
	noticeLevel,
	noticeMessage,
	showMiniInspector,
	itemElement,
	displayOn,
	floatingInspectorStyle,
	typeClass,
	status,
}: IProps) => {
	const { t } = useTranslation()

	const itemDuration = content?.sourceDuration || renderedDuration || 0
	const seek = content?.seek ?? 0
	const loop = content?.loop ?? false

	const offsetTimePosition = timePosition + seek

	const previewUrl: string | undefined = getPreviewUrlForExpectedPackagesAndContentMetaData(
		pieceId,
		studio,
		studio?.settings.mediaPreviewsUrl,
		expectedPackages,
		contentMetaData
	)

	const showVideoPlayerInspector = !hideHoverscrubPreview && previewUrl
	const showMiniInspectorClipData = shouldShowFloatingInspectorContent(status, content)
	const showMiniInspectorNotice = noticeLevel !== null
	const showMiniInspectorData = showMiniInspectorNotice || showMiniInspectorClipData
	const showAnyFloatingInspector = showVideoPlayerInspector || showMiniInspectorData

	if (!showAnyFloatingInspector) {
		return null
	}

	const miniDataInspector = showMiniInspectorData && (
		<div
			className={classNames('segment-timeline__mini-inspector', typeClass, {
				'segment-timeline__mini-inspector--sub-inspector': showVideoPlayerInspector,
				'segment-timeline__mini-inspector--notice notice-critical': noticeLevel === NoticeLevel.CRITICAL,
				'segment-timeline__mini-inspector--notice notice-warning': noticeLevel === NoticeLevel.WARNING,
			})}
			style={!showVideoPlayerInspector ? floatingInspectorStyle : undefined}
		>
			{showMiniInspectorNotice && renderNotice(noticeLevel, noticeMessage)}
			{showMiniInspectorClipData && (
				<div className="segment-timeline__mini-inspector__properties">
					<span className="mini-inspector__label">{t('Clip:')}</span>
					<span className="mini-inspector__value">{content?.fileName}</span>
				</div>
			)}
		</div>
	)

	return (
		<FloatingInspector shown={showMiniInspector && itemElement !== undefined} displayOn={displayOn}>
			{showVideoPlayerInspector ? (
				<VideoPreviewPlayerInspector
					itemDuration={itemDuration}
					loop={loop}
					seek={seek}
					previewUrl={previewUrl}
					timePosition={offsetTimePosition}
					studioSettings={studio?.settings}
					floatingInspectorStyle={floatingInspectorStyle}
				>
					{miniDataInspector}
				</VideoPreviewPlayerInspector>
			) : (
				miniDataInspector
			)}
		</FloatingInspector>
	)
}
