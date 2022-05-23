import { PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useMemo } from 'react'
import { PartExtended, PieceExtended } from '../../../lib/Rundown'
import { findPieceExtendedToShowFromOrderedResolvedInstances } from '../PieceIcons/utils'
import { LinePartMainPiece } from './LinePartMainPiece/LinePartMainPiece'
import { OnAirLine } from './OnAirLine'
import { TakeLine } from './TakeLine'
import { LinePartTransitionPiece } from './LinePartTransitionPiece/LinePartTransitionPiece'
import { LinePartSecondaryPiece } from './LinePartSecondaryPiece/LinePartSecondaryPiece'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

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
			if (piece.sourceLayer?.type === SourceLayerType.TRANSITION) {
				return true
			}
		})
}

function findTimedGraphics(pieces: PieceExtended[]) {
	return pieces
		.slice()
		.reverse()
		.filter((piece) => {
			if (
				piece.sourceLayer?.type === SourceLayerType.LOWER_THIRD &&
				!piece.sourceLayer?.isHidden &&
				piece.instance.piece.lifespan === PieceLifespan.WithinPart &&
				piece.instance.piece.enable.duration
			) {
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
	const timedGraphics = useMemo(() => findTimedGraphics(part.pieces), [part.pieces])

	const partDuration = part.renderedDuration
	const mainPieceSourceDuration = mainPiece?.instance.piece.content.sourceDuration
	const mainPieceInPoint = mainPiece?.renderedInPoint
	const maxDuration = Math.max((mainPieceInPoint ?? 0) + (mainPieceSourceDuration ?? 0), partDuration)
	const timelineBase = Math.max(TIMELINE_DEFAULT_BASE, maxDuration)

	const autoNext = isNext ? currentPartWillAutonext : part.willProbablyAutoNext

	return (
		<div className="segment-opl__part-timeline" data-base={timelineBase / 1000}>
			{timedGraphics.map((piece) => (
				<LinePartSecondaryPiece
					key={unprotectString(piece.instance._id)}
					piece={piece}
					timelineBase={timelineBase}
					partDuration={partDuration}
				/>
			))}
			{mainPiece && (
				<LinePartMainPiece
					piece={mainPiece}
					timelineBase={timelineBase}
					partDuration={partDuration}
					capToPartDuration={part.instance.part.autoNext ?? false}
				/>
			)}
			{!isLive && <TakeLine isNext={isNext} autoNext={autoNext} />}
			{transitionPiece && <LinePartTransitionPiece piece={transitionPiece} />}
			{isLive && <OnAirLine partInstance={part.instance} timelineBase={timelineBase} maxDuration={maxDuration} />}
		</div>
	)
}
