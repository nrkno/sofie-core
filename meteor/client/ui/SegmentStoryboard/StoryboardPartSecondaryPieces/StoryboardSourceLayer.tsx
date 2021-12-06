import React, { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import _ from 'underscore'
import * as VelocityReact from 'velocity-react'
import { ISourceLayerExtended, PartExtended, PieceExtended } from '../../../../lib/Rundown'
import StudioContext from '../../RundownView/StudioContext'
import { StoryboardSecondaryPiece } from './StoryboardSecondaryPiece'
import { Meteor } from 'meteor/meteor'
import { PieceInstanceId } from '../../../../lib/collections/PieceInstances'
import { getCurrentTime } from '../../../../lib/lib'

interface IProps {
	sourceLayer: ISourceLayerExtended
	pieces: PieceExtended[]
	part: PartExtended
}

// needs to match .segment-storyboard__part__source-layer--multiple-piece > .segment-storyboard__part__piece width CSS property
const MULTIPLE_PIECES_PIECE_WIDTH = 0.8

function useInvalidateTimeout<K>(func: () => [K, number?], interval: number, deps?: any[], initialValue?: K) {
	const [value, setValue] = useState(initialValue ?? func()[0])
	const invalidateHandle = useRef<number | null>(null)

	useEffect(() => {
		const reevaluate = () => {
			const [newValue, revalidate] = func()
			if (!_.isEqual(newValue, value)) {
				setValue(newValue)
			}
			invalidateHandle.current = Meteor.setTimeout(reevaluate, revalidate ?? interval)
		}

		invalidateHandle.current = Meteor.setTimeout(reevaluate, interval)

		return () => {
			if (invalidateHandle.current !== null) {
				Meteor.clearTimeout(invalidateHandle.current)
			}
		}
	}, [value, interval, ...(deps || [])])

	return value
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
						piece.sourceLayer?._id === sourceLayer._id
				)
				.slice()
				.reverse(),
		[pieces]
	)

	const { playedPieceIds: _p, finishedPieceIds: finishedIds } = useInvalidateTimeout(
		() => {
			if (part?.instance.timings?.startedPlayback === undefined) {
				return [EMPTY_PLAYED_PIECE_IDS, ONCE_A_MINUTE + Math.random() * 1000]
			}

			const playedPieceIds: PieceInstanceId[] = []
			const finishedPieceIds: PieceInstanceId[] = []

			const startedPlayback = part?.instance.timings?.startedPlayback
			let closestAbsoluteNext = Number.POSITIVE_INFINITY

			piecesOnLayer.forEach((piece) => {
				if (piece.renderedInPoint === null) return
				if (startedPlayback + piece.renderedInPoint < getCurrentTime()) {
					playedPieceIds.push(piece.instance._id)
				} else {
					const absoluteInPoint = startedPlayback + piece.renderedInPoint
					if (absoluteInPoint < closestAbsoluteNext) {
						closestAbsoluteNext = absoluteInPoint
					}
				}
				if (piece.renderedDuration === null) return
				if (startedPlayback + piece.renderedInPoint + piece.renderedDuration < getCurrentTime()) {
					finishedPieceIds.push(piece.instance._id)
				}
			})

			return [
				{
					playedPieceIds,
					finishedPieceIds,
				},
				Number.isFinite(closestAbsoluteNext) ? closestAbsoluteNext - getCurrentTime() : 1000,
			]
		},
		1000,
		[part, piecesOnLayer],
		EMPTY_PLAYED_PIECE_IDS
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
									? `${(offset * (pieceCount - 1 - index) * 100) / MULTIPLE_PIECES_PIECE_WIDTH}%`
									: undefined,
							translateY: isFinished ? [25, 0] : undefined,
							opacity: isFinished ? [0, 1] : 1,
						}}
						duration={100}
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
