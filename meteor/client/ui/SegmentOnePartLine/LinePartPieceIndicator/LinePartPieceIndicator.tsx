import React, { useMemo } from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'

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
	const hasPieces = useMemo(
		() => !!pieces.find((piece) => piece.sourceLayer && sourceLayerIds.includes(piece.sourceLayer._id)),
		[pieces, sourceLayerIds]
	)
	return (
		<div
			className="segment-opl__piece-indicator"
			data-source-layer-ids={sourceLayers.map((sourceLayer) => sourceLayer._id).join(' ')}
		>
			{hasPieces ? label : ''}
		</div>
	)
}
