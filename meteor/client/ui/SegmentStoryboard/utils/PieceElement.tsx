import React from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceExtended } from '../../../../lib/Rundown'
import { PartId } from '../../../../lib/collections/Parts'
import { pieceUiClassNames } from '../../../lib/ui/pieceUiClassNames'

interface IProps {
	className: string
	partId: PartId
	layer: ISourceLayer | undefined
	piece: PieceExtended
	style?: React.CSSProperties
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
		style,
		children,
		onPointerEnter,
		onPointerLeave,
		onPointerMove,
	}: React.PropsWithChildren<IProps>,
	ref
) {
	return (
		<div
			className={pieceUiClassNames(piece, className, layer?.type, partId, highlight, true)}
			data-obj-id={piece.instance._id}
			onPointerEnter={onPointerEnter}
			onPointerLeave={onPointerLeave}
			onPointerMove={onPointerMove}
			ref={ref}
			style={style}
			data-rendered-in={piece.renderedInPoint}
			data-rendered-duration={piece.renderedDuration}
		>
			{children}
		</div>
	)
})
