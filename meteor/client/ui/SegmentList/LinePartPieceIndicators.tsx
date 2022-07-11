import React from 'react'
import { ISourceLayerExtended, PieceExtended } from '../../../lib/Rundown'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { LinePartAdLibIndicator } from './LinePartPieceIndicator/LinePartAdLibIndicator'
import { LinePartPieceIndicator } from './LinePartPieceIndicator/LinePartPieceIndicator'
import { LinePartScriptPiece } from './LinePartPieceIndicator/LinePartScriptPiece'

interface IProps {
	partId: PartId
	pieces: PieceExtended[]
	indicatorColumns: Record<string, ISourceLayerExtended[]>
	adLibIndicatorColumns: Record<string, ISourceLayerExtended[]>
}

export const LinePartPieceIndicators: React.FC<IProps> = function LinePartPieceIndicators({
	partId,
	pieces,
	indicatorColumns,
	adLibIndicatorColumns,
}) {
	return (
		<div className="segment-opl__piece-indicators">
			<LinePartScriptPiece pieces={pieces} />
			{Object.entries(indicatorColumns).map(([label, sourceLayers]) => (
				<LinePartPieceIndicator key={label} label={label} sourceLayers={sourceLayers} pieces={pieces} />
			))}
			{Object.entries(adLibIndicatorColumns).map(([label, sourceLayers]) => (
				<LinePartAdLibIndicator key={label} label={label} sourceLayers={sourceLayers} partId={partId} />
			))}
		</div>
	)
}
