import React, { useCallback, useState } from 'react'
import ClassNames from 'classnames'

interface ITextInputControlProps {
	classNames?: string
	modifiedClassName?: string
	disabled?: boolean
	placeholder?: string
	spellCheck?: boolean
	/**
	 * Link a `datalist` to this field as suggestions.
	 * Future: this should be reworked into a new component that wraps this one.
	 */
	dataListId?: string

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
	spellCheck,
	dataListId,
	handleUpdate,
	updateOnKey,
}: Readonly<ITextInputControlProps>): JSX.Element {
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
			let value: string = event.target.value
			if (value) {
				value = value.trim()
			}
			handleUpdate(value)

			setEditingValue(null)
		},
		[handleUpdate]
	)
	const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
		setEditingValue(event.currentTarget.value)
	}, [])
	const handleKeyUp = useCallback(
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
			className={ClassNames('form-control', classNames, editingValue !== null && modifiedClassName)}
			placeholder={placeholder}
			value={editingValue ?? value ?? ''}
			onChange={handleChange}
			onBlur={handleBlur}
			onFocus={handleFocus}
			onKeyUp={handleKeyUp}
			disabled={disabled}
			spellCheck={spellCheck}
			list={dataListId}
		/>
	)
}
