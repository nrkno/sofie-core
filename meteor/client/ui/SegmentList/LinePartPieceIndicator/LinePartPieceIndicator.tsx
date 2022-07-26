import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'
import { LinePartIndicator } from './LinePartIndicator'

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
	const { t } = useTranslation()
	const sourceLayerIds = useMemo(() => sourceLayers.map((layer) => layer._id), [sourceLayers])
	const thisPieces = useMemo(
		() =>
			pieces.filter(
				(piece) =>
					piece.sourceLayer &&
					sourceLayerIds.includes(piece.sourceLayer._id) &&
					(piece.renderedDuration === null || piece.renderedDuration > 0)
			),
		[pieces, sourceLayerIds]
	)

	const hasPiece = thisPieces[0]

	const hasOriginInPreceedingPart = hasPiece?.hasOriginInPreceedingPart || false

	return (
		<LinePartIndicator
			allSourceLayers={sourceLayers}
			count={thisPieces.length}
			label={label.substring(0, 1)}
			thisSourceLayer={hasPiece?.sourceLayer}
			hasOriginInPreceedingPart={hasOriginInPreceedingPart}
			overlay={
				<>
					<b>{label}</b>:{' '}
					{thisPieces.length === 0 ? t('Not present') : thisPieces.map((piece) => piece.instance.piece.name).join(', ')}
				</>
			}
		/>
	)
}
