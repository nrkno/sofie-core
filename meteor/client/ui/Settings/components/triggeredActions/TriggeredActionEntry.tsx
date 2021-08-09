import { TriggerType } from '@sofie-automation/blueprints-integration'
import * as React from 'react'
import { TriggeredActionsObj } from '../../../../../lib/collections/TriggeredActions'
import { ActionEditor } from './actionEditors/ActionEditor'
import { HotkeyTrigger } from './triggerPreviews/HotkeyTrigger'

interface IProps {
	triggeredAction: TriggeredActionsObj
}

export const TriggeredActionEntry: React.FC<IProps> = function TriggeredActionEntry(
	props: IProps
): React.ReactElement | null {
	const { triggeredAction: action } = props
	return (
		<div className="triggered-action-entry">
			<div className="triggered-action-entry__triggers">
				{action.triggers.map((trigger, index) =>
					trigger.type === TriggerType.hotkey ? (
						<HotkeyTrigger key={index} keys={trigger.keys} />
					) : (
						<React.Fragment key={index}>Unknown trigger type: {trigger.type}</React.Fragment>
					)
				)}
			</div>
			<div className="triggered-action-entry__actions">
				{action.actions.map((action, index) => (
					<ActionEditor key={index} action={action} />
				))}
			</div>
		</div>
	)
}
