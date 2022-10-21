import { faCheckSquare, faRefresh, faSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

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

interface CheckboxControlWithOverrideForObjectProps<T extends object> {
	label: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof T
	opPrefix: string
	overrideHelper: OverrideOpHelper
}
export function CheckboxControlWithOverrideForObject<T extends object>({
	label,
	item,
	itemKey,
	opPrefix,
	overrideHelper,
}: CheckboxControlWithOverrideForObjectProps<T>) {
	const setValueInner = useCallback(
		(newValue: boolean) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)
	const clearOverrideInner = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])

	if (item.defaults) {
		return (
			<CheckboxControlWithOverride
				value={!!item.computed[itemKey]}
				handleUpdate={setValueInner}
				isOverridden={hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))}
				clearOverride={clearOverrideInner}
				defaultValue={!!item.defaults[String(itemKey)]}
				label={label}
			/>
		)
	} else {
		return (
			<label className="field">
				<CheckboxControl value={!!item.computed[String(itemKey)]} handleUpdate={setValueInner} />
				{label}
			</label>
		)
	}
}
