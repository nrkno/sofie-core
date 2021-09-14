import React, { useEffect, useLayoutEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { TriggerType } from '@sofie-automation/blueprints-integration'
import { DBBlueprintTrigger } from '../../../../../../lib/collections/TriggeredActions'
import { HotkeyTrigger } from './HotkeyTrigger'
import { usePopper } from 'react-popper'
import { sameWidth } from '../../../../../lib/popperUtils'
import { useTranslation } from 'react-i18next'
import { EditAttribute } from '../../../../../lib/EditAttribute'
import { HotkeyEditor } from './HotkeyEditor'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTrash } from '@fortawesome/free-solid-svg-icons'

interface IProps {
	trigger: DBBlueprintTrigger
	opened?: boolean
	onChangeTrigger: (newVal: DBBlueprintTrigger) => void
	onRemove: () => void
	onFocus: () => void
	onClose: () => void
}

function getTriggerTypes(t: TFunction): Record<string, TriggerType> {
	return {
		[t('Hotkey')]: TriggerType.hotkey,
	}
}

export const TriggerEditor = function TriggerEditor({
	opened,
	trigger,
	onFocus,
	onClose,
	onRemove,
	onChangeTrigger,
}: IProps) {
	const { t } = useTranslation()
	const [localTrigger, setLocalTrigger] = useState<DBBlueprintTrigger>(trigger)
	const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
		modifiers: [
			{
				name: 'offset',
				options: {
					offset: [0, -30],
				},
			},
			sameWidth,
		],
	})

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				onClose()
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened])

	const triggerPreview =
		trigger.type === TriggerType.hotkey ? (
			<HotkeyTrigger
				innerRef={setReferenceElement}
				keys={trigger.keys}
				up={trigger.up || false}
				onClick={onFocus}
				selected={opened}
			/>
		) : (
			<div ref={setReferenceElement}>Unknown trigger type: {trigger.type}</div>
		)

	const triggerEditor =
		trigger.type === TriggerType.hotkey ? (
			<HotkeyEditor
				trigger={localTrigger}
				onChange={(newVal) => setLocalTrigger(newVal)}
				modified={trigger.keys !== localTrigger.keys}
			/>
		) : null

	useLayoutEffect(() => {
		update && update().catch(console.error)
	}, [trigger])

	useEffect(() => {
		setLocalTrigger(trigger)
	}, [opened])

	function onChangeType(_newValue: string) {}

	function onConfirm() {
		onChangeTrigger(localTrigger)
	}

	return (
		<>
			{triggerPreview}
			{opened ? (
				<div
					className="expco expco-expanded expco-popper mod pas ptl expco-popper-rounded triggered-action-entry__trigger-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					<div>
						<EditAttribute
							className="form-control input text-input input-m"
							modifiedClassName="bghl"
							type={'dropdown'}
							label={t('Trigger Type')}
							options={getTriggerTypes(t)}
							overrideDisplayValue={trigger.type}
							attribute={''}
							updateFunction={(e, newVal) => onChangeType(newVal)}
						/>
					</div>
					<div>{triggerEditor}</div>
					<div className="mts">
						<button className="btn right btn-tight btn-primary" onClick={onConfirm}>
							<FontAwesomeIcon icon={faCheck} />
						</button>
						<button className="btn btn-tight btn-secondary" onClick={onRemove}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}
