import { faCheckSquare, faRefresh, faSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ReadonlyDeep } from 'type-fest'

interface ICheckboxControlProps {
	classNames?: string
	disabled?: boolean

	value: boolean
	handleUpdate: (value: boolean) => void
}
export function CheckboxControl({ classNames, value, disabled, handleUpdate }: ICheckboxControlProps) {
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			handleUpdate(!!e.currentTarget.checked)
		},
		[handleUpdate]
	)

	return (
		<span className={`checkbox ${classNames}`}>
			<input type="checkbox" className="form-control" checked={value} onChange={handleChange} disabled={disabled} />
			<span className="checkbox-checked">
				<FontAwesomeIcon icon={faCheckSquare} />
			</span>
			<span className="checkbox-unchecked">
				<FontAwesomeIcon icon={faSquare} />
			</span>
		</span>
	)
}

interface ICheckboxControlPropsWithOverride extends ICheckboxControlProps {
	defaultValue: boolean | undefined
	isOverridden: boolean
	clearOverride: () => void

	label: string
}
export function CheckboxControlWithOverride({
	classNames,
	value,
	disabled,
	handleUpdate,
	defaultValue,
	isOverridden,
	clearOverride,
	label,
}: ICheckboxControlPropsWithOverride) {
	const { t } = useTranslation()

	return (
		<label>
			<CheckboxControl classNames={classNames} value={value} disabled={disabled} handleUpdate={handleUpdate} />
			{label}
			<span>
				&nbsp;({t('Default')} = {defaultValue ? 'true' : 'false'})
			</span>
			<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
				{t('Reset')}
				&nbsp;
				<FontAwesomeIcon icon={faRefresh} />
			</button>
		</label>
	)
}

interface CheckboxControlWithOverrideForObjectProps<T> {
	label: string
	item: T
	defaultItem: T | undefined
	itemKey: keyof T
	itemOps: ReadonlyDeep<SomeObjectOverrideOp[]>
	opPrefix: string
	setValue: (opPrefix: string, key: string, value: boolean) => void
	clearOverride: (opPrefix: string, key: string) => void
}
export function CheckboxControlWithOverrideForObject<T>({
	label,
	item,
	itemKey,
	itemOps,
	opPrefix,
	defaultItem,
	setValue,
	clearOverride,
}: CheckboxControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: boolean) => {
			setValue(opPrefix, String(itemKey), newValue)
		},
		[setValue, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		clearOverride(opPrefix, String(itemKey))
	}, [clearOverride, opPrefix, itemKey])

	if (defaultItem) {
		return (
			<CheckboxControlWithOverride
				value={!!item[itemKey]}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(itemOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={!!defaultItem[String(itemKey)]}
				label={label}
			/>
		)
	} else {
		return (
			<label className="field">
				<CheckboxControl value={!!item[String(itemKey)]} handleUpdate={setValueInner} />
				{label}
			</label>
		)
	}
}

function hasOpWithPath(allOps: ReadonlyDeep<SomeObjectOverrideOp[]>, id: string, subpath: string): boolean {
	const path = `${id}.${subpath}`
	return !!allOps.find((op) => op.path === path)
}
