import React from 'react'
import { MicFloatingInspector } from '../../../FloatingInspectors/MicFloatingInspector'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { IDefaultRendererProps } from './DefaultRenderer'

export function ScriptRenderer(props: IDefaultRendererProps): JSX.Element | string {
	const labelItems = (props.piece.instance.piece.name || '').split('||')
	const begin = (labelItems[0] || '').trim()
	const end = (labelItems[1] || '').trim()

	const content = props.piece.instance.piece.content as ScriptContent

	if (end) {
		return (
			<>
				<div className="part__piece__right-align-label-container">
					<span className="part__piece__right-align-label-inside">{end}</span>
				</div>
				{content && (
					<MicFloatingInspector
						content={content}
						floatingInspectorStyle={
							props.elementOffset
								? {
										top: `${props.elementOffset.top}px`,
										left: `${props.elementOffset.left + props.elementOffset.width / 2}px`,
								  }
								: {}
						}
						itemElement={null}
						showMiniInspector={!!props.hovering}
						typeClass={props.typeClass}
					/>
				)}
			</>
		)
	} else {
		return begin
	}
}
