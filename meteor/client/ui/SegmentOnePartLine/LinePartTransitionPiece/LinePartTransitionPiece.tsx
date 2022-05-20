import React from 'react'
import { PieceExtended } from '../../../../lib/Rundown'

interface IProps {
	piece: PieceExtended
}

export const LinePartTransitionPiece: React.FC<IProps> = function LinePartTransitionPiece({ piece }) {
	return <div className="segment-opl__transition-piece">{piece.instance.piece.name}</div>
}
