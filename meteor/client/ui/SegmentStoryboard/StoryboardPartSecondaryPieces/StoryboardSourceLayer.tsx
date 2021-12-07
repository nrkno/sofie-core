import React, { useMemo } from 'react'
import classNames from 'classnames'
import * as VelocityReact from 'velocity-react'
import { ISourceLayerExtended, PartExtended, PieceExtended } from '../../../../lib/Rundown'
import StudioContext from '../../RundownView/StudioContext'
import { StoryboardSecondaryPiece } from './StoryboardSecondaryPiece'
import { PieceInstanceId } from '../../../../lib/collections/PieceInstances'
import { getCurrentTime } from '../../../../lib/lib'
import { useInvalidateTimeout } from '../../../lib/lib'

interface IProps {
	sourceLayer: ISourceLayerExtended
	pieces: PieceExtended[]
	part: PartExtended
}

// needs to match .segment-storyboard__part__source-layer--multiple-piece > .segment-storyboard__part__piece width CSS property
const MULTIPLE_PIECES_PIECE_WIDTH = 0.8

/**
 * Calculate which pieces should now be playing and which have already stopped playing. Return the IDs of the playing
 * and finished PieceInstances.
 *
 * @param {(number | undefined)} partInstanceStartedPlayback
 * @param {(number | undefined)} partInstanceStoppedPlayback
 * @param {PieceExtended[]} piecesOnLayer
 * @return {*}
 */
function usePlayedOutPieceState(
	partInstanceStartedPlayback: number | undefined,
	partInstanceStoppedPlayback: number | undefined,
	piecesOnLayer: PieceExtended[]
) {
	return useInvalidateTimeout(
		() => {
			if (partInstanceStartedPlayback === undefined) {
				return [EMPTY_PLAYED_PIECE_IDS, ONCE_A_MINUTE + Math.random() * 1000]
			}

			const playedPieceIds: PieceInstanceId[] = []
			const finishedPieceIds: PieceInstanceId[] = []

			const startedPlayback = partInstanceStartedPlayback
			const stoppedPlayback = partInstanceStoppedPlayback ?? Number.POSITIVE_INFINITY
			let closestAbsoluteNext = Number.POSITIVE_INFINITY

			piecesOnLayer.forEach((piece) => {
				if (piece.renderedInPoint === null) return
				const absoluteRenderedInPoint = startedPlayback + piece.renderedInPoint
				if (absoluteRenderedInPoint < getCurrentTime() && absoluteRenderedInPoint < stoppedPlayback) {
					playedPieceIds.push(piece.instance._id)
				} else {
					if (absoluteRenderedInPoint < closestAbsoluteNext) {
						closestAbsoluteNext = absoluteRenderedInPoint
					}
				}
				if (piece.renderedDuration === null) return
				if (
					absoluteRenderedInPoint + piece.renderedDuration < getCurrentTime() &&
					absoluteRenderedInPoint + piece.renderedDuration < stoppedPlayback
				) {
					finishedPieceIds.push(piece.instance._id)
				}
			})

			return [
				{
					playedPieceIds,
					finishedPieceIds,
				},
				Number.isFinite(closestAbsoluteNext)
					? // the next closest change is in that time, so let's wait until then
					  closestAbsoluteNext - getCurrentTime()
					: // if all Pieces are finished, we can stop updating, because piecesOnLayer will change anyway if
					// anything happens to the Pieces
					finishedPieceIds.length === piecesOnLayer.length
					? 0
					: // the part has stopped playing, so we can stop checking
					Number.isFinite(stoppedPlayback)
					? 0
					: // essentially a fallback, we shouldn't hit this condition ever
					  1000,
			]
		},
		1000,
		[partInstanceStartedPlayback, partInstanceStoppedPlayback, piecesOnLayer]
	)
}

const ONCE_A_MINUTE = 60000

const EMPTY_PLAYED_PIECE_IDS = { playedPieceIds: [], finishedPieceIds: [] }

export function StoryboardSourceLayer({ pieces, sourceLayer, part }: IProps) {
	const partId = part?.partId

	const piecesOnLayer = useMemo(
		() =>
			pieces
				.filter(
					(piece) =>
						(piece.renderedDuration === null || piece.renderedDuration > 0) &&
						piece.instance.hidden !== true &&
						piece.instance.piece.virtual !== true &&
						piece.sourceLayer?._id === sourceLayer._id
				)
				.slice()
				.reverse(),
		[pieces]
	)
	const { playedPieceIds: _p, finishedPieceIds: finishedIds } = usePlayedOutPieceState(
		part?.instance.timings?.startedPlayback,
		part?.instance.timings?.stoppedPlayback,
		piecesOnLayer
	)

	const pieceCount = piecesOnLayer.length - finishedIds.length

	const offset = (1 - 0.8) / (pieceCount - 1 || 1)

	// the first piece found will be the "latest finished"
	const lastFinished = piecesOnLayer.find((pieceInstance) => finishedIds.includes(pieceInstance.instance._id))
	const topmostPieceIndex = lastFinished ? piecesOnLayer.indexOf(lastFinished) - 1 : piecesOnLayer.length - 1

	return (
		<div
			className={classNames('segment-storyboard__part__source-layer', {
				'segment-storyboard__part__source-layer--multiple-piece': piecesOnLayer.length > 1,
			})}
			data-obj-id={sourceLayer._id}
		>
			{piecesOnLayer.map((piece, index) => {
				const isFinished = finishedIds.includes(piece.instance._id)

				return (
					<VelocityReact.VelocityComponent
						key={piece.instance._id}
						animation={{
							translateX:
								pieceCount > 1
									? `${Math.max(0, (offset * (pieceCount - 1 - index) * 100) / MULTIPLE_PIECES_PIECE_WIDTH)}%`
									: undefined,
							translateY: isFinished ? [25, 0] : undefined,
							opacity: isFinished ? [0, 1] : 1,
						}}
						duration={350}
					>
						<StudioContext.Consumer>
							{(studio) => (
								<StoryboardSecondaryPiece
									piece={piece}
									studio={studio}
									isLiveLine={false}
									layer={sourceLayer}
									partId={partId}
									className={topmostPieceIndex === index ? 'segment-storyboard__part__piece--frontmost' : ''}
								/>
							)}
						</StudioContext.Consumer>
					</VelocityReact.VelocityComponent>
				)
			})}
		</div>
	)
}
