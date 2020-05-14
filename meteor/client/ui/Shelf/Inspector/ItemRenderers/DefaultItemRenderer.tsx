import * as React from 'react'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../AdLibPanel'

export default function DefaultItemRenderer(props: { piece: PieceUi | AdLibPieceUi }): JSX.Element {
	console.log(props.piece)
	let piece
	if (props.piece && (props.piece as PieceUi).instance) {
		piece = (props.piece as PieceUi).instance.piece
	} else {
		piece = props.piece as AdLibPieceUi
	}

	return (
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
	)
}