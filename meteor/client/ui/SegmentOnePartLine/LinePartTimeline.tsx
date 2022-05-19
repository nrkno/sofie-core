import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useEffect, useState } from 'react'
import { PartExtended, PieceExtended } from '../../../lib/Rundown'
import { findPieceExtendedToShowFromOrderedResolvedInstances } from '../PieceIcons/utils'

interface IProps {
	part: PartExtended
	isLive: boolean
	isNext: boolean
	isFinished: boolean
}

const supportedSourceLayerTypes = new Set(
	Object.values(SourceLayerType).filter(
		// Support all types, apart from TRANSITION and also filter out the inverse-enum strings
		(val) => typeof val !== 'string' && val !== SourceLayerType.TRANSITION
	) as SourceLayerType[]
)

function findMainPiece(pieces: PieceExtended[]) {
	return findPieceExtendedToShowFromOrderedResolvedInstances(
		pieces.filter((piece) => piece.outputLayer?.isPGM),
		supportedSourceLayerTypes
	)
}

export const LinePartTimeline: React.FC<IProps> = function LinePartTimeline({ part }) {
	const [mainPiece, setMainPiece] = useState<PieceExtended | undefined>(findMainPiece(part.pieces))
	// const [highlight] = useState(false)

	useEffect(() => {
		const newMainPiece = findMainPiece(part.pieces)
		setMainPiece(newMainPiece)
	}, [part.pieces])

	return <div className="segment-opl__part-timeline">{mainPiece?.instance.piece.name}</div>
}
