import React, { useContext } from 'react'
import { PieceFilter } from '.'
import { PartUi } from '../../SegmentContainer/withResolvedSegment'
import { Piece } from './Piece'

export function Part({ part }: { part: PartUi }): JSX.Element | null {
	const selectPiece = useContext(PieceFilter)

	const piece = part.pieces.find(selectPiece)

	return <div className="camera-screen__part">{piece && <Piece piece={piece} />}</div>
}
