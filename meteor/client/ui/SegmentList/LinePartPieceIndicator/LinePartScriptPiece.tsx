import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import React, { useMemo } from 'react'
import { PieceExtended } from '../../../../lib/Rundown'

interface IProps {
	pieces: PieceExtended[]
}

export function LinePartScriptPiece({ pieces }: IProps) {
	const thisPieces = useMemo(
		() =>
			pieces.filter(
				(piece) =>
					piece.sourceLayer &&
					piece.sourceLayer.type === SourceLayerType.SCRIPT &&
					(piece.renderedDuration === null || piece.renderedDuration > 0)
			),
		[pieces]
	)

	const hasPiece = thisPieces[0]
	let scriptLabel = ''
	if (hasPiece) {
		const scriptLabelSplit = hasPiece.instance.piece.name.split('||')
		scriptLabel = scriptLabelSplit[1] || scriptLabelSplit[0]
	}

	return (
		<div
			className="segment-opl__piece-indicator-placeholder segment-opl__piece-indicator-placeholder--script"
			data-items={JSON.stringify(thisPieces.map((piece) => piece.instance.piece.name))}
		>
			{hasPiece && (
				<div className="segment-opl__piece-indicator segment-opl__piece-indicator--script script">{scriptLabel}</div>
			)}
			{!hasPiece && <div className="segment-opl__piece-indicator"></div>}
		</div>
	)
}
