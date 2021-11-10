import React from 'react'
import { ISourceLayerExtended, PartExtended } from '../../../../lib/Rundown'
import { IOutputLayerUi } from '../../SegmentContainer/withResolvedSegment'
import { StoryboardSourceLayer } from './StoryboardSourceLayer'

interface IProps {
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
}

function filterSourceLayers(sourceLayers: ISourceLayerExtended[]) {
	return sourceLayers.filter((sourceLayer) => !sourceLayer.isHidden && !sourceLayer.onPresenterScreen)
}

export function StoryboardPartSecondaryPieces({ part, outputLayers }: IProps) {
	return (
		<div className="segment-storyboard__part__secondary-pieces">
			{Object.values(outputLayers)
				.filter((outputLayer) => outputLayer.used)
				.map((outputLayer) => {
					const sourceLayers = filterSourceLayers(Object.values(outputLayer.sourceLayers))

					if (sourceLayers.length === 0) return null

					return (
						<div key={outputLayer._id} className="segment-storyboard__part__output-group" data-obj-id={outputLayer._id}>
							{sourceLayers.map((sourceLayer) => (
								<StoryboardSourceLayer key={sourceLayer._id} sourceLayer={sourceLayer} pieces={part.pieces} />
							))}
						</div>
					)
				})}
		</div>
	)
}
