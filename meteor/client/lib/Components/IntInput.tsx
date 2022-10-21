import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

interface IIntInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: number
	handleUpdate: (value: number) => void
}
export function IntInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
}: IIntInputControlProps) {
	const [editingValue, setEditingValue] = useState<number | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const number = parseInt(event.target.value, 10)
			setEditingValue(number)

			if (updateOnKey && !isNaN(number)) {
				handleUpdate(number)
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			const number = parseInt(event.currentTarget.value, 10)
			if (!isNaN(number)) {
				handleUpdate(number)
			}

			setEditingValue(null)
		},
		[handleUpdate]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(parseInt(event.currentTarget.value, 10))
	}, [])
	const handleEscape = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				const number = parseInt(event.currentTarget.value, 10)
				if (!isNaN(number)) {
					handleUpdate(number)
				}
			}
		},
		[handleUpdate]
	)

	let showValue: string | number = editingValue ?? value ?? ''
	if (isNaN(Number(showValue))) showValue = ''

	return (
		<input
			type="number"
			step="1"
			className={`form-control ${classNames || ''} ${editingValue !== null ? modifiedClassName || '' : ''}`}
			placeholder={placeholder}
			value={showValue}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleEscape}
			disabled={disabled}
		/>
	)
}

interface IIntInputControlPropsWithOverride extends IIntInputControlProps {
	defaultValue: number | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
}
export function IntInputControlWithOverride({
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
}: IIntInputControlPropsWithOverride) {
	const { t } = useTranslation()

	return (
		<label className="field">
			{label}
			<IntInputControl
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

interface IntInputControlWithOverrideForObjectProps<T extends object> {
	label: string
	placeholder?: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof T
	opPrefix: string
	overrideHelper: OverrideOpHelper

	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
}
export function IntInputControlWithOverrideForObject<T extends object>({
	label,
	placeholder,
	item,
	itemKey,
	opPrefix,
	overrideHelper,
	classNames,
	modifiedClassName,
	disabled,
}: IntInputControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: number) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	if (item.defaults) {
		return (
			<IntInputControlWithOverride
				value={Number(item.computed[itemKey] || '0')}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={Number(item.defaults[String(itemKey)])}
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
				<IntInputControl
					value={Number(item.computed[itemKey] || '0')}
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
