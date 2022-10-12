import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { UIStudio } from '../../../../../lib/api/studios'
import { PartId } from '../../../../../lib/collections/Parts'
import { PieceUi } from '../../../SegmentContainer/withResolvedSegment'

export interface IDefaultRendererProps {
	layer: ISourceLayer
	piece: PieceUi
	partId: PartId
	isLiveLine: boolean
	studio: UIStudio | undefined
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
