import * as React from 'react'
import { PieceUi } from '../../../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../AdLibPanel'
import { RundownUtils } from '../../../../lib/rundown'
import { Piece } from '../../../../../lib/collections/Pieces'
import { NoraContent } from 'tv-automation-sofie-blueprints-integration'

export { isActionItem }

export default function ActionItemRenderer(props: { piece: PieceUi | AdLibPieceUi }): JSX.Element | null {
	let piece = RundownUtils.isAdLibPiece(props.piece) ?
		props.piece as AdLibPieceUi :
		props.piece.instance.piece as Piece

	let action = (piece as AdLibPieceUi).adlibAction

	if (!action) {
		return (
			<span>AdLib is an action, but it wasn't attached.</span>
		)
	}

	return null
}

function isActionItem(item: AdLibPieceUi | PieceUi): boolean {
	const content = RundownUtils.isAdLibPiece(item) ?
		item as AdLibPieceUi :
		item.instance.piece as Piece

	if (content || (content as AdLibPieceUi).isAction) {
		return true
	}

	return false
}
