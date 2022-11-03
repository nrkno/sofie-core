import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { SomeBlueprintTrigger, TriggerType } from '@sofie-automation/blueprints-integration'
import { DBBlueprintTrigger } from '../../../../../../lib/collections/TriggeredActions'
import { HotkeyTrigger } from './HotkeyTrigger'
import { usePopper } from 'react-popper'
import { sameWidth } from '../../../../../lib/popperUtils'
import { useTranslation } from 'react-i18next'
import { EditAttribute } from '../../../../../lib/EditAttribute'
import { HotkeyEditor } from './HotkeyEditor'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTrash } from '@fortawesome/free-solid-svg-icons'
import { isDeviceTrigger, isHotkeyTrigger } from '../../../../../../lib/api/triggers/triggerTypeSelectors'
import { DeviceTrigger } from './DeviceTrigger'
import { DeviceEditor } from './DeviceEditor'

interface IProps {
	id: string
	trigger: DBBlueprintTrigger
	opened?: boolean
	onChangeTrigger: (id: string, newVal: DBBlueprintTrigger) => void
	onRemove: (id: string) => void
	onFocus: (id: string) => void
	onClose: (id: string) => void
}

function getTriggerTypes(t: TFunction): Record<string, TriggerType> {
	return {
		[t('Hotkey')]: TriggerType.hotkey,
		[t('Device')]: TriggerType.device,
	}
}

export const TriggerEditor = function TriggerEditor({ opened, trigger, id, ...props }: IProps) {
	const { t } = useTranslation()
	const [localTrigger, setLocalTrigger] = useState<DBBlueprintTrigger>({ ...trigger })
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

	const onFocus = useCallback(() => props.onFocus(id), [id])
	const onRemove = useCallback(() => props.onRemove(id), [id])
	const onChangeTrigger = useCallback(
		(changeLocalTrigger: DBBlueprintTrigger) => props.onChangeTrigger(id, changeLocalTrigger),
		[id]
	)

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				props.onClose(id)
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened, trigger])

	const triggerPreview = isHotkeyTrigger(trigger) ? (
		<HotkeyTrigger
			innerRef={setReferenceElement}
			keys={trigger.keys || ''}
			up={trigger.up || false}
			onClick={onFocus}
			selected={opened}
		/>
	) : isDeviceTrigger(trigger) ? (
		<DeviceTrigger
			innerRef={setReferenceElement}
			deviceId={trigger.deviceId || ''}
			trigger={trigger.triggerId || ''}
			onClick={onFocus}
			selected={opened}
		/>
	) : (
		// @ts-expect-error trigger.type is `never`, but runtime it can be something else
		<div ref={setReferenceElement}>Unknown trigger type: {trigger.type}</div>
	)

	const triggerEditor = isHotkeyTrigger(localTrigger) ? (
		<HotkeyEditor
			trigger={localTrigger}
			onChange={(newVal) => setLocalTrigger(newVal)}
			modified={!isHotkeyTrigger(trigger) || trigger.keys !== localTrigger.keys}
		/>
	) : isDeviceTrigger(localTrigger) ? (
		<DeviceEditor
			trigger={localTrigger}
			onChange={(newVal) => setLocalTrigger(newVal)}
			modified={
				!isDeviceTrigger(trigger) ||
				trigger.deviceId !== localTrigger.deviceId ||
				trigger.triggerId !== localTrigger.triggerId ||
				JSON.stringify(trigger.arguments) !== JSON.stringify(localTrigger.arguments)
			}
		/>
	) : null

	useLayoutEffect(() => {
		update && update().catch(console.error)
	}, [trigger])

	useEffect(() => {
		setLocalTrigger(trigger)
	}, [opened])

	function onChangeType(newValue: string) {
		if (!(newValue in TriggerType)) {
			return
		}

		setLocalTrigger({
			type: newValue as TriggerType,
		} as SomeBlueprintTrigger)
	}

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
							overrideDisplayValue={localTrigger.type}
							attribute={''}
							updateFunction={(_e, newVal) => onChangeType(newVal)}
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
