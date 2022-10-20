import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReadonlyDeep } from 'type-fest'
import { hasOpWithPath } from './util'

interface ITextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: string
	handleUpdate: (value: string) => void
}
export function TextInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
}: ITextInputControlProps) {
	const [editingValue, setEditingValue] = useState<string | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			setEditingValue(event.target.value)

			if (updateOnKey) {
				handleUpdate(event.target.value)
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			handleUpdate(event.target.value)
			setEditingValue(null)
		},
		[handleUpdate]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(event.currentTarget.value)
	}, [])
	const handleEscape = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				handleUpdate(event.currentTarget.value)
			}
		},
		[handleUpdate]
	)

	return (
		<input
			type="text"
			className={`form-control ${classNames || ''} ${editingValue !== null ? modifiedClassName || '' : ''}`}
			placeholder={placeholder}
			value={editingValue ?? value ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleEscape}
			disabled={disabled}
		/>
	)
}

interface ITextInputControlPropsWithOverride extends ITextInputControlProps {
	defaultValue: string | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
}
export function TextInputControlWithOverride({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	defaultValue,
	isOverridden,
	clearOverride,
	label,
}: ITextInputControlPropsWithOverride) {
	const { t } = useTranslation()

	return (
		<label className="field">
			{label}
			<TextInputControl
				classNames={classNames}
				modifiedClassName={modifiedClassName}
				value={value}
				disabled={disabled}
				handleUpdate={handleUpdate}
				placeholder={placeholder}
				updateOnKey={updateOnKey}
			/>
			<span>
				&nbsp;({t('Default')} = &quot;{defaultValue || ''}&quot;)
			</span>
			<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
				{t('Reset')}
				&nbsp;
				<FontAwesomeIcon icon={faRefresh} />
			</button>
		</label>
	)
}

interface TextInputControlWithOverrideForObjectProps<T> {
	label: string
	placeholder?: string
	item: T
	defaultItem: T | undefined
	itemKey: keyof T
	itemOps: ReadonlyDeep<SomeObjectOverrideOp[]>
	opPrefix: string
	setValue: (opPrefix: string, key: string, value: string) => void
	clearOverride: (opPrefix: string, key: string) => void

	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
}
export function TextInputControlWithOverrideForObject<T>({
	label,
	placeholder,
	item,
	itemKey,
	itemOps,
	opPrefix,
	defaultItem,
	setValue,
	clearOverride,
	classNames,
	modifiedClassName,
	disabled,
}: TextInputControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: string) => {
			setValue(opPrefix, String(itemKey), newValue)
		},
		[setValue, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		clearOverride(opPrefix, String(itemKey))
	}, [clearOverride, opPrefix, itemKey])

	if (defaultItem) {
		return (
			<TextInputControlWithOverride
				value={String(item[itemKey] || '')}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(itemOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={String(defaultItem[String(itemKey)])}
				label={label}
				placeholder={placeholder}
				classNames={classNames}
				modifiedClassName={modifiedClassName}
				disabled={disabled}
			/>
		)
	} else {
		return (
			<label className="field">
				{label}
				<TextInputControl
					value={String(item[itemKey] || '')}
					handleUpdate={setValueInner}
					placeholder={placeholder}
					classNames={classNames}
					modifiedClassName={modifiedClassName}
					disabled={disabled}
				/>
			</label>
		)
	}
}
