import * as React from 'react'
import ClassNames from 'classnames'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { BucketAdLibUi, BucketAdLibActionUi } from '../../RundownViewBuckets'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece, PieceStatusCode } from '../../../../../lib/collections/Pieces'
import { withMediaObjectStatus } from '../../../SegmentTimeline/withMediaObjectStatus'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../../../lib/shelf'
import { UIShowStyleBase } from '../../../../../lib/api/showStyles'
import { UIStudio } from '../../../../../lib/api/studios'

interface IProps {
	piece: PieceUi | IAdLibListItem | BucketAdLibUi | BucketAdLibActionUi
	showStyleBase: UIShowStyleBase
	studio: UIStudio
}

const InspectorTitle = withMediaObjectStatus<IProps, {}>()(function InspectorTitle(props: IProps) {
	const piece = RundownUtils.isPieceInstance(props.piece)
		? (props.piece.instance.piece as Piece)
		: (props.piece as AdLibPieceUi)

	const layer = props.showStyleBase.sourceLayers[piece.sourceLayerId]

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
