import React from 'react'
import { IProps } from './ThumbnailRendererFactory'

export function DefaultThumbnailRenderer({ pieceInstance }: IProps): JSX.Element {
	return <>{pieceInstance.instance.piece.name}</>
}
