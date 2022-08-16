import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'
import StudioContext from '../../RundownView/StudioContext'
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
			pieces
				.filter(
					(piece) =>
						piece.sourceLayer &&
						sourceLayerIds.includes(piece.sourceLayer._id) &&
						(piece.renderedDuration === null || piece.renderedDuration > 0)
				)
				.sort((a, b) => (b.instance.dynamicallyInserted ?? 0) - (a.instance.dynamicallyInserted ?? 0)), // TODO: This is a quick & dirty way to handle someone switching a Backscreen from a graphic to a clip
		[pieces, sourceLayerIds]
	)

	const topPiece = thisPieces[0]

	const hasOriginInPreceedingPart = topPiece?.hasOriginInPreceedingPart || false

	return (
		<StudioContext.Consumer>
			{(studio) => {
				if (!studio) return null
				return (
					<LinePartIndicator
						allSourceLayers={sourceLayers}
						count={thisPieces.length}
						label={label.substring(0, 1)}
						thisSourceLayer={topPiece?.sourceLayer}
						hasOriginInPreceedingPart={hasOriginInPreceedingPart}
						piece={topPiece}
						studio={studio}
						overlay={
							<>
								<b>{label}</b>:&nbsp;
								{thisPieces.length === 0
									? t('Not present')
									: thisPieces.map((piece) => piece.instance.piece.name).join(', ')}
							</>
						}
					/>
				)
			}}
		</StudioContext.Consumer>
	)
}
