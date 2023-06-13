import React from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { IDefaultRendererProps } from './DefaultRenderer'
import { getNoticeLevelForPieceStatus } from '../../../../../lib/notifications/notifications'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'

export function VTRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	studio,
	typeClass,
}: IDefaultRendererProps): JSX.Element {
	const status = pieceInstance.instance.piece.status

	const vtContent = pieceInstance.instance.piece.content as VTContent

	const timePosition = ((hovering?.pageX ?? 0) - (elementOffset?.left ?? 0)) / (elementOffset?.width ?? 1)

	return (
		<>
			<VTFloatingInspector
				status={status || PieceStatusCode.UNKNOWN}
				showMiniInspector={!!hovering}
				timePosition={timePosition}
				content={vtContent}
				position={{
					top: elementOffset?.top ?? 0,
					left: elementOffset?.left ?? 0,
					anchor: 'start',
					position: 'top-start',
				}}
				typeClass={typeClass}
				itemElement={null}
				noticeMessages={pieceInstance.messages || null}
				noticeLevel={status !== null && status !== undefined ? getNoticeLevelForPieceStatus(status) : null}
				studio={studio}
				previewUrl={pieceInstance.previewUrl}
			/>
			{pieceInstance.instance.piece.name}
		</>
	)
}
