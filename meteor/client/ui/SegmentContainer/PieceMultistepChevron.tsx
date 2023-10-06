import React from 'react'
import { NoraContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PieceExtended } from '../../../lib/Rundown'

export const PieceMultistepChevron = function PieceMultistepChevron({
	className,
	piece,
}: {
	className: string
	piece: PieceExtended
}): JSX.Element | null {
	const noraContent = piece.instance.piece.content as NoraContent | undefined

	const hasStepChevron =
		(piece.sourceLayer?.type === SourceLayerType.GRAPHICS || piece.sourceLayer?.type === SourceLayerType.LOWER_THIRD) &&
		noraContent?.payload?.step?.enabled

	if (!hasStepChevron) return null

	return (
		<span className={className}>
			{noraContent?.payload?.step?.to === 'next'
				? (noraContent.payload.step?.from || 0) + 1
				: noraContent.payload.step?.to || 1}
		</span>
	)
}
