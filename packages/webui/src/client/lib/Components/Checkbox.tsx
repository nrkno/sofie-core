import { faCheckSquare, faSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import ClassNames from 'classnames'

interface ICheckboxControlProps {
	classNames?: string
	disabled?: boolean

	value: boolean
	handleUpdate: (value: boolean) => void
}
export function CheckboxControl({
	classNames,
	value,
	disabled,
	handleUpdate,
}: Readonly<ICheckboxControlProps>): JSX.Element {
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			handleUpdate(!!e.currentTarget.checked)
		},
		[handleUpdate]
	)

	return (
		<span className={ClassNames('checkbox', classNames)}>
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
