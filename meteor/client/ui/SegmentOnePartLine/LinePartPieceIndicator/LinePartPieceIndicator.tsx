import classNames from 'classnames'
import Tooltip from 'rc-tooltip'
import React, { useMemo } from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'
import { RundownUtils } from '../../../lib/rundown'

interface IProps {
	label: string
	sourceLayers: ISourceLayerExtended[]
	pieces: PieceExtended[]
}

export const LinePartPieceIndicator: React.FC<IProps> = function LinePartPieceIndicator({
	label,
	pieces,
	sourceLayers,
}) {
	const sourceLayerIds = useMemo(() => sourceLayers.map((layer) => layer._id), [sourceLayers])
	const thisPieces = useMemo(
		() => pieces.filter((piece) => piece.sourceLayer && sourceLayerIds.includes(piece.sourceLayer._id)),
		[pieces, sourceLayerIds]
	)

	const hasPiece = thisPieces[0]

	const typeClass = hasPiece?.sourceLayer?.type
		? RundownUtils.getSourceLayerClassName(hasPiece?.sourceLayer?.type)
		: undefined

	return (
		<Tooltip
			overlay={
				label +
				': ' +
				(thisPieces.length === 0 ? 'Not present' : thisPieces.map((piece) => piece.instance.piece.name).join(', '))
			}
			placement="top"
		>
			<div
				className={classNames('segment-opl__piece-indicator', typeClass, {
					'segment-opl__piece-indicator--no-piece': !hasPiece,
				})}
				data-source-layer-ids={sourceLayers.map((sourceLayer) => sourceLayer._id).join(' ')}
			>
				{hasPiece ? label.substring(0, 1) : ''}
			</div>
		</Tooltip>
	)
}
