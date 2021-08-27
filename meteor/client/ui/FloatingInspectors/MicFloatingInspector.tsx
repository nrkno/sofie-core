import React from 'react'
import { useTranslation } from 'react-i18next'
import Moment from 'react-moment'

import { FloatingInspector } from '../FloatingInspector'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { GetScriptPreview } from '../scriptPreview'

interface IProps {
	typeClass?: string
	showMiniInspector: boolean
	itemElement: HTMLDivElement | null
	floatingInspectorStyle: React.CSSProperties
	content: ScriptContent
	displayOn?: 'document' | 'viewport'
}

export function MicFloatingInspector(props: IProps) {
	const { t } = useTranslation()

	const { startOfScript, endOfScript, breakScript } = GetScriptPreview(props.content.fullScript || '')

	return (
		<FloatingInspector shown={props.showMiniInspector && props.itemElement !== undefined} displayOn={props.displayOn}>
			<div
				className={
					'segment-timeline__mini-inspector ' + props.typeClass + ' segment-timeline__mini-inspector--pop-down'
				}
				style={props.floatingInspectorStyle}
			>
				<div>
					{props.content && props.content.fullScript ? (
						breakScript ? (
							<React.Fragment>
								<span className="mini-inspector__full-text text-broken">{startOfScript + '\u2026'}</span>
								<span className="mini-inspector__full-text text-broken text-end">{'\u2026' + endOfScript}</span>
							</React.Fragment>
						) : (
							<span className="mini-inspector__full-text">{props.content.fullScript}</span>
						)
					) : props.content.lastWords ? (
						<span className="mini-inspector__full-text">{props.content.lastWords}</span>
					) : (
						<span className="mini-inspector__system">{t('Script is empty')}</span>
					)}
				</div>
				{props.content && props.content.lastModified ? (
					<div className="mini-inspector__footer">
						<span className="mini-inspector__changed">
							<Moment date={props.content.lastModified} calendar={true} />
						</span>
					</div>
				) : null}
			</div>
		</FloatingInspector>
	)
}
