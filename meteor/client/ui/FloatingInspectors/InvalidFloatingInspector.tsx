import React from 'react'
import { useTranslation } from 'react-i18next'

import { FloatingInspector } from '../FloatingInspector'
import { DBPart } from '../../../lib/collections/Parts'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

interface IProps {
	itemElement: HTMLDivElement | null
	showMiniInspector: boolean
	floatingInspectorStyle: React.CSSProperties
	part: DBPart

	displayOn?: 'document' | 'viewport'
}

function renderReason(noticeLevel: NoteSeverity, noticeMessage: string | null): JSX.Element {
	return (
		<>
			<div className="segment-timeline__mini-inspector__notice-header">
				{noticeLevel === NoteSeverity.ERROR ? (
					<CriticalIconSmall />
				) : noticeLevel === NoteSeverity.WARNING ? (
					<WarningIconSmall />
				) : null}
			</div>
			<div className="segment-timeline__mini-inspector__notice">{noticeMessage}</div>
		</>
	)
}

export const InvalidFloatingInspector: React.FunctionComponent<IProps> = (props: IProps) => {
	const { t } = useTranslation()

	if (!props.part.invalidReason) {
		return null
	}

	const noteSeverity = props.part.invalidReason.severity || NoteSeverity.INFO

	return (
		<FloatingInspector shown={props.showMiniInspector && props.itemElement !== undefined} displayOn={props.displayOn}>
			<div
				className={
					'segment-timeline__mini-inspector ' +
					'unknown' +
					' ' +
					(noteSeverity === NoteSeverity.ERROR
						? 'segment-timeline__mini-inspector--notice notice-critical'
						: noteSeverity === NoteSeverity.WARNING
						? 'segment-timeline__mini-inspector--notice notice-warning'
						: '')
				}
				style={props.floatingInspectorStyle}
			>
				{renderReason(noteSeverity, translateMessage(props.part.invalidReason.message, t))}
			</div>
		</FloatingInspector>
	)
}
