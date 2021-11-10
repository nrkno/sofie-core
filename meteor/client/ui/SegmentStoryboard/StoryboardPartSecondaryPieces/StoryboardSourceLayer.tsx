import React from 'react'
import { unprotectString } from '../../../../lib/lib'
import { ISourceLayerExtended, PieceExtended } from '../../../../lib/Rundown'

interface IProps {
	sourceLayer: ISourceLayerExtended
	pieces: PieceExtended[]
}

export function StoryboardSourceLayer({ pieces, sourceLayer }: IProps) {
	return (
		<div className="segment-storyboard__part__source-layer" data-obj-id={sourceLayer._id}>
			{pieces
				.filter((piece) => piece.sourceLayer?._id === sourceLayer._id)
				.map((piece) => (
					<div
						key={unprotectString(piece.instance._id)}
						className="segment-storyboard__part__piece"
						data-obj-id={piece.instance._id}
					>
						{piece.instance.piece.name}
					</div>
				))}
		</div>
	)
}
