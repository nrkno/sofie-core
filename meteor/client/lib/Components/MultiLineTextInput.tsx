import React, { useCallback, useState } from 'react'

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
