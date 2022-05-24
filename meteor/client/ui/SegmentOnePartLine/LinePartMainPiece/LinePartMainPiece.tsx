import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import React, { CSSProperties, useMemo } from 'react'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'
// TODO: Move to a shared lib file
import { getSplitItems } from '../../SegmentStoryboard/utils/getSplitItems'

interface IProps {
	piece: PieceExtended
	timelineBase: number
	partDuration: number
	capToPartDuration: boolean
}

function widthInBase(
	piece: PieceExtended,
	partDuration: number,
	timelineBase: number,
	capToPartDuration: boolean
): string {
	const pieceMaxDuration = capToPartDuration
		? // capToPartDuration is something that can be used when the part is Auto and there is no chance of the Piece
		  // being extended
		  Math.min(piece.renderedDuration ?? partDuration, partDuration)
		: Math.max(
				// renderedDuration can be null. If there is a sourceDuration, use that, if not, use timelineBase
				piece.renderedDuration ?? (piece.instance.piece.content.sourceDuration ? 0 : timelineBase),
				piece.instance.piece.content.sourceDuration ?? 0
		  )
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return `${size * 100}%`
}

export const LinePartMainPiece: React.FC<IProps> = function LinePartMainPiece({
	piece,
	partDuration,
	timelineBase,
	capToPartDuration,
}) {
	const typeClass = piece.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const pieceStyle = useMemo<CSSProperties>(() => {
		return {
			// TODO: handle piece.enable.start
			width: widthInBase(piece, partDuration, timelineBase, capToPartDuration),
		}
	}, [piece, partDuration, timelineBase, capToPartDuration])

	return (
		<div
			className={classNames('segment-opl__main-piece', typeClass)}
			style={pieceStyle}
			data-obj-id={piece.instance._id}
		>
			{piece.sourceLayer?.type === SourceLayerType.SPLITS && (
				<div className="segment-opl__main-piece__bkg">{getSplitItems(piece, 'segment-opl__main-piece__item')}</div>
			)}
			<div className="segment-opl__main-piece__label">{piece.instance.piece.name}</div>
		</div>
	)
}
