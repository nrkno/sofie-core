import React from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { getNoticeLevelForPieceStatus } from '../../../../../lib/notifications/notifications'
import { RundownUtils } from '../../../../lib/rundown'
import { IProps } from './ThumbnailRendererFactory'
import { PieceStatusIcon } from '../../../../lib/ui/PieceStatusIcon'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AudioFloatingInspector } from '../../../FloatingInspectors/AudioFloatingInspector'

export function AudioThumbnailRenderer({
	pieceInstance,
	hovering,
	originPosition,
	layer,
	height,
}: IProps): JSX.Element {
	const status = pieceInstance.contentStatus?.status
	const vtContent = pieceInstance.instance.piece.content as VTContent
	const thumbnailUrl: string | undefined = pieceInstance.contentStatus?.thumbnailUrl
	const noticeLevel = getNoticeLevelForPieceStatus(status)

	return (
		<>
			<AudioFloatingInspector
				status={status || PieceStatusCode.UNKNOWN}
				showMiniInspector={hovering}
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
				thumbnailUrl={thumbnailUrl}
			/>
			<div className="segment-storyboard__thumbnail__label">
				{noticeLevel !== null && <PieceStatusIcon noticeLevel={noticeLevel} />}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
