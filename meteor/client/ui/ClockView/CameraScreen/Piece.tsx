import { SourceLayerType, SplitsContent } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import React, { useContext, useMemo } from 'react'
import { CanvasSizeContext } from '.'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

const PIECE_TYPE_INDICATOR_BORDER_RADIUS = 11

export const Piece = React.memo(function Piece({
	piece,
	left,
	width,
	zoom,
	isLive,
}: {
	piece: PieceExtended
	left: number
	width: number | null
	zoom: number
	isLive: boolean
}): JSX.Element | null {
	const canvasWidth = useContext(CanvasSizeContext)

	const indicatorPadding = -1 * PIECE_TYPE_INDICATOR_BORDER_RADIUS
	let pixelLeft = Math.max(indicatorPadding, left * zoom) + PIECE_TYPE_INDICATOR_BORDER_RADIUS
	let pixelWidth = Math.min(canvasWidth, (width ?? canvasWidth) * zoom + Math.min(left * zoom, 0))

	if (isLive) {
		pixelLeft = 0
		pixelWidth = Math.min(canvasWidth, (width ?? canvasWidth) * zoom) + PIECE_TYPE_INDICATOR_BORDER_RADIUS
	}

	const style = useMemo<React.CSSProperties>(
		() =>
			width === null
				? {
						width: `100%`,
						transform: `translate(${pixelLeft}px, 0)`,
				  }
				: {
						width: `${pixelWidth}px`,
						transform: `translate(${pixelLeft}px, 0)`,
				  },
		[width, pixelLeft, pixelWidth]
	)

	return (
		<div className={classNames('camera-screen__piece', { live: isLive })} data-width={JSON.stringify(width)}>
			{pixelLeft < canvasWidth ? (
				<div
					className={classNames(
						'camera-screen__piece-background',
						piece.sourceLayer?.type !== undefined
							? RundownUtils.getSourceLayerClassName(piece.sourceLayer?.type)
							: undefined
					)}
					style={style}
				>
					<PieceSubContent className="camera-screen__piece-sub-background" piece={piece} />
				</div>
			) : null}
			<div
				className={classNames(
					'camera-screen__piece-type-indicator',
					piece.sourceLayer?.type !== undefined
						? RundownUtils.getSourceLayerClassName(piece.sourceLayer?.type)
						: undefined
				)}
			>
				<PieceSubContent className="camera-screen__piece-type-indicator-sub-background" piece={piece} />
			</div>
			<div className="camera-screen__piece-label">{piece.instance.piece.name}</div>
		</div>
	)
})

function PieceSubContent({ piece, className }: { piece: PieceExtended; className: string }) {
	if (piece.sourceLayer?.type !== SourceLayerType.SPLITS) return null

	const splitContent = piece.instance.piece.content as SplitsContent

	return (
		<>
			{splitContent.boxSourceConfiguration.map((subContent, index) => (
				<div
					key={`sub-${index}`}
					className={classNames(className, RundownUtils.getSourceLayerClassName(subContent.type))}
				></div>
			))}
		</>
	)
}
