import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

export interface DropdownInputOption<TValue> {
	value: TValue
	name: string
	i: number
}

export function getDropdownInputOptions<T>(rawOptions: any): DropdownInputOption<T>[] {
	const options: Omit<DropdownInputOption<T>, 'i'>[] = []

	if (Array.isArray(rawOptions)) {
		// is it an enum?
		for (const val of rawOptions) {
			if (typeof val === 'object') {
				options.push({
					name: val.name,
					value: val.value,
				})
			} else {
				options.push({
					name: val,
					value: val,
				})
			}
		}
	} else if (typeof rawOptions === 'object') {
		// Is options an enum?
		const keys = Object.keys(rawOptions)
		const first = rawOptions[keys[0]]
		if (rawOptions[first] + '' === keys[0] + '') {
			// is an enum, only pick
			for (const key in rawOptions) {
				if (!isNaN(parseInt(key, 10))) {
					// key is a number (the key)
					const enumValue = rawOptions[key]
					const enumKey = rawOptions[enumValue]
					options.push({
						name: enumValue,
						value: enumKey,
					})
				}
			}
		} else {
			for (const key in rawOptions) {
				const val = rawOptions[key]
				if (Array.isArray(val)) {
					options.push({
						name: key,
						value: val as any,
					})
				} else {
					options.push({
						name: key + ': ' + val,
						value: val,
					})
				}
			}
		}
	}

	return options.map((opt, i) => ({
		...opt,
		i,
	}))
}

function findOptionByValue<T>(options: DropdownInputOption<T>[], value: T): DropdownInputOption<T> | undefined {
	return options.find((o) => {
		if (Array.isArray(o.value)) {
			return o.value.includes(value)
		}
		return o.value === value
	})
}

interface IDropdownInputControlProps<TValue> {
	classNames?: string
	disabled?: boolean

	value: TValue
	options: DropdownInputOption<TValue>[]
	handleUpdate: (value: TValue) => void
}
export function DropdownInputControl<TValue>({
	classNames,
	value,
	disabled,
	options,
	handleUpdate,
}: IDropdownInputControlProps<TValue>) {
	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			// because event.target.value is always a string, use the original value instead
			const option = options.find((o) => o.value + '' === event.target.value + '')

			handleUpdate(option ? option.value : (event.target.value as any))
		},
		[handleUpdate, options]
	)

	const optionsWithCurrentValue: DropdownInputOption<TValue>[] = useMemo(() => {
		const currentOption = findOptionByValue(options, value)
		if (!currentOption) {
			// if currentOption not found, then add it to the list:

			return [
				...options,
				{
					name: 'Value: ' + value,
					value: value,
					i: options.length,
				},
			]
		}

		return options
	}, [options, value])

	return (
		<div className="select focusable">
			<select
				className={`form-control ${classNames || ''}`}
				value={value + ''}
				onChange={handleChange}
				disabled={disabled}
			>
				{optionsWithCurrentValue.map((o, j) =>
					Array.isArray(o.value) ? (
						<optgroup key={j} label={o.name}>
							{o.value.map((v, i) => (
								<option key={i} value={v + ''}>
									{v}
								</option>
							))}
						</optgroup>
					) : (
						<option key={o.i} value={o.value + ''}>
							{o.name}
						</option>
					)
				)}
			</select>
		</div>
	)
}

interface IDropdownInputControlPropsWithOverride<TValue> extends IDropdownInputControlProps<TValue> {
	defaultValue: TValue | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
	hint?: string
}
export function DropdownInputControlWithOverride<TValue>({
	classNames,
	value,
	disabled,
	options,
	handleUpdate,
	defaultValue,
	isOverridden,
	clearOverride,
	label,
	hint,
}: IDropdownInputControlPropsWithOverride<TValue>) {
	const { t } = useTranslation()

	const defaultValueText = useMemo(() => {
		if (defaultValue === undefined) return undefined
		const matchedOption = findOptionByValue(options, defaultValue)
		if (matchedOption) {
			return matchedOption.name
		} else {
			return 'Value: ' + defaultValue
		}
	}, [options, defaultValue])

	return (
		<label className="field">
			{label}
			<DropdownInputControl
				classNames={classNames}
				value={value}
				disabled={disabled}
				options={options}
				handleUpdate={handleUpdate}
			/>
			{hint && <span className="text-s dimmed">{hint}</span>}
			<span>
				&nbsp;({t('Default')} = &quot;{defaultValueText || ''}&quot;)
			</span>
			<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
				{t('Reset')}
				&nbsp;
				<FontAwesomeIcon icon={faRefresh} />
			</button>
		</label>
	)
}

interface DropdownInputControlWithOverrideForObjectProps<T extends object, TValue> {
	label: string
	hint?: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof T
	opPrefix: string
	overrideHelper: OverrideOpHelper
	options: DropdownInputOption<TValue>[]

	classNames?: string
	disabled?: boolean
}
export function DropdownInputControlWithOverrideForObject<T extends object, TValue>({
	label,
	hint,
	item,
	itemKey,
	opPrefix,
	overrideHelper,
	options,
	classNames,
	disabled,
}: DropdownInputControlWithOverrideForObjectProps<T, TValue>) {
	const setValueInner = useCallback(
		(newValue: any) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	if (item.defaults) {
		return (
			<DropdownInputControlWithOverride<any>
				value={item.computed[itemKey] ?? ''}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={item.defaults[String(itemKey)]}
				label={label}
				hint={hint}
				classNames={classNames}
				disabled={disabled}
				options={options}
			/>
		)
	} else {
		return (
			<label className="field">
				{label}
				<DropdownInputControl<any>
					value={item.computed[itemKey] ?? ''}
					handleUpdate={setValueInner}
					classNames={classNames}
					disabled={disabled}
					options={options}
				/>
				{hint && <span className="text-s dimmed">{hint}</span>}
			</label>
		)
	}
}
