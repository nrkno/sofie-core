import React from 'react'
import { getSizeClassForLabel } from '../../utils/getLabelClass'
import { IProps } from './ThumbnailRendererFactory'

export function CameraThumbnailRenderer({ pieceInstance }: IProps): JSX.Element {
	return (
		<>
			<div
				className={`segment-storyboard__thumbnail__label ${getSizeClassForLabel(pieceInstance.instance.piece.name)}`}
			>
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
