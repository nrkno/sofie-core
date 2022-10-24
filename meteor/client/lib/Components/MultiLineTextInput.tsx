import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

export function splitValueIntoLines(v: string | undefined): string[] {
	if (v === undefined || v.length === 0) {
		return []
	} else {
		return v.split('\n').map((i) => i.trimStart())
	}
}
export function joinLines(v: string[] | undefined): string {
	if (v === undefined || v.length === 0) {
		return ''
	} else {
		return v.join('\n')
	}
}

interface IMultiLineTextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string

	/** Call handleUpdate on every change, before focus is lost */
	updateOnKey?: boolean

	value: string[]
	handleUpdate: (value: string[]) => void
}
export function MultiLineTextInputControl({
	classNames,
	modifiedClassName,
	value,
	disabled,
	placeholder,
	handleUpdate,
	updateOnKey,
}: IMultiLineTextInputControlProps) {
	const [editingValue, setEditingValue] = useState<string | null>(null)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>) => {
			setEditingValue(event.target.value)

			if (updateOnKey) {
				handleUpdate(splitValueIntoLines(event.target.value))
			}
		},
		[handleUpdate, updateOnKey]
	)
	const handleBlur = useCallback(
		(event: React.FocusEvent<HTMLTextAreaElement>) => {
			handleUpdate(splitValueIntoLines(event.target.value))
			setEditingValue(null)
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
			className={`form-control ${classNames || ''} ${editingValue !== null ? modifiedClassName || '' : ''}`}
			placeholder={placeholder}
			value={editingValue ?? joinLines(value) ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleEscape}
			onKeyPress={handleEnter}
			disabled={disabled}
		/>
	)
}

interface IMultiLineTextInputControlPropsWithOverride extends IMultiLineTextInputControlProps {
	defaultValue: string[] | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
	hint?: string
}
export function MultiLineTextInputControlWithOverride({
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
}: IMultiLineTextInputControlPropsWithOverride) {
	const { t } = useTranslation()

	return (
		<label className="field">
			{label}
			<MultiLineTextInputControl
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
				&nbsp;({t('Default')} = &quot;{defaultValue?.join('\n') || ''}&quot;)
			</span>
			<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
				{t('Reset')}
				&nbsp;
				<FontAwesomeIcon icon={faRefresh} />
			</button>
		</label>
	)
}

interface MultiLineTextInputControlWithOverrideForObjectProps<T extends object> {
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
export function MultiLineTextInputControlWithOverrideForObject<T extends object>({
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
}: MultiLineTextInputControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: string[]) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	if (item.defaults) {
		return (
			<MultiLineTextInputControlWithOverride
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
				disabled={disabled}
			/>
		)
	} else {
		return (
			<label className="field">
				{label}
				<MultiLineTextInputControl
					value={(item.computed[itemKey] as unknown as string[]) || []}
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
