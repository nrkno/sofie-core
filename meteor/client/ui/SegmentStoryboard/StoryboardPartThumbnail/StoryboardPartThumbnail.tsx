import React, { useEffect, useState } from 'react'
import { PartExtended, PieceExtended } from '../../../../lib/Rundown'

interface IProps {
	part: PartExtended
}

function findMainPiece(pieces: PieceExtended[]) {
	const mainPiece = pieces.reverse().find((piece) => {
		if (piece.outputLayer?.isPGM && piece.sourceLayer?.onPresenterScreen) {
			return piece
		}
	})
	return mainPiece
}

export function StoryboardPartThumbnail({ part }: IProps) {
	const [mainPiece, setMainPiece] = useState<PieceExtended | undefined>(findMainPiece(part.pieces))

	useEffect(() => {
		const mainPiece = findMainPiece(part.pieces)
		setMainPiece(mainPiece)
	}, [part.pieces])

	return (
		<>
			{mainPiece?.instance.piece.name} ({mainPiece?.sourceLayer?.abbreviation || mainPiece?.sourceLayer?.name})
		</>
	)
}
