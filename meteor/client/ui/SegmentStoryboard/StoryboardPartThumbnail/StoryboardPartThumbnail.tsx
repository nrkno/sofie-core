import React, { useEffect, useState } from 'react'
import { PartExtended, PieceExtended } from '../../../../lib/Rundown'
import StudioContext from '../../RundownView/StudioContext'
import { StoryboardPartThumbnailInner } from './StoryboardPartThumbnailInner'

interface IProps {
	part: PartExtended
}

function findMainPiece(pieces: PieceExtended[]) {
	const mainPiece = pieces
		.slice()
		.reverse()
		.find((piece) => {
			if (piece.outputLayer?.isPGM && piece.sourceLayer?.onPresenterScreen) {
				return true
			}
		})
	return mainPiece
}

export function StoryboardPartThumbnail({ part }: IProps) {
	const [mainPiece, setMainPiece] = useState<PieceExtended | undefined>(findMainPiece(part.pieces))

	useEffect(() => {
		const newMainPiece = findMainPiece(part.pieces)
		setMainPiece(newMainPiece)
	}, [part.pieces])

	return mainPiece ? (
		<StudioContext.Consumer>
			{(studio) => (
				<StoryboardPartThumbnailInner
					piece={mainPiece}
					isLiveLine={false}
					layer={mainPiece?.sourceLayer}
					studio={studio}
					partId={part.partId}
				/>
			)}
		</StudioContext.Consumer>
	) : null
}
