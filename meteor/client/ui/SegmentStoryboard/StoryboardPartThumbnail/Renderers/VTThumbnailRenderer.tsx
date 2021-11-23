import React from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { VTFloatingInspector } from '../../../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../../../lib/notifications/notifications'
import { RundownUtils } from '../../../../lib/rundown'
import { IProps } from './ThumbnailRendererFactory'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFilm, faSlash } from '@fortawesome/free-solid-svg-icons'

export function VTThumbnailRenderer({
	pieceInstance,
	hovering,
	hoverScrubTimePosition,
	originPosition,
	...props
}: IProps) {
	const mediaPreviewUrl = props.studio.settings.mediaPreviewsUrl

	const status = pieceInstance.instance.piece.status

	const vtContent = pieceInstance.instance.piece.content as VTContent

	return (
		<>
			<VTFloatingInspector
				status={status || RundownAPI.PieceStatusCode.UNKNOWN}
				showMiniInspector={hovering}
				timePosition={hoverScrubTimePosition}
				content={vtContent}
				floatingInspectorStyle={{
					top: originPosition.top + 'px',
					left: originPosition.left + 'px',
					transform: 'translate(0, -100%)',
				}}
				typeClass={props.layer && RundownUtils.getSourceLayerClassName(props.layer.type)}
				itemElement={null}
				contentMetaData={pieceInstance.contentMetaData || null}
				noticeMessage={pieceInstance.message || null}
				noticeLevel={status !== null && status !== undefined ? getNoticeLevelForPieceStatus(status) : null}
				mediaPreviewUrl={mediaPreviewUrl}
				contentPackageInfos={pieceInstance.contentPackageInfos}
				pieceId={pieceInstance.instance.piece._id}
				expectedPackages={pieceInstance.instance.piece.expectedPackages}
				studio={props.studio}
			/>
			<div className="segment-storyboard__thumbnail__image-container">
				<div className="segment-storyboard__thumbnail__icon">
					<span className="fa-layers fa-fw">
						<FontAwesomeIcon icon={faFilm} />
						<FontAwesomeIcon icon={faSlash} />
					</span>
				</div>
			</div>
			<div className="segment-storyboard__thumbnail__label">{pieceInstance.instance.piece.name}</div>
		</>
	)
}
