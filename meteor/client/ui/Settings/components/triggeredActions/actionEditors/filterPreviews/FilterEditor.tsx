import React, { useState, useEffect } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { EditAttribute } from '../../../../../../lib/EditAttribute'

interface IProps {
	fieldLabel: string
	description?: string
	valueLabel?: string
	field: string
	fields: string[]
	value: any
	final?: boolean
	readonly?: boolean
	type: 'switch' | 'text' | 'int' | 'dropdown' | 'multiselect'
	values?: Record<string, any>
	onChangeField: (newField: any) => void
	onChange: (newValue: any) => void
	onFocus?: () => void
}

export const FilterEditor: React.FC<IProps> = function FilterEditor(props: IProps): React.ReactElement | null {
	const [focused, setFocused] = useState(false)
	const [referenceElement, setReferenceElement] = useState<HTMLDListElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes } = usePopper(referenceElement, popperElement, {
		modifiers: [
			{
				name: 'offset',
				options: {
					offset: [0, -30],
				},
			},
		],
	})

	useEffect(() => {
		if (focused && typeof props.onFocus === 'function') {
			props.onFocus()
		}
	}, [focused])

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				setFocused(false)
			}
		}

		if (focused) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, focused])

	return (
		<>
			<dl
				className={classNames('triggered-action-entry__action__filter', {
					final: props.final,
					focused,
					clickable: !props.readonly,
				})}
				ref={setReferenceElement}
				tabIndex={0}
				onClick={() => !props.readonly && setFocused(true)}
			>
				<dt>{props.fieldLabel}</dt>
				<dd>{props.valueLabel}</dd>
			</dl>
			{focused ? (
				<div
					className="expco expco-expanded expco-popper mod pas ptl expco-popper-rounded triggered-action-entry__action__filter-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					{props.description && <p className="man">{props.description}</p>}
					<div>
						<EditAttribute
							className="form-control input text-input input-m"
							modifiedClassName="bghl"
							type={'dropdown'}
							label={props.fieldLabel}
							options={props.fields}
							overrideDisplayValue={props.field}
							attribute={''}
							updateFunction={(e, newVal) => {
								console.log(newVal)
								props.onChangeField(newVal)
							}}
						/>
					</div>
					<div>
						<EditAttribute
							className={props.type === 'switch' ? 'form-control' : 'form-control input text-input input-m'}
							modifiedClassName="bghl"
							type={props.type}
							label={props.fieldLabel}
							options={props.values}
							overrideDisplayValue={typeof props.value === 'number' ? String(props.value) : props.value}
							attribute={''}
							updateFunction={(e, newVal) => {
								console.log(newVal)
								props.onChange(newVal)
							}}
						/>
					</div>
				</div>
			) : null}
		</>
	)
}
