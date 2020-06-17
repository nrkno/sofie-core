import * as React from 'react'
import ClassNames from 'classnames'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'

export default function InspectorTitle(props: { piece: PieceUi | AdLibPieceUi; showStyleBase: ShowStyleBase }) {
	const piece = RundownUtils.isAdLibPiece(props.piece)
		? (props.piece as AdLibPieceUi)
		: (props.piece.instance.piece as Piece)

	const layer = props.showStyleBase.sourceLayers.find((layer) => layer._id === piece.sourceLayerId)

	return (
		<h2 className="shelf-inspector__title">
			<div
				className={ClassNames(
					'shelf-inspector__title__icon',
					layer && RundownUtils.getSourceLayerClassName(layer.type),
					{
						'source-missing': piece.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
						'source-broken': piece.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': piece.status === RundownAPI.PieceStatusCode.UNKNOWN,
					}
				)}>
				{layer && (layer.abbreviation || layer.name)}
			</div>
			<span className="shelf-inspector__title__label">{piece.name}</span>
		</h2>
	)
}
