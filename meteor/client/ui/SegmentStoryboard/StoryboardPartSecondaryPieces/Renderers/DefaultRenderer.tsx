import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { PartId } from '../../../../../lib/collections/Parts'
import { Studio } from '../../../../../lib/collections/Studios'
import { PieceUi } from '../../../SegmentContainer/withResolvedSegment'

export interface IDefaultRendererProps {
	layer: ISourceLayer
	piece: PieceUi
	partId: PartId
	isLiveLine: boolean
	studio: Studio | undefined
	typeClass: string
	hovering: { pageX: number; pageY: number } | null
	elementOffset:
		| {
				left: number
				top: number
				width: number
		  }
		| undefined
}

export function DefaultRenderer({ piece }: IDefaultRendererProps) {
	return <>{piece.instance.piece.name}</>
}
