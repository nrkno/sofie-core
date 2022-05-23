import React from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../../lib/Rundown'
import { LinePartPieceIndicator } from './LinePartPieceIndicator/LinePartPieceIndicator'

interface IProps {
	pieces: PieceExtended[]
	indicatorColumns: Record<string, ISourceLayerExtended[]>
}

export const LinePartPieceIndicators: React.FC<IProps> = function LinePartPieceIndicators({
	pieces,
	indicatorColumns,
}) {
	return (
		<div className="segment-opl__piece-indicators">
			{Object.entries(indicatorColumns).map(([label, sourceLayers]) => (
				<LinePartPieceIndicator key={label} label={label} sourceLayers={sourceLayers} pieces={pieces} />
			))}
		</div>
	)
}
