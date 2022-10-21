import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
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
	hint?: string
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
	hint,
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
			{hint && <span className="text-s dimmed">{hint}</span>}
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

interface TextInputControlWithOverrideForObjectProps<T extends object> {
	label: string
	hint?: string
	placeholder?: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof T
	opPrefix: string
	overrideHelper: OverrideOpHelper

	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
}
export function TextInputControlWithOverrideForObject<T extends object>({
	label,
	hint,
	placeholder,
	item,
	itemKey,
	opPrefix,
	overrideHelper,
	classNames,
	modifiedClassName,
	disabled,
}: TextInputControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: string) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	if (item.defaults) {
		return (
			<TextInputControlWithOverride
				value={String(item.computed[itemKey] || '')}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={String(item.defaults[String(itemKey)])}
				label={label}
				hint={hint}
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
					value={String(item.computed[itemKey] || '')}
					handleUpdate={setValueInner}
					placeholder={placeholder}
					classNames={classNames}
					modifiedClassName={modifiedClassName}
					disabled={disabled}
				/>
				{hint && <span className="text-s dimmed">{hint}</span>}
			</label>
		)
	}
}
