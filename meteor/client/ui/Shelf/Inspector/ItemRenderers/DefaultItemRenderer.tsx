import * as React from 'react'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import { RundownAPI } from '../../../../../lib/api/rundown'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import InspectorTitle from './InspectorTitle'

export default function DefaultItemRenderer(props: {
	piece: PieceUi | AdLibPieceUi
	showStyleBase: ShowStyleBase
}): JSX.Element {
	const piece = RundownUtils.isAdLibPiece(props.piece)
		? (props.piece as AdLibPieceUi)
		: (props.piece.instance.piece as Piece)

	const layer = props.showStyleBase.sourceLayers.find((layer) => layer._id === piece.sourceLayerId)

	return (
		<>
			<InspectorTitle piece={props.piece} showStyleBase={props.showStyleBase} />
			<dl>
				<dd>name</dd>
				<dt>{piece.name}</dt>
				<dd>externalId</dd>
				<dt>{piece.externalId}</dt>
				<dd>partId</dd>
				<dt>{piece.partId}</dt>
				<dd>sourceLayerId</dd>
				<dt>{piece.sourceLayerId}</dt>
				<dd>outputLayerId</dd>
				<dt>{piece.outputLayerId}</dt>
				<dd>metaData</dd>
				<dt>{JSON.stringify(piece.metaData || {})}</dt>
			</dl>
		</>
	)
}
