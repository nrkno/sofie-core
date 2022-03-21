import * as React from 'react'
import { SplitsContent } from '@sofie-automation/blueprints-integration'
import { PieceGeneric } from '../../../lib/collections/Pieces'
import { getSplitPreview } from '../../lib/ui/splitPreview'
import { RenderSplitPreview } from '../../lib/SplitPreviewBox'

interface IProps {
	piece: Omit<PieceGeneric, 'timelineObjectsString'>
}

export function DashboardPieceButtonSplitPreview({ piece }: IProps) {
	const subItems = getSplitPreview((piece.content as SplitsContent).boxSourceConfiguration)
	return <RenderSplitPreview subItems={subItems} showLabels={false} />
}
