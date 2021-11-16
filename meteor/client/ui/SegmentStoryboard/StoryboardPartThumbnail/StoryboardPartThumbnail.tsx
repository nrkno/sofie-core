import classNames from 'classnames'
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
	const [highlight] = useState(false)

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
					highlight={highlight}
				/>
			)}
		</StudioContext.Consumer>
	) : (
		<div
			className={classNames('segment-storyboard__part__thumbnail segment-storyboard__part__thumbnail--placeholder', {
				'invert-flash': highlight,
			})}
		></div>
	)
}
