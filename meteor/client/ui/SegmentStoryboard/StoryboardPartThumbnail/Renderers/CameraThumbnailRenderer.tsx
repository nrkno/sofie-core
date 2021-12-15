import React from 'react'
import { CameraContent, RemoteContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faVideo } from '@fortawesome/free-solid-svg-icons'

export function CameraThumbnailRenderer({ pieceInstance }: IProps) {
	const cameraContent = pieceInstance.instance.piece.content as CameraContent | RemoteContent
	const isRM = pieceInstance.sourceLayer?.type === SourceLayerType.REMOTE
	return (
		<>
			<div className="segment-storyboard__thumbnail__icon">
				<FontAwesomeIcon icon={faVideo} />
			</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{isRM
					? pieceInstance.instance.piece.name
					: pieceInstance.sourceLayer?.abbreviation
					? `${pieceInstance.sourceLayer?.abbreviation}${cameraContent.studioLabel}`
					: pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
