import classNames from 'classnames'
import React, { useEffect, useState } from 'react'
import { PartExtended, PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

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

	const typeClass = mainPiece?.sourceLayer?.type
		? RundownUtils.getSourceLayerClassName(mainPiece?.sourceLayer?.type)
		: ''

	return (
		<div className={classNames('segment-storyboard__part__thumbnail', typeClass)}>
			{mainPiece?.instance.piece.name} ({mainPiece?.sourceLayer?.abbreviation || mainPiece?.sourceLayer?.name})
		</div>
	)
}
