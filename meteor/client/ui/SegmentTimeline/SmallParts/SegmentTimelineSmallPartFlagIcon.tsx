import React from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceIconContainerAlternative } from '../../PieceIcons/PieceIcon'
import { PartUi } from './../SegmentTimelineContainer'

export const SegmentTimelineSmallPartFlagIcon = (props: {
	partInstance: PartUi
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}) => {
	return (
		<div className="segment-timeline__small-parts-flag__part">
			<PieceIconContainerAlternative
				pieceInstances={props.partInstance.pieces.map((piece) => piece.instance)}
				sourceLayers={props.sourceLayers}
			/>
		</div>
	)
}
