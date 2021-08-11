import { faPencilAlt, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TriggerType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import * as React from 'react'
import { TriggeredActionsObj } from '../../../../../lib/collections/TriggeredActions'
import { ActionEditor } from './actionEditors/ActionEditor'
import { HotkeyTrigger } from './triggerPreviews/HotkeyTrigger'

interface IProps {
	triggeredAction: TriggeredActionsObj
	selected?: boolean
	onEdit: (e) => void
}

export const TriggeredActionEntry: React.FC<IProps> = function TriggeredActionEntry(
	props: IProps
): React.ReactElement | null {
	const { triggeredAction, selected, onEdit } = props
	return (
		<div
			className={classNames('triggered-action-entry selectable', {
				'selectable-selected': selected,
			})}
		>
			<div className="triggered-action-entry__triggers">
				{triggeredAction.triggers.map((trigger, index) =>
					trigger.type === TriggerType.hotkey ? (
						<HotkeyTrigger key={index} keys={trigger.keys} />
					) : (
						<React.Fragment key={index}>Unknown trigger type: {trigger.type}</React.Fragment>
					)
				)}
			</div>
			<div className="triggered-action-entry__actions">
				{triggeredAction.actions.map((action, index) => (
					<ActionEditor key={index} action={action} index={index} triggeredAction={triggeredAction} />
				))}
			</div>
			<div className="triggered-action-entry__modify">
				<button className="action-btn" onClick={onEdit}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={() => {}}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</div>
		</div>
	)
}
