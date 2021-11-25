import React from 'react'
import classNames from 'classnames'
import { ISourceLayer, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'
import { PartId } from '../../../../lib/collections/Parts'
import { RundownAPI } from '../../../../lib/api/rundown'

interface IProps {
	className: string
	partId: PartId
	layer: ISourceLayer | undefined
	piece: PieceExtended
	highlight?: boolean

	onPointerEnter?: React.PointerEventHandler<HTMLDivElement> | undefined
	onPointerLeave?: React.PointerEventHandler<HTMLDivElement> | undefined
	onPointerMove?: React.PointerEventHandler<HTMLDivElement> | undefined
}

export const PieceElement = React.forwardRef<HTMLDivElement, React.PropsWithChildren<IProps>>(function PieceElement(
	{
		className,
		partId,
		layer,
		piece,
		highlight,
		children,
		onPointerEnter,
		onPointerLeave,
		onPointerMove,
	}: React.PropsWithChildren<IProps>,
	ref
) {
	const typeClass = layer?.type ? RundownUtils.getSourceLayerClassName(layer?.type) : ''

	const innerPiece = piece.instance.piece

	return (
		<div
			className={classNames(className, typeClass, {
				'super-infinite':
					innerPiece.lifespan !== PieceLifespan.WithinPart &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd,
				'infinite-starts':
					innerPiece.lifespan !== PieceLifespan.WithinPart &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd &&
					piece.instance.piece.startPartId === partId,

				'not-in-vision': piece.instance.piece.notInVision,

				'source-missing':
					innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING ||
					innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_NOT_SET,
				'source-broken': innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
				'unknown-state': innerPiece.status === RundownAPI.PieceStatusCode.UNKNOWN,
				disabled: piece.instance.disabled,

				'invert-flash': highlight,
			})}
			data-obj-id={piece.instance._id}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
			ref={ref}
		>
			{children}
		</div>
	)
})
