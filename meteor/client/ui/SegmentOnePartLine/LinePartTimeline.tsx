import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useMemo } from 'react'
import { PartExtended, PieceExtended } from '../../../lib/Rundown'
import { findPieceExtendedToShowFromOrderedResolvedInstances } from '../PieceIcons/utils'
import { LinePartMainPiece } from './LinePartMainPiece/LinePartMainPiece'
import { OnAirLine } from './OnAirLine'
import { TakeLine } from './TakeLine'
import { LinePartTransitionPiece } from './LinePartTransitionPiece/LinePartTransitionPiece'

const TIMELINE_DEFAULT_BASE = 30 * 1000

interface IProps {
	part: PartExtended
	isLive: boolean
	isNext: boolean
	isFinished: boolean
	currentPartWillAutonext: boolean
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

function findTransitionPiece(pieces: PieceExtended[]) {
	return pieces
		.slice()
		.reverse()
		.find((piece) => {
			console.log(piece)
			if (piece.sourceLayer?.type === SourceLayerType.TRANSITION) {
				return true
			}
		})
}

export const LinePartTimeline: React.FC<IProps> = function LinePartTimeline({
	part,
	isLive,
	isNext,
	currentPartWillAutonext,
}) {
	// const [highlight] = useState(false)

	const mainPiece = useMemo(() => findMainPiece(part.pieces), [part.pieces])
	const transitionPiece = useMemo(() => findTransitionPiece(part.pieces), [part.pieces])

	const timelineBase = Math.max(
		TIMELINE_DEFAULT_BASE,
		mainPiece?.instance.piece.content.sourceDuration ?? 0,
		part.renderedDuration
	)

	const autoNext = isNext ? currentPartWillAutonext : part.willProbablyAutoNext

	return (
		<div className="segment-opl__part-timeline " data-base={timelineBase / 1000}>
			{transitionPiece && <LinePartTransitionPiece piece={transitionPiece} />}
			{mainPiece && (
				<LinePartMainPiece piece={mainPiece} timelineBase={timelineBase} partDuration={part.renderedDuration} />
			)}
			{!isLive && <TakeLine isNext={isNext} autoNext={autoNext} />}
			{isLive && <OnAirLine partInstance={part.instance} timelineBase={timelineBase} />}
		</div>
	)
}
