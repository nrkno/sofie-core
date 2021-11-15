import React from 'react'
import { EvsContent } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhotoVideo } from '@fortawesome/free-solid-svg-icons'

export function CameraThumbnailRenderer({ pieceInstance }: IProps) {
	const localContent = pieceInstance.instance.piece.content as EvsContent
	return (
		<>
			<div className="segment-storyboard__thumbnail__icon">
				<FontAwesomeIcon icon={faPhotoVideo} />
			</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{localContent.studioLabel
					? `${pieceInstance.sourceLayer?.abbreviation}${localContent.studioLabel}` || pieceInstance.instance.piece.name
					: pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
