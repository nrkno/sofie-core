import React from 'react'
import { EvsContent } from '@sofie-automation/blueprints-integration'
import { IProps } from './ThumbnailRendererFactory'

export function LocalThumbnailRenderer({ pieceInstance }: IProps) {
	const localContent = pieceInstance.instance.piece.content as EvsContent

	const { color } = localContent

	return (
		<>
			<div className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label--lg">
				{color && (
					<span
						style={{ backgroundColor: color.startsWith('#') ? color : `#${color}` }}
						className="segment-storyboard__thumbnail__label segment-storyboard__thumbnail__label__colored-mark"
					>
						·
					</span>
				)}
				{pieceInstance.instance.piece.name}
			</div>
		</>
	)
}
