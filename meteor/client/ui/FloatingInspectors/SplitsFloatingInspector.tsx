import React, { useMemo, memo } from 'react'
import ClassNames from 'classnames'

import { FloatingInspector } from '../FloatingInspector'
import { RundownUtils } from '../../lib/rundown'
import { SplitRole, SplitSubItem, SplitsSourceRenderer } from '../SegmentTimeline/Renderers/SplitsSourceRenderer'
import { SplitsContent } from '@sofie-automation/blueprints-integration'

interface IProps {
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	floatingInspectorStyle: React.CSSProperties
	content: SplitsContent
	displayOn?: 'document' | 'viewport'
}

const RenderSplitPreview = memo(function RenderSplitPreview({ subItems }: { subItems: SplitSubItem[] }) {
	return (
		<div className="video-preview">
			{subItems.reverse().map((item, index, array) => {
				return (
					<div
						className={ClassNames(
							'video-preview',
							RundownUtils.getSourceLayerClassName(item.type),
							{
								background: item.role === SplitRole.ART,
								box: item.role === SplitRole.BOX,
							},
							{
								second: array.length > 1 && index > 0 && item.type === array[index - 1].type,
							}
						)}
						key={item._id + '-preview'}
						style={{
							left: ((item.content?.x ?? 0) * 100).toString() + '%',
							top: ((item.content?.y ?? 0) * 100).toString() + '%',
							width: ((item.content?.scale ?? 1) * 100).toString() + '%',
							height: ((item.content?.scale ?? 1) * 100).toString() + '%',
							clipPath:
								item.content && item.content.crop
									? `inset(${item.content.crop.top * 100}% ${item.content.crop.right * 100}% ${
											item.content.crop.bottom * 100
									  }% ${item.content.crop.left * 100}%)`
									: undefined,
						}}
					>
						{item.role === SplitRole.BOX && <div className="video-preview__label">{item.label}</div>}
					</div>
				)
			})}
		</div>
	)
})

export const SplitsFloatingInspector: React.FunctionComponent<IProps> = (props) => {
	const splitItems = useMemo(() => SplitsSourceRenderer.generateSplitSubItems(props.content.boxSourceConfiguration), [
		props.content.boxSourceConfiguration,
	])

	return (
		<FloatingInspector shown={props.showMiniInspector && props.itemElement !== undefined} displayOn={props.displayOn}>
			<div
				className="segment-timeline__mini-inspector segment-timeline__mini-inspector--video"
				style={props.floatingInspectorStyle}
			>
				<RenderSplitPreview subItems={splitItems} />
			</div>
		</FloatingInspector>
	)
}
