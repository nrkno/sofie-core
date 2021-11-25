import React from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../../lib/rundown'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { IDefaultRendererProps } from './DefaultRenderer'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'

export function VTRenderer({ piece: pieceInstance, hovering, elementOffset, layer, studio }: IDefaultRendererProps) {
	const mediaPreviewUrl = studio?.settings.mediaPreviewsUrl

	const status = pieceInstance.instance.piece.status

	const vtContent = pieceInstance.instance.piece.content as VTContent

	const timePosition = ((hovering?.pageX ?? 0) - (elementOffset?.left ?? 0)) / (elementOffset?.width ?? 1)

	return (
		<>
			<VTFloatingInspector
				status={status || RundownAPI.PieceStatusCode.UNKNOWN}
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
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
				itemElement={null}
				contentMetaData={pieceInstance.contentMetaData || null}
				noticeMessage={pieceInstance.message || null}
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
