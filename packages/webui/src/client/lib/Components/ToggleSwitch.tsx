import { useCallback, useRef } from 'react'
import Form from 'react-bootstrap/esm/Form'

interface IToggleSwitchControlProps {
	classNames?: string
	disabled?: boolean

	label?: string

	value: boolean
	handleUpdate: (value: boolean, e: React.MouseEvent<HTMLElement>) => void
}
export function ToggleSwitchControl({
	classNames,
	value,
	disabled,
	label,
	handleUpdate,
}: Readonly<IToggleSwitchControlProps>): JSX.Element {
	// Use a ref to avoid binding into the useCallback
	const currentValue = useRef(value)
	currentValue.current = value

	const handleChange = useCallback(
		(e: React.MouseEvent<HTMLElement>) => {
			if (disabled) return
			handleUpdate(!currentValue.current, e)
		},
		[handleUpdate, disabled]
	)

	return (
		<Form.Check
			type="switch"
			className={classNames}
			disabled={disabled}
			onClick={handleChange}
			checked={value}
			label={label}
		/>
	)
}
