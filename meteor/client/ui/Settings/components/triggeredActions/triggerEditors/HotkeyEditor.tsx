import classNames from 'classnames'
import React, { useContext, useState } from 'react'
import { useLayoutEffect } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DBBlueprintTrigger } from '../../../../../../lib/collections/TriggeredActions'
import { EditAttribute } from '../../../../../lib/EditAttribute'
import { SorensenContext } from '../../../../../lib/SorensenContext'
import { codesToKeyLabels } from '../../../../../lib/triggers/codesToKeyLabels'

interface IProps {
	trigger: DBBlueprintTrigger
	modified?: boolean
	readonly?: boolean
	onChange: (newVal: DBBlueprintTrigger) => void
}

export const MODIFIER_MAP = {
	ControlLeft: 'Control',
	ControlRight: 'Control',
	ShiftLeft: 'Shift',
	ShiftRight: 'Shift',
	AltLeft: 'Alt',
	AltRight: 'Alt',
	MetaLeft: 'Meta',
	MetaRight: 'Meta',
	Enter: 'AnyEnter',
	NumpadEnter: 'AnyEnter',
}

export function convertToLenientModifiers(keys: string[]): string[] {
	return keys.map((key) => {
		if (key in MODIFIER_MAP) {
			return MODIFIER_MAP[key]
		} else {
			return key
		}
	})
}

export const HotkeyEditor = function HotkeyEditor({ trigger, modified, readonly, onChange }: IProps) {
	const sorensen = useContext(SorensenContext)
	const [input, setInput] = useState<HTMLInputElement | null>(null)
	const [displayValue, setDisplayValue] = useState(trigger.keys)
	const [value, setValue] = useState(trigger.keys)
	const { t } = useTranslation()

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (sorensen) {
			const pressedKeys = convertToLenientModifiers(sorensen.getPressedKeys()).join('+')
			setValue(pressedKeys)
			setDisplayValue(codesToKeyLabels(pressedKeys, sorensen))
		}
		e.preventDefault()
	}

	function onBlur() {
		if (sorensen) {
			sorensen.poison()
		}
	}

	useEffect(() => {
		let processedKeys = trigger.keys
		if (sorensen) {
			processedKeys = codesToKeyLabels(processedKeys, sorensen)
		}
		setDisplayValue(processedKeys)
		setValue(trigger.keys)
	}, [trigger.keys, sorensen])

	useLayoutEffect(() => {
		setTimeout(() => {
			input?.focus()
		}, 40)
	}, [input])

	useEffect(() => {
		onChange({
			...trigger,
			keys: value,
		})
	}, [value])

	return (
		<>
			<input
				type="text"
				className={classNames('form-control input text-input input-m', {
					bghl: modified,
				})}
				ref={setInput}
				value={displayValue}
				onKeyDown={onKeyDown}
				onBlur={onBlur}
				onChange={() => {
					// Do nothing
				}}
				disabled={readonly}
			/>
			<EditAttribute
				type={'toggle'}
				className="sb-nocolor"
				overrideDisplayValue={trigger.up}
				updateFunction={(_e, newValue) =>
					onChange({
						...trigger,
						up: newValue,
					})
				}
				label={t('On release')}
				disabled={readonly}
			/>
		</>
	)
}
