import React, { useCallback, useMemo } from 'react'
import { MultiSelect, MultiSelectEvent, MultiSelectOptions } from '../multiSelect'
import { DropdownInputOption } from './DropdownInput'
import ClassNames from 'classnames'

interface IMultiSelectInputControlProps {
	classNames?: string
	disabled?: boolean
	placeholder?: string

	value: string[]
	options: DropdownInputOption<string>[]
	handleUpdate: (value: string[]) => void
}
export function MultiSelectInputControl({
	classNames,
	value,
	disabled,
	options,
	handleUpdate,
}: IMultiSelectInputControlProps) {
	const handleChange = useCallback((event: MultiSelectEvent) => handleUpdate(event.selectedValues), [handleUpdate])

	const {
		optionsWithCurrentValue,
		currentOptionMissing,
	}: { optionsWithCurrentValue: MultiSelectOptions; currentOptionMissing: boolean } = useMemo(() => {
		const convertedOptions: MultiSelectOptions = {}

		for (const option of options) {
			convertedOptions[option.name] = { value: option.value }
		}

		let currentOptionMissing = false
		for (const val of value) {
			if (!convertedOptions[val]) {
				convertedOptions[val] = { value: `${val}`, className: 'option-missing' }
				currentOptionMissing = true
			}
		}

		return { optionsWithCurrentValue: convertedOptions, currentOptionMissing: currentOptionMissing }
	}, [options, value])

	return (
		<MultiSelect
			availableOptions={optionsWithCurrentValue}
			// placeholder?: string
			className={ClassNames(classNames, {
				'option-missing': currentOptionMissing,
			})}
			value={value}
			onChange={handleChange}
			disabled={disabled}
		/>
	)
}
