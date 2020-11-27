import React, { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { FloatingInspector } from '../FloatingInspector'
import { formatDurationAsTimecode } from '../../../lib/lib'
import { NoticeLevel } from '../../lib/notifications/notifications'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { MediaObject } from '../../../lib/collections/MediaObjects'

interface IProps {
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
}

function getPreviewUrl(contentMetaData: MediaObject | null, mediaPreviewUrl: string | undefined): string | undefined {
	const metadata = contentMetaData
	if (metadata && metadata.previewPath && mediaPreviewUrl) {
		return mediaPreviewUrl + 'media/preview/' + encodeURIComponent(metadata.mediaId)
	}
}

function setVideoElementPosition(
	vEl: HTMLVideoElement,
	timePosition: number,
	itemDuration: number,
	seek: number,
	loop: boolean
) {
	let targetTime = timePosition + seek
	if (loop && vEl.duration > 0) {
		targetTime =
			targetTime % ((itemDuration > 0 ? Math.min(vEl.duration * 1000, itemDuration) : vEl.duration * 1000) * 1000)
	} else {
		targetTime = Math.min(timePosition, itemDuration)
	}
	vEl.currentTime = targetTime / 1000
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

	const videoElement = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		if (videoElement.current) {
			const itemDuration = (props.content ? props.content.sourceDuration : undefined) || props.renderedDuration || 0
			const seek = (props.content ? props.content.seek : 0) || 0
			const loop = (props.content ? props.content.loop : false) || false
			setVideoElementPosition(videoElement.current, props.timePosition, itemDuration, seek, loop)
		}
	})

	const offsetTimePosition = props.timePosition + (props.content ? props.content.seek || 0 : 0)

	return (
		<FloatingInspector shown={props.showMiniInspector && props.itemElement !== undefined}>
			{getPreviewUrl(props.contentMetaData, props.mediaPreviewUrl) ? (
				<div
					className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
					style={props.floatingInspectorStyle}>
					<video
						src={getPreviewUrl(props.contentMetaData, props.mediaPreviewUrl)}
						ref={videoElement}
						crossOrigin="anonymous"
						playsInline={true}
						muted={true}
					/>
					<span className="segment-timeline__mini-inspector__timecode">
						{formatDurationAsTimecode(offsetTimePosition)}
					</span>
					{props.noticeLevel !== null ? (
						<div
							className={
								'segment-timeline__mini-inspector segment-timeline__mini-inspector--sub-inspector ' +
								props.typeClass +
								' ' +
								(props.noticeLevel === NoticeLevel.CRITICAL
									? 'segment-timeline__mini-inspector--notice notice-critical'
									: props.noticeLevel === NoticeLevel.WARNING
									? 'segment-timeline__mini-inspector--notice notice-warning'
									: '')
							}>
							{renderNotice(props.noticeLevel, props.noticeMessage)}
						</div>
					) : null}
				</div>
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
					style={props.floatingInspectorStyle}>
					{props.noticeLevel !== null ? renderNotice(props.noticeLevel, props.noticeMessage) : null}
					<div className="segment-timeline__mini-inspector__properties">
						<span className="mini-inspector__label">{t('File name')}</span>
						<span className="mini-inspector__value">{props.content && props.content.fileName}</span>
					</div>
				</div>
			)}
		</FloatingInspector>
	)
}
