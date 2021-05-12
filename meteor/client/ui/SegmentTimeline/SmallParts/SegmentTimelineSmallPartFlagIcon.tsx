import React from 'react'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { PieceIconContainerNoSub } from '../../PieceIcons/PieceIcon'
import { PartUi } from './../SegmentTimelineContainer'
import classNames from 'classnames'

export const SegmentTimelineSmallPartFlagIcon = (props: {
	partInstance: PartUi
	isNext?: boolean
	isLive?: boolean
	sourceLayers: {
		[key: string]: ISourceLayer
	}
}) => {
	return (
		<div
			className={classNames('segment-timeline__small-parts-flag__part', {
				next: props.isNext,
				live: props.isLive,
			})}
		>
			<PieceIconContainerNoSub
				pieceInstances={props.partInstance.pieces.map((piece) => piece.instance)}
				sourceLayers={props.sourceLayers}
				renderUnknown={true}
			/>
		</div>
	)
}
