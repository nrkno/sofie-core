import React, { MutableRefObject, useRef } from 'react'
import { TFunction, useTranslation } from 'react-i18next'

import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { FloatingInspector } from '../FloatingInspector'
import { NoticeLevel } from '../../../lib/notifications/notifications'
import { VTContent } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import { ITranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { IFloatingInspectorPosition, useInspectorPosition } from './IFloatingInspectorPosition'
import { ReadonlyDeep } from 'type-fest'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'

interface IProps {
	status: PieceStatusCode | undefined
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	position: IFloatingInspectorPosition
	content: VTContent | undefined
	noticeLevel: NoticeLevel | null
	noticeMessages: ReadonlyDeep<ITranslatableMessage[]> | null

	displayOn?: 'document' | 'viewport'

	hideThumbnail?: boolean
	thumbnailUrl: string | undefined
}

function renderNotice(
	t: TFunction,
	noticeLevel: NoticeLevel,
	noticeMessages: ReadonlyDeep<ITranslatableMessage[]> | null
): JSX.Element {
	const messagesStr = noticeMessages ? noticeMessages.map((msg) => translateMessage(msg, t)).join('; ') : ''
	return (
		<>
			<div className="segment-timeline__mini-inspector__notice-header">
				{noticeLevel === NoticeLevel.CRITICAL ? (
					<CriticalIconSmall />
				) : noticeLevel === NoticeLevel.WARNING ? (
					<WarningIconSmall />
				) : null}
			</div>
			<div className="segment-timeline__mini-inspector__notice">{messagesStr}</div>
		</>
	)
}

function shouldShowFloatingInspectorContent(status: PieceStatusCode, content: VTContent | undefined): boolean {
	return status !== PieceStatusCode.SOURCE_NOT_SET && !!content?.fileName
}

const AudioThumbnailInspector = React.forwardRef<
	HTMLDivElement,
	React.PropsWithChildren<{
		thumbnailUrl: string
		floatingInspectorStyle: React.CSSProperties
	}>
>(function AudioThumbnailInspector({ thumbnailUrl, floatingInspectorStyle, children }, ref) {
	return (
		<div
			className="segment-timeline__mini-inspector segment-timeline__mini-inspector--audio"
			style={floatingInspectorStyle}
			ref={ref as MutableRefObject<HTMLDivElement>}
		>
			<img src={thumbnailUrl} />
			{children}
		</div>
	)
})

export const AudioFloatingInspector: React.FC<IProps> = ({
	content,
	hideThumbnail,
	noticeLevel,
	noticeMessages,
	showMiniInspector,
	itemElement,
	position,
	typeClass,
	status,
	thumbnailUrl,
}: IProps) => {
	const { t } = useTranslation()
	const inspectorRef = useRef<HTMLDivElement>(null)

	const showAudioThumbnailInspector = !hideThumbnail && thumbnailUrl
	const showMiniInspectorClipData = shouldShowFloatingInspectorContent(status ?? PieceStatusCode.UNKNOWN, content)
	const showMiniInspectorNotice = noticeLevel !== null
	const showMiniInspectorData = showMiniInspectorNotice || showMiniInspectorClipData
	const showAnyFloatingInspector = Boolean(showAudioThumbnailInspector) || showMiniInspectorData

	const shown = showMiniInspector && itemElement !== undefined && showAnyFloatingInspector

	const { style: floatingInspectorStyle, isFlipped } = useInspectorPosition(position, inspectorRef, shown)

	if (!showAnyFloatingInspector || !floatingInspectorStyle) {
		return null
	}

	const miniDataInspector = showMiniInspectorData && (
		<div
			className={classNames('segment-timeline__mini-inspector', typeClass, {
				'segment-timeline__mini-inspector--sub-inspector': showAudioThumbnailInspector,
				'segment-timeline__mini-inspector--sub-inspector-flipped': showAudioThumbnailInspector && isFlipped,
				'segment-timeline__mini-inspector--notice notice-critical': noticeLevel === NoticeLevel.CRITICAL,
				'segment-timeline__mini-inspector--notice notice-warning': noticeLevel === NoticeLevel.WARNING,
			})}
			style={!showAudioThumbnailInspector ? floatingInspectorStyle : undefined}
			ref={!showAudioThumbnailInspector ? inspectorRef : undefined}
		>
			{showMiniInspectorNotice && noticeLevel && renderNotice(t, noticeLevel, noticeMessages)}
			{showMiniInspectorClipData && (
				<div className="segment-timeline__mini-inspector__properties">
					<span className="mini-inspector__value">{content?.fileName}</span>
				</div>
			)}
		</div>
	)

	return (
		<FloatingInspector shown={shown} displayOn="viewport">
			{showAudioThumbnailInspector ? (
				<AudioThumbnailInspector
					ref={inspectorRef}
					thumbnailUrl={thumbnailUrl}
					floatingInspectorStyle={floatingInspectorStyle}
				>
					{miniDataInspector}
				</AudioThumbnailInspector>
			) : (
				miniDataInspector
			)}
		</FloatingInspector>
	)
}
