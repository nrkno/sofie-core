import classNames from 'classnames'
import React, { useMemo } from 'react'
import { PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

export function Piece({
	piece,
	left,
	width,
}: {
	piece: PieceExtended
	left: number
	width: number
}): JSX.Element | null {
	const style = useMemo(
		() => ({
			width: `${Math.min(100, width * 100)}%`,
			left: `${Math.max(0, left * 100)}%`,
		}),
		[width, left]
	)

	return (
		<div className="camera-screen__piece">
			{left < 1 ? (
				<div
					className={classNames(
						'camera-screen__piece-background',
						piece.sourceLayer?.type !== undefined
							? RundownUtils.getSourceLayerClassName(piece.sourceLayer?.type)
							: undefined
					)}
					style={style}
				></div>
			) : null}
			<div className="camera-screen__piece-label">{piece.instance.piece.name}</div>
		</div>
	)
}
