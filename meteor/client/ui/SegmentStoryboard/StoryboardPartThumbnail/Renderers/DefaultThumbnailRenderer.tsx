import React from 'react'
import { IProps } from './ThumbnailRendererFactory'

export function DefaultThumbnailRenderer({ pieceInstance }: IProps) {
	return <>{pieceInstance.instance.piece.name}</>
}
