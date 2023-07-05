import React from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { IDefaultRendererProps } from './DefaultRenderer'
import { getNoticeLevelForPieceStatus } from '../../../../../lib/notifications/notifications'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AudioFloatingInspector } from '../../../FloatingInspectors/AudioFloatingInspector'

export function AudioRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	typeClass,
}: IDefaultRendererProps): JSX.Element {
	const status = pieceInstance.contentStatus?.status

	const vtContent = pieceInstance.instance.piece.content as VTContent

	return (
		<>
			<AudioFloatingInspector
				status={status || PieceStatusCode.UNKNOWN}
				showMiniInspector={!!hovering}
				content={vtContent}
				position={{
					top: elementOffset?.top ?? 0,
					left: elementOffset?.left ?? 0,
					anchor: 'start',
					position: 'top-start',
				}}
				typeClass={typeClass}
				itemElement={null}
				noticeMessages={pieceInstance.contentStatus?.messages || null}
				noticeLevel={getNoticeLevelForPieceStatus(status)}
				thumbnailUrl={pieceInstance.contentStatus?.thumbnailUrl}
			/>
			{pieceInstance.instance.piece.name}
		</>
	)
}
