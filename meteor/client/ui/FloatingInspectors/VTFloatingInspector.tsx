import React from 'react'
import { useTranslation } from 'react-i18next'

import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { FloatingInspector } from '../FloatingInspector'
import { NoticeLevel } from '../../lib/notifications/notifications'
import { ExpectedPackage, VTContent } from '@sofie-automation/blueprints-integration'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { ScanInfoForPackages } from '../../../lib/mediaObjects'
import { Studio } from '../../../lib/collections/Studios'
import { PieceId, PieceStatusCode } from '../../../lib/collections/Pieces'
import { getPreviewUrlForExpectedPackagesAndContentMetaData } from '../../lib/ui/clipPreview'
import { VideoPreviewPlayer } from '../../lib/VideoPreviewPlayer'

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

export const VTFloatingInspector: React.FunctionComponent<IProps> = (props: IProps) => {
	const { t } = useTranslation()
	const { timePosition } = props

	const itemDuration = (props.content ? props.content.sourceDuration : undefined) || props.renderedDuration || 0
	const seek = props.content?.seek ?? 0
	const loop = props.content?.loop ?? false

	const offsetTimePosition = timePosition + seek

	const previewUrl: string | undefined = getPreviewUrlForExpectedPackagesAndContentMetaData(
		props.pieceId,
		props.studio,
		props.studio?.settings.mediaPreviewsUrl,
		props.expectedPackages,
		props.contentMetaData
	)

	return (
		<FloatingInspector shown={props.showMiniInspector && props.itemElement !== undefined} displayOn={props.displayOn}>
			{previewUrl ? (
				!props.hideHoverscrubPreview || props.noticeLevel !== null ? (
					<div
						className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
						style={props.floatingInspectorStyle}
					>
						{!props.hideHoverscrubPreview ? (
							<VideoPreviewPlayer
								itemDuration={itemDuration}
								loop={loop}
								seek={seek}
								previewUrl={previewUrl}
								timePosition={offsetTimePosition}
								studioSettings={props.studio?.settings}
							/>
						) : null}
						{props.noticeLevel !== null ? (
							<div
								className={
									'segment-timeline__mini-inspector ' +
									(!props.hideHoverscrubPreview ? 'segment-timeline__mini-inspector--sub-inspector ' : '') +
									props.typeClass +
									' ' +
									(props.noticeLevel === NoticeLevel.CRITICAL
										? 'segment-timeline__mini-inspector--notice notice-critical'
										: props.noticeLevel === NoticeLevel.WARNING
										? 'segment-timeline__mini-inspector--notice notice-warning'
										: '')
								}
							>
								{renderNotice(props.noticeLevel, props.noticeMessage)}
							</div>
						) : null}
					</div>
				) : null
			) : (
				<div
					className={
						'segment-timeline__mini-inspector ' +
						props.typeClass +
						' ' +
						(props.noticeLevel === NoticeLevel.CRITICAL
							? 'segment-timeline__mini-inspector--notice notice-critical'
							: props.noticeLevel === NoticeLevel.WARNING
							? 'segment-timeline__mini-inspector--notice notice-warning'
							: '')
					}
					style={props.floatingInspectorStyle}
				>
					{props.noticeLevel !== null ? renderNotice(props.noticeLevel, props.noticeMessage) : null}
					{props.status !== PieceStatusCode.SOURCE_NOT_SET ? (
						<div className="segment-timeline__mini-inspector__properties">
							<span className="mini-inspector__label">{t('Clip:')}</span>
							<span className="mini-inspector__value">{props.content && props.content.fileName}</span>
						</div>
					) : null}
				</div>
			)}
		</FloatingInspector>
	)
}
