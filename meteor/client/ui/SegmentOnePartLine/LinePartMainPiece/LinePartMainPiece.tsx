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
	const pieceMaxDuration = Math.max(
		piece.renderedDuration ?? partDuration,
		piece.instance.piece.content.sourceDuration ?? 0
	)
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return `${size * 100}%`
}

export const LinePartMainPiece: React.FC<IProps> = function LinePartMainPiece({ piece, partDuration, timelineBase }) {
	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const pieceStyle = useMemo<CSSProperties>(() => {
		return {
			width: widthInBase(piece, partDuration, timelineBase),
		}
	}, [piece, partDuration, timelineBase])

	return (
		<div className={classNames('segment-opl__main-piece', typeClass)} style={pieceStyle}>
			<div className="segment-opl__main-piece__label">{piece.instance.piece.name}</div>
		</div>
	)
}
