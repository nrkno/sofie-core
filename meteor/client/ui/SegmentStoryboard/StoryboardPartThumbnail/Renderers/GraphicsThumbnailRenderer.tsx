import { GraphicsContent, NoraContent, NoraPayloadStepData } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { RundownUtils } from '../../../../lib/rundown'
import { L3rdFloatingInspector } from '../../../FloatingInspectors/L3rdFloatingInspector'
import { IProps } from './ThumbnailRendererFactory'

export function GraphicsThumbnailRenderer({ pieceInstance, hovering, layer, originPosition }: IProps) {
	const content = pieceInstance.instance.piece.content as NoraContent | GraphicsContent | undefined

	let hasStepChevron = false
	let stepContent: NoraPayloadStepData | undefined

	if ((pieceInstance.instance.piece.content as any)?.payload) {
		const noraContent = pieceInstance.instance.piece.content as NoraContent | undefined

		const stepContent = noraContent?.payload?.step
		const isMultiStep = stepContent?.enabled === true

		hasStepChevron = !!(isMultiStep && stepContent)
	}

	return (
		<>
			<L3rdFloatingInspector
				showMiniInspector={hovering}
				content={content}
				floatingInspectorStyle={{
					top: originPosition.top + 'px',
					left: originPosition.left + 'px',
					transform: 'translate(0, -100%)',
				}}
				typeClass={layer && RundownUtils.getSourceLayerClassName(layer.type)}
				itemElement={null}
				piece={pieceInstance.instance.piece}
				pieceRenderedDuration={pieceInstance.renderedDuration}
				pieceRenderedIn={pieceInstance.renderedInPoint}
				displayOn="document"
			/>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--sm">
				{hasStepChevron ? (
					<span className="segment-storyboard__piece__step-chevron">
						{stepContent?.to === 'next' ? (stepContent?.from || 0) + 1 : stepContent?.to || 1}
					</span>
				) : null}

				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
