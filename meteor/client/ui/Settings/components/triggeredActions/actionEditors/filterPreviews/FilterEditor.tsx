import React, { useState, useEffect, useLayoutEffect } from 'react'
import classNames from 'classnames'
import { usePopper } from 'react-popper'
import { EditAttribute } from '../../../../../../lib/EditAttribute'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { sameWidth } from '../../../../../../lib/popperUtils'

interface IProps {
	fieldLabel: string
	description?: string
	valueLabel?: string
	opened: boolean
	field: string
	fields: string[] | Record<string, string>
	value: any
	final?: boolean
	readonly?: boolean
	type: 'switch' | 'text' | 'int' | 'dropdown' | 'multiselect'
	values?: Record<string, any>
	onChangeField: (newField: any) => void
	onChange: (newValue: any) => void
	onFocus?: () => void
	onInsertNext?: () => void
	onRemove?: () => void
	onClose: () => void
}

export const FilterEditor: React.FC<IProps> = function FilterEditor(props: IProps): React.ReactElement | null {
	const { opened, onClose, onFocus } = props
	const { t } = useTranslation()
	const [referenceElement, setReferenceElement] = useState<HTMLDListElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
		modifiers: [
			{
				name: 'offset',
				options: {
					offset: [0, -30],
				},
			},
			sameWidth,
		],
	})

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				onClose()
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened])

	useLayoutEffect(() => {
		update && update().catch(console.error)
	}, [props.fieldLabel, props.valueLabel])

	return (
		<>
			<dl
				className={classNames('triggered-action-entry__action__filter', {
					final: props.final,
					focused: opened,
					clickable: !props.readonly,
				})}
				ref={setReferenceElement}
				tabIndex={0}
				role="button"
				onClick={() => !props.readonly && typeof onFocus === 'function' && onFocus()}
			>
				<dt>{props.fieldLabel}</dt>
				<dd>{props.valueLabel}</dd>
			</dl>
			{opened ? (
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
							updateFunction={(e, newVal) => props.onChangeField(newVal)}
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
							updateFunction={(e, newVal) => props.onChange(newVal)}
						/>
					</div>
					<div className="mts">
						{!props.final ? (
							<button className="btn right btn-tight btn-primary" onClick={props.onInsertNext}>
								{t('Insert next')}
							</button>
						) : null}
						<button className="btn btn-tight btn-secondary" onClick={props.onRemove}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}
