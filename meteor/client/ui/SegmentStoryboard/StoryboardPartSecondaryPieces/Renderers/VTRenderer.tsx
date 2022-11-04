import React from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { IDefaultRendererProps } from './DefaultRenderer'
import { getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'

export function VTRenderer({
	piece: pieceInstance,
	hovering,
	elementOffset,
	studio,
	typeClass,
}: IDefaultRendererProps) {
	const mediaPreviewUrl = studio?.settings.mediaPreviewsUrl

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
				floatingInspectorStyle={
					elementOffset
						? {
								top: elementOffset.top + 'px',
								left: elementOffset.left + 'px',
								transform: 'translate(0, -100%)',
						  }
						: {}
				}
				typeClass={typeClass}
				itemElement={null}
				contentMetaData={pieceInstance.contentMetaData || null}
				noticeMessages={pieceInstance.messages || null}
				noticeLevel={status !== null && status !== undefined ? getNoticeLevelForPieceStatus(status) : null}
				mediaPreviewUrl={mediaPreviewUrl}
				contentPackageInfos={pieceInstance.contentPackageInfos}
				pieceId={pieceInstance.instance.piece._id}
				expectedPackages={pieceInstance.instance.piece.expectedPackages}
				studio={studio}
			/>
			{pieceInstance.instance.piece.name}
		</>
	)
}
