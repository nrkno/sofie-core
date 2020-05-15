import * as React from 'react'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { IAdLibListItem } from '../../AdLibListItem'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import { NoraContent } from 'tv-automation-sofie-blueprints-integration'

export default function ActionItemRenderer(props: { piece: PieceUi | AdLibPieceUi }): JSX.Element {
	let piece = RundownUtils.isAdLibPiece(props.piece) ?
		props.piece as AdLibPieceUi :
		props.piece.instance.piece as Piece

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

export function isActionItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item) ?
		item.content as NoraContent :
		item.instance.piece.content as NoraContent

	if (!content || !content.payload || !content.payload.template) {
		return false
	}

	return true
}
