import React from 'react'
import { PartId } from '../../../../lib/collections/Parts'
import { unprotectString } from '../../../../lib/lib'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'
import StudioContext from '../../RundownView/StudioContext'
import { StoryboardSecondaryPiece } from './StoryboardSecondaryPiece'

interface IProps {
	sourceLayer: ISourceLayerExtended
	pieces: PieceExtended[]
	partId: PartId
}

export function StoryboardSourceLayer({ pieces, sourceLayer, partId }: IProps) {
	return (
		<div className="segment-storyboard__part__source-layer" data-obj-id={sourceLayer._id}>
			{pieces
				.filter(
					(piece) =>
						(piece.renderedDuration === null || piece.renderedDuration > 0) &&
						piece.sourceLayer?._id === sourceLayer._id
				)
				.map((piece) => (
					<StudioContext.Consumer key={unprotectString(piece.instance._id)}>
						{(studio) => (
							<StoryboardSecondaryPiece
								piece={piece}
								studio={studio}
								isLiveLine={false}
								layer={sourceLayer}
								partId={partId}
							/>
						)}
					</StudioContext.Consumer>
				))}
		</div>
	)
}
