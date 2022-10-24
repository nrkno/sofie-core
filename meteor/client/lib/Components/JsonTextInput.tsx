import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

export function tryParseJson(str: string | undefined): { parsed: object } | undefined {
	const str2 = str?.trim() ?? ''

	// Shortcut for empty
	if (str2 === '' || str2 === '{}') return { parsed: {} }

	try {
		const parsed = JSON.parse(str2)
		if (typeof parsed === 'object') return { parsed: parsed }
	} catch (err) {
		// ignore
	}
	return undefined
}

interface IJsonTextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	invalidClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: object
	handleUpdate: (value: object) => void
}
export function JsonTextInputControl({
	classNames,
	modifiedClassName,
	invalidClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
}: IJsonTextInputControlProps) {
	const [editingValue, setEditingValue] = useState<string | null>(null)
	const [valueInvalid, setValueInvalid] = useState(false)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setEditingValue(event.target.value)

			if (updateOnKey) {
				const parsed = tryParseJson(event.target.value)
				if (parsed) {
					handleUpdate(parsed.parsed)
					setValueInvalid(false)
				} else {
					setValueInvalid(true)
				}
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLTextAreaElement>) => {
			const parsed = tryParseJson(event.target.value)

			if (parsed) {
				handleUpdate(parsed.parsed)
				setEditingValue(null)
				setValueInvalid(false)
			} else {
				setValueInvalid(true)
			}
		},
		[handleUpdate]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
		setEditingValue(event.currentTarget.value)
	}, [])
	const handleEscape = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Escape') {
			setEditingValue(null)
		}
	}, [])
	const handleEnter = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter') {
			event.stopPropagation()
		}
	}, [])

	return (
		<textarea
			className={`form-control ${classNames || ''} ${editingValue !== null ? modifiedClassName || '' : ''} ${
				valueInvalid && invalidClassName ? invalidClassName : ''
			}`}
			placeholder={placeholder}
			value={editingValue ?? JSON.stringify(value, undefined, 2) ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleEscape}
			onKeyPress={handleEnter}
			disabled={disabled}
		/>
	)
}

interface IJsonTextInputControlPropsWithOverride extends IJsonTextInputControlProps {
	defaultValue: object | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
	hint?: string
}
export function JsonTextInputControlWithOverride({
	classNames,
	modifiedClassName,
	invalidClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	defaultValue,
	isOverridden,
	clearOverride,
	label,
	hint,
}: IJsonTextInputControlPropsWithOverride) {
	const { t } = useTranslation()

	return (
		<label className="field">
			{label}
			<JsonTextInputControl
				classNames={classNames}
				modifiedClassName={modifiedClassName}
				invalidClassName={invalidClassName}
				value={value}
				disabled={disabled}
				handleUpdate={handleUpdate}
				placeholder={placeholder}
				updateOnKey={updateOnKey}
			/>
			{hint && <span className="text-s dimmed">{hint}</span>}
			<span>
				&nbsp;({t('Default')} = &quot;{JSON.stringify(defaultValue) || ''}&quot;)
			</span>
			<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
				{t('Reset')}
				&nbsp;
				<FontAwesomeIcon icon={faRefresh} />
			</button>
		</label>
	)
}

interface JsonTextInputControlWithOverrideForObjectProps<T extends object> {
	label: string
	hint?: string
	placeholder?: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof T
	opPrefix: string
	overrideHelper: OverrideOpHelper

	classNames?: string
	modifiedClassName?: string
	invalidClassName?: string
	disabled?: boolean
}
export function JsonTextInputControlWithOverrideForObject<T extends object>({
	label,
	hint,
	placeholder,
	item,
	itemKey,
	opPrefix,
	overrideHelper,
	classNames,
	modifiedClassName,
	invalidClassName,
	disabled,
}: JsonTextInputControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: object) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	if (item.defaults) {
		return (
			<JsonTextInputControlWithOverride
				value={(item.computed[itemKey] as unknown as string[]) || []}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={item.defaults[String(itemKey)] as string[]}
				label={label}
				hint={hint}
				placeholder={placeholder}
				classNames={classNames}
				modifiedClassName={modifiedClassName}
				invalidClassName={invalidClassName}
				disabled={disabled}
			/>
		)
	} else {
		return (
			<label className="field">
				{label}
				<JsonTextInputControl
					value={(item.computed[itemKey] as unknown as string[]) || []}
					handleUpdate={setValueInner}
					placeholder={placeholder}
					classNames={classNames}
					modifiedClassName={modifiedClassName}
					invalidClassName={invalidClassName}
					disabled={disabled}
				/>
				{hint && <span className="text-s dimmed">{hint}</span>}
			</label>
		)
	}
}
