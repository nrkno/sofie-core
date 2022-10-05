import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import React, { useEffect, useState } from 'react'
import { PartExtended, PieceExtended } from '../../../../lib/Rundown'
import { findPieceExtendedToShowFromOrderedResolvedInstances } from '../../PieceIcons/utils'
import StudioContext from '../../RundownView/StudioContext'
import { StoryboardPartThumbnailInner } from './StoryboardPartThumbnailInner'

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

export const StoryboardPartThumbnail = React.memo(function StoryboardPartThumbnail({
	part,
	isLive,
	isNext,
	isFinished,
}: IProps) {
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
					isLive={isLive}
					isNext={isNext}
					isFinished={isFinished}
					layer={mainPiece?.sourceLayer}
					studio={studio}
					partId={part.partId}
					partInstanceId={part.instance._id}
					highlight={highlight}
					partAutoNext={part.instance.part.autoNext || false}
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
})
