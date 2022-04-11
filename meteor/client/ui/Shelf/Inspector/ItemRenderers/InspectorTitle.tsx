import * as React from 'react'
import ClassNames from 'classnames'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { BucketAdLibUi, BucketAdLibActionUi } from '../../RundownViewBuckets'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece, PieceStatusCode } from '../../../../../lib/collections/Pieces'
import { Studio } from '../../../../../lib/collections/Studios'
import { withMediaObjectStatus } from '../../../SegmentTimeline/withMediaObjectStatus'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../../../lib/shelf'

interface IProps {
	piece: PieceUi | IAdLibListItem | BucketAdLibUi | BucketAdLibActionUi
	showStyleBase: ShowStyleBase
	studio: Studio
}

const InspectorTitle = withMediaObjectStatus<IProps, {}>()(function InspectorTitle(props: IProps) {
	const piece = RundownUtils.isPieceInstance(props.piece)
		? (props.piece.instance.piece as Piece)
		: (props.piece as AdLibPieceUi)

	const layer = props.showStyleBase.sourceLayers.find((layer) => layer._id === piece.sourceLayerId)

	return (
		<h2 className="shelf-inspector__title">
			<div
				className={ClassNames(
					'shelf-inspector__title__icon',
					layer && RundownUtils.getSourceLayerClassName(layer.type),
					{
						'source-missing': piece.status === PieceStatusCode.SOURCE_MISSING,
						'source-broken': piece.status === PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': piece.status === PieceStatusCode.UNKNOWN,
					}
				)}
			>
				{layer && (layer.abbreviation || layer.name)}
			</div>
			<span className="shelf-inspector__title__label">{piece.name}</span>
		</h2>
	)
})

export default InspectorTitle
