import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ReadonlyDeep } from 'type-fest'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../../ui/Settings/util/OverrideOpHelper'
import { hasOpWithPath } from './util'

export interface ControlLabelAndOverridesProps<T extends object, TValue> {
	label: string
	hint?: string
	item: WrappedOverridableItemNormal<T>
	itemKey: keyof ReadonlyDeep<T>
	opPrefix: string
	overrideHelper: OverrideOpHelper

	/** Move the label to after the input */
	labelAfter?: boolean

	children: (value: TValue, setValue: (value: TValue) => void) => React.ReactNode
}
export function ControlLabelAndOverrides<T extends object, TValue = any>({
	children,
	label,
	hint,
	item,
	itemKey,
	opPrefix,
	overrideHelper,
	labelAfter,
}: ControlLabelAndOverridesProps<T, TValue>) {
	const { t } = useTranslation()

	const clearOverride = useCallback(() => {
		overrideHelper.clearItemOverrides(opPrefix, String(itemKey))
	}, [overrideHelper, opPrefix, itemKey])
	const setValue = useCallback(
		(newValue: any) => {
			overrideHelper.setItemValue(opPrefix, String(itemKey), newValue)
		},
		[overrideHelper, opPrefix, itemKey]
	)

	const isOverridden = hasOpWithPath(item.overrideOps, opPrefix, String(itemKey))

	let displayValue = ''
	if (item.defaults) {
		// TODO - other types
		displayValue = item.defaults[itemKey] ? 'true' : 'false'
	}
	return (
		<label className="field">
			{children(item.computed[String(itemKey)] as any, setValue)}
			{!labelAfter && label}

			{hint && <span className="text-s dimmed">{hint}</span>}

			{labelAfter && label}

			{item.defaults && (
				<>
					<span>
						&nbsp;({t('Default')} = {displayValue})
					</span>
					<button className="btn btn-primary" onClick={clearOverride} title="Reset to default" disabled={!isOverridden}>
						{t('Reset')}
						&nbsp;
						<FontAwesomeIcon icon={faRefresh} />
					</button>
				</>
			)}
		</label>
	)
}

export function ControlLabelAndOverridesForCheckbox<T extends object, TValue = any>(
	props: Omit<ControlLabelAndOverridesProps<T, TValue>, 'labelAfter'>
) {
	return <ControlLabelAndOverrides<T, TValue> {...props} labelAfter={true} />
}
