import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

interface IFloatInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	zeroBased?: boolean
	value: number | undefined
	handleUpdate: (value: number) => void
}
export function FloatInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	zeroBased,
}: IFloatInputControlProps) {
	const [editingValue, setEditingValue] = useState<number | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const number = parseFloat(event.target.value.replace(',', '.'))
			setEditingValue(number)

			if (updateOnKey && !isNaN(number)) {
				handleUpdate(zeroBased ? number - 1 : number)
			}
		},
		[handleUpdate, updateOnKey, zeroBased]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			const number = parseFloat(event.currentTarget.value.replace(',', '.'))
			if (!isNaN(number)) {
				handleUpdate(zeroBased ? number - 1 : number)
			}

			setEditingValue(null)
		},
		[handleUpdate, zeroBased]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(parseFloat(event.currentTarget.value.replace(',', '.')))
	}, [])
	const handleEscape = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Escape') {
				setEditingValue(null)
			} else if (event.key === 'Enter') {
				const number = parseFloat(event.currentTarget.value.replace(',', '.'))
				if (!isNaN(number)) {
					handleUpdate(zeroBased ? number - 1 : number)
				}
			}
		},
		[handleUpdate, zeroBased]
	)

	let showValue: string | number | undefined = editingValue ?? undefined
	if (showValue === undefined && value !== undefined) {
		showValue = zeroBased ? value + 1 : value
	}
	if (showValue === undefined || isNaN(Number(showValue))) showValue = ''

	return (
		<input
			type="number"
			step="0.1"
			className={`form-control ${classNames || ''} ${editingValue !== null ? modifiedClassName || '' : ''}`}
			placeholder={placeholder}
			value={showValue ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleEscape}
			disabled={disabled}
		/>
	)
}

interface IFloatInputControlPropsWithOverride extends IFloatInputControlProps {
	defaultValue: number | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
	hint?: string
}
export function FloatInputControlWithOverride({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
	zeroBased,
	defaultValue,
	isOverridden,
	clearOverride,
	label,
	hint,
}: IFloatInputControlPropsWithOverride) {
	const { t } = useTranslation()

	const showValue = typeof defaultValue === 'number' && zeroBased ? defaultValue + 1 : defaultValue

	return (
		<label className="field">
			{label}
			<FloatInputControl
				classNames={classNames}
				modifiedClassName={modifiedClassName}
				value={value}
				disabled={disabled}
				handleUpdate={handleUpdate}
				placeholder={placeholder}
				updateOnKey={updateOnKey}
				zeroBased={zeroBased}
			/>
			{hint && <span className="text-s dimmed">{hint}</span>}
			<span>
				&nbsp;({t('Default')} = {showValue ?? '""'})
			</span>
			<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
				{t('Reset')}
				&nbsp;
				<FontAwesomeIcon icon={faRefresh} />
			</button>
		</label>
	)
}

interface FloatInputControlWithOverrideForObjectProps<T extends object> {
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
	zeroBased?: boolean
}
export function FloatInputControlWithOverrideForObject<T extends object>({
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
	zeroBased,
}: FloatInputControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: number) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	const value = item.computed[itemKey] !== undefined ? Number(item.computed[itemKey]) : undefined

	if (item.defaults) {
		const defaultValue =
			item.defaults[String(itemKey)] !== undefined ? Number(item.defaults[String(itemKey)]) : undefined

		return (
			<FloatInputControlWithOverride
				value={value}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={defaultValue}
				label={label}
				hint={hint}
				placeholder={placeholder}
				classNames={classNames}
				modifiedClassName={modifiedClassName}
				disabled={disabled}
				zeroBased={zeroBased}
			/>
		)
	} else {
		return (
			<label className="field">
				{label}
				<FloatInputControl
					value={value}
					handleUpdate={setValueInner}
					placeholder={placeholder}
					classNames={classNames}
					modifiedClassName={modifiedClassName}
					disabled={disabled}
					zeroBased={zeroBased}
				/>
				{hint && <span className="text-s dimmed">{hint}</span>}
			</label>
		)
	}
}
