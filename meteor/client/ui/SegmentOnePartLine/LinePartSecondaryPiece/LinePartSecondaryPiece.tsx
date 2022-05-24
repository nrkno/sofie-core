import classNames from 'classnames'
import React, { CSSProperties, useMemo } from 'react'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

interface IProps {
	piece: PieceExtended
	timelineBase: number
	partDuration: number
}

function timeInBase(time: number, partDuration: number, timelineBase: number): string {
	const pieceMaxDuration = Math.min(time, partDuration)
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
			width: timeInBase(piece.renderedDuration ?? partDuration, partDuration, timelineBase),
			left: timeInBase(piece.renderedInPoint ?? 0, partDuration, timelineBase),
		}
	}, [piece, partDuration, timelineBase])

	return (
		<div
			className={classNames('segment-opl__secondary-piece', typeClass)}
			style={pieceStyle}
			data-duraton={piece.renderedDuration}
			data-obj-id={piece.instance._id}
			data-label={piece.instance.piece.name}
		></div>
	)
}
