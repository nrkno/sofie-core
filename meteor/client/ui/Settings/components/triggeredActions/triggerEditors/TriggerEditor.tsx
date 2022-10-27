import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { TFunction } from 'i18next'
import { TriggerType } from '@sofie-automation/blueprints-integration'
import { DBBlueprintTrigger } from '../../../../../../lib/collections/TriggeredActions'
import { HotkeyTrigger } from './HotkeyTrigger'
import { usePopper } from 'react-popper'
import { sameWidth } from '../../../../../lib/popperUtils'
import { useTranslation } from 'react-i18next'
import { HotkeyEditor } from './HotkeyEditor'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faRefresh, faTrash } from '@fortawesome/free-solid-svg-icons'
import { DropdownInputControl, DropdownInputOption } from '../../../../../lib/Components/DropdownInput'

interface IProps {
	id: string
	trigger: DBBlueprintTrigger
	opened?: boolean
	canReset: boolean
	isDeleted: boolean
	onChangeTrigger: (id: string, newVal: DBBlueprintTrigger) => void
	onResetTrigger: (id: string) => void
	onRemove: (id: string) => void
	onFocus: (id: string) => void
	onClose: (id: string) => void
}

function getTriggerTypes(t: TFunction): DropdownInputOption<TriggerType>[] {
	return [
		{
			name: t('Hotkey'),
			value: TriggerType.hotkey,
			i: 0,
		},
	]
}

export const TriggerEditor = function TriggerEditor({ opened, canReset, isDeleted, trigger, id, ...props }: IProps) {
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
	const onResetTrigger = useCallback(() => props.onResetTrigger(id), [id])

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

	const triggerPreview =
		trigger.type === TriggerType.hotkey ? (
			<HotkeyTrigger
				innerRef={setReferenceElement}
				keys={trigger.keys}
				up={trigger.up || false}
				onClick={onFocus}
				selected={opened}
				deleted={isDeleted}
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
				readonly={isDeleted}
			/>
		) : null

	useLayoutEffect(() => {
		update && update().catch(console.error)
	}, [trigger])

	useEffect(() => {
		setLocalTrigger(trigger)
	}, [opened])

	function onChangeType(_newValue: string) {
		// Nothing
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
						<DropdownInputControl
							classNames="form-control input text-input input-m"
							value={trigger.type}
							options={getTriggerTypes(t)}
							handleUpdate={onChangeType}
							disabled={isDeleted}
						/>
					</div>
					<div>{triggerEditor}</div>
					<div className="mts">
						{isDeleted ? (
							<>
								<button className="btn btn-tight btn-secondary" onClick={onResetTrigger}>
									<FontAwesomeIcon icon={faRefresh} />
								</button>
							</>
						) : (
							<>
								<button className="btn right btn-tight btn-primary" onClick={onConfirm}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
								<button className="btn btn-tight btn-secondary" onClick={onRemove}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
								{canReset && (
									<button className="btn btn-tight btn-secondary" onClick={onResetTrigger}>
										<FontAwesomeIcon icon={faRefresh} />
									</button>
								)}
							</>
						)}
					</div>
				</div>
			) : null}
		</>
	)
}
