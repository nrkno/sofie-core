import React from 'react'
import { IProps } from './ThumbnailRendererFactory'

export function CameraThumbnailRenderer({ pieceInstance }: IProps) {
	return (
		<>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
