import React, { useState } from 'react'
import classNames from 'classnames'
import { ISourceLayer, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Studio } from '../../../../lib/collections/Studios'
import { PieceExtended } from '../../../../lib/Rundown'
import { withMediaObjectStatus } from '../../SegmentTimeline/withMediaObjectStatus'
import { RundownUtils } from '../../../lib/rundown'
import { PartId } from '../../../../lib/collections/Parts'
import { RundownAPI } from '../../../../lib/api/rundown'

interface IProps {
	partId: PartId
	layer: ISourceLayer | undefined
	piece: PieceExtended
	studio: Studio | undefined
	isLiveLine?: boolean
}

export const StoryboardPartThumbnailInner = withMediaObjectStatus<IProps, {}>()(({ piece, layer, partId }: IProps) => {
	const [highlight] = useState(false)
	const typeClass = layer?.type ? RundownUtils.getSourceLayerClassName(layer?.type) : ''

	const innerPiece = piece.instance.piece

	return (
		<div
			className={classNames('segment-storyboard__part__thumbnail', typeClass, {
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
		>
			{piece.instance.piece.name} ({layer?.abbreviation || layer?.name})
		</div>
	)
})
