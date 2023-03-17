import React from 'react'
import { PieceExtended } from '../../../../lib/Rundown'

export function Piece({ piece }: { piece: PieceExtended }): JSX.Element | null {
	return <div className="camera-screen__piece">{piece.instance.piece.name}</div>
}
