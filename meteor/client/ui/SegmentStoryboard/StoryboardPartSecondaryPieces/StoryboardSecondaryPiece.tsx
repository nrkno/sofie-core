import classNames from 'classnames'
import React, { useState } from 'react'
import { Studio } from '../../../../lib/collections/Studios'
import { RundownUtils } from '../../../lib/rundown'
import { ISourceLayer, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment'
import { RundownAPI } from '../../../../lib/api/rundown'
import { PartId } from '../../../../lib/collections/Parts'

interface IProps {
	layer: ISourceLayer
	piece: PieceUi
	partId: PartId
	isLiveLine: boolean
	studio: Studio | undefined
}

export const StoryboardSecondaryPiece = withMediaObjectStatus<IProps, {}>()(function StoryboardSecondaryPiece({
	piece,
	partId,
}: IProps) {
	const [highlight] = useState(false)

	const typeClass = piece?.sourceLayer?.type ? RundownUtils.getSourceLayerClassName(piece?.sourceLayer?.type) : ''

	const innerPiece = piece.instance.piece

	return (
		<div
			className={classNames('segment-storyboard__part__piece', typeClass, {
				'super-infinite':
					innerPiece.lifespan !== PieceLifespan.WithinPart &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd,
				'infinite-starts':
					innerPiece.lifespan !== PieceLifespan.WithinPart &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentChange &&
					innerPiece.lifespan !== PieceLifespan.OutOnSegmentEnd &&
					piece.instance.piece.startPartId === partId,

				'not-in-vision': piece.instance.piece.notInVision,

				'source-missing':
					innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING ||
					innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_NOT_SET,
				'source-broken': innerPiece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
				'unknown-state': innerPiece.status === RundownAPI.PieceStatusCode.UNKNOWN,
				disabled: piece.instance.disabled,

				'invert-flash': highlight,
			})}
			data-obj-id={piece.instance._id}
		>
			{piece.instance.piece.name}
		</div>
	)
})
