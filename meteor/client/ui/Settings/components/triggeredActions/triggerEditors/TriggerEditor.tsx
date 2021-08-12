import React from 'react'
import { TriggerType } from '@sofie-automation/blueprints-integration'
import { DBBlueprintTrigger } from '../../../../../../lib/collections/TriggeredActions'
import { HotkeyTrigger } from './HotkeyTrigger'
// import { usePopper } from 'react-popper'
// import { sameWidth } from '../../../../../lib/popperUtils'

interface IProps {
	trigger: DBBlueprintTrigger
	opened?: boolean
}

export const TriggerEditor = function TriggerEditor({ trigger }: IProps) {
	// const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
	// const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	// const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
	// 	modifiers: [
	// 		{
	// 			name: 'offset',
	// 			options: {
	// 				offset: [0, -30],
	// 			},
	// 		},
	// 		sameWidth,
	// 	],
	// })

	const triggerPreview =
		trigger.type === TriggerType.hotkey ? (
			<HotkeyTrigger keys={trigger.keys} />
		) : (
			<div>Unknown trigger type: {trigger.type}</div>
		)

	return <>{triggerPreview}</>
}
