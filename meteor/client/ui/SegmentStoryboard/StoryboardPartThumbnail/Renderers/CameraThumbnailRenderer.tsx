import React from 'react'
import { IProps } from './ThumbnailRendererFactory'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faVideo } from '@fortawesome/free-solid-svg-icons'

export function CameraThumbnailRenderer({ pieceInstance }: IProps) {
	return (
		<>
			<div className="segment-storyboard__thumbnail__icon">
				<FontAwesomeIcon icon={faVideo} />
			</div>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
