import classNames from 'classnames'
import React, { CSSProperties, useMemo } from 'react'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

interface IProps {
	piece: PieceExtended
	timelineBase: number
	partDuration: number
}

function widthInBase(piece: PieceExtended, partDuration: number, timelineBase: number): string {
	const pieceMaxDuration = Math.min(piece.renderedDuration ?? partDuration, partDuration)
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return `${size * 100}%`
}

export const LinePartSecondaryPiece: React.FC<IProps> = function LinePartSecondaryPiece({
	piece,
	partDuration,
	timelineBase,
}) {
	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const pieceStyle = useMemo<CSSProperties>(() => {
		return {
			width: widthInBase(piece, partDuration, timelineBase),
			left: widthInBase(piece, partDuration, timelineBase),
		}
	}, [piece, partDuration, timelineBase])

	return (
		<div
			className={classNames('segment-opl__secondary-piece', typeClass)}
			style={pieceStyle}
			data-duraton={piece.renderedDuration}
			data-obj-id={piece.instance._id}
		></div>
	)
}
