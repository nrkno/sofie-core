import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from './ReactMeteorData/react-meteor-data'

import { MultiSelect, MultiSelectEvent, MultiSelectOptions } from './multiSelect'
import ClassNames from 'classnames'
import { ColorPickerEvent, ColorPicker } from './colorPicker'
import { IconPicker, IconPickerEvent } from './iconPicker'
import { assertNever, getRandomString } from '../../lib/lib'
import { MongoCollection } from '../../lib/collections/lib'
import { CheckboxControl } from './Components/Checkbox'
import { TextInputControl } from './Components/TextInput'
import { IntInputControl } from './Components/IntInput'
import { DropdownInputControl, getDropdownInputOptions } from './Components/DropdownInput'
import { FloatInputControl } from './Components/FloatInput'
import { joinLines, MultiLineTextInputControl, splitValueIntoLines } from './Components/MultiLineTextInput'
import { JsonTextInputControl, tryParseJson } from './Components/JsonTextInput'

interface IEditAttribute extends IEditAttributeBaseProps {
	type: EditAttributeType
}
export type EditAttributeType =
	| 'text'
	| 'multiline'
	| 'int'
	| 'float'
	| 'checkbox'
	| 'toggle'
	| 'dropdown'
	| 'dropdowntext'
	| 'switch'
	| 'multiselect'
	| 'json'
	| 'colorpicker'
	| 'iconpicker'
	| 'array'
export class EditAttribute extends React.Component<IEditAttribute> {
	render(): JSX.Element {
		if (this.props.type === 'text') {
			return <EditAttributeText {...this.props} />
		} else if (this.props.type === 'multiline') {
			return <EditAttributeMultilineText {...this.props} />
		} else if (this.props.type === 'int') {
			return <EditAttributeInt {...this.props} />
		} else if (this.props.type === 'float') {
			return <EditAttributeFloat {...this.props} />
		} else if (this.props.type === 'checkbox') {
			return <EditAttributeCheckbox {...this.props} />
		} else if (this.props.type === 'switch') {
			return <EditAttributeSwitch {...this.props} />
		} else if (this.props.type === 'toggle') {
			return <EditAttributeToggle {...this.props} />
		} else if (this.props.type === 'dropdown') {
			return <EditAttributeDropdown {...this.props} />
		} else if (this.props.type === 'dropdowntext') {
			return <EditAttributeDropdownText {...this.props} />
		} else if (this.props.type === 'multiselect') {
			return <EditAttributeMultiSelect {...this.props} />
		} else if (this.props.type === 'json') {
			return <EditAttributeJson {...this.props} />
		} else if (this.props.type === 'colorpicker') {
			return <EditAttributeColorPicker {...this.props} />
		} else if (this.props.type === 'iconpicker') {
			return <EditAttributeIconPicker {...this.props} />
		} else if (this.props.type === 'array') {
			return <EditAttributeArray {...this.props} />
		} else {
			assertNever(this.props.type)
		}

		return <div>Unknown edit type {this.props.type}</div>
	}
}

interface IEditAttributeBaseProps {
	updateOnKey?: boolean
	attribute?: string
	collection?: MongoCollection<any>
	myObject?: any
	obj?: any
	options?: any
	optionsAreNumbers?: boolean
	className?: string
	modifiedClassName?: string
	invalidClassName?: string
	updateFunction?: (edit: EditAttributeBase, newValue: any) => void
	overrideDisplayValue?: any
	label?: string
	mutateDisplayValue?: (v: any) => any
	mutateUpdateValue?: (v: any) => any
	disabled?: boolean
	storeJsonAsObject?: boolean
	/** Defaults to string */
	arrayType?: 'boolean' | 'int' | 'float' | 'string'
}
interface IEditAttributeBaseState {
	value: any
	valueError: boolean
	editing: boolean
}
export class EditAttributeBase extends React.Component<IEditAttributeBaseProps, IEditAttributeBaseState> {
	constructor(props: IEditAttributeBaseProps) {
		super(props)

		this.state = {
			value: this.getAttribute(),
			valueError: false,
			editing: false,
		}

		this.handleEdit = this.handleEdit.bind(this)
		this.handleUpdate = this.handleUpdate.bind(this)
		this.handleDiscard = this.handleDiscard.bind(this)
	}
	/** Update the temporary value of this field, optionally saving a value */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected handleEdit(inputValue: any, storeValue?: any): void {
		this.setState({
			value: inputValue,
			editing: true,
		})
		if (this.props.updateOnKey) {
			this.updateValue(storeValue ?? inputValue)
		}
	}
	/** Update and save the value of this field */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected handleUpdate(inputValue: any, storeValue?: any): void {
		this.handleUpdateButDontSave(inputValue)
		this.updateValue(storeValue ?? inputValue)
	}
	/** Update the temporary value of this field, and save it */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected handleUpdateEditing(newValue: any): void {
		this.handleUpdateButDontSave(newValue, true)
		this.updateValue(newValue)
	}
	/** Update the temporary value of this field, marking whether is being edited */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected handleUpdateButDontSave(newValue: any, editing = false): void {
		this.setState({
			value: newValue,
			editing,
		})
	}
	/** Discard the temporary value of this field */
	protected handleDiscard(): void {
		this.setState({
			value: this.getAttribute(),
			editing: false,
		})
	}
	private deepAttribute(obj0: any, attr0: string | undefined): any {
		// Returns a value deep inside an object
		// Example: deepAttribute(company,"ceo.address.street");

		const f = (obj: any, attr: string): any => {
			if (obj) {
				const attributes = attr.split('.')

				if (attributes.length > 1) {
					const outerAttr = attributes.shift() as string
					const innerAttrs = attributes.join('.')

					return f(obj[outerAttr], innerAttrs)
				} else {
					return obj[attributes[0]]
				}
			} else {
				return obj
			}
		}
		return f(obj0, attr0 || '')
	}
	protected getAttribute(): any {
		let v = null
		if (this.props.overrideDisplayValue !== undefined) {
			v = this.props.overrideDisplayValue
		} else {
			v = this.deepAttribute(this.props.myObject, this.props.attribute)
		}
		return this.props.mutateDisplayValue ? this.props.mutateDisplayValue(v) : v
	}

	protected getEditAttribute(): any {
		return this.state.editing ? this.state.value : this.getAttribute()
	}
	private updateValue(newValue: any) {
		if (this.props.mutateUpdateValue) {
			try {
				newValue = this.props.mutateUpdateValue(newValue)
				this.setState({
					valueError: false,
				})
			} catch (e) {
				this.setState({
					valueError: true,
					editing: true,
				})
				return
			}
		}

		if (this.props.updateFunction && typeof this.props.updateFunction === 'function') {
			this.props.updateFunction(this, newValue)
		} else {
			if (this.props.collection && this.props.attribute) {
				if (newValue === undefined) {
					const m: Record<string, 1> = {}
					m[this.props.attribute] = 1
					this.props.collection.update(this.props.obj._id, { $unset: m })
				} else {
					const m: Record<string, any> = {}
					m[this.props.attribute] = newValue
					this.props.collection.update(this.props.obj._id, { $set: m })
				}
			}
		}
	}
}
function wrapEditAttribute(newClass: any) {
	return withTracker((props: IEditAttributeBaseProps) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection ? props.collection.findOne(props.obj._id) : props.obj || {},
		}
	})(newClass)
}

const EditAttributeText = wrapEditAttribute(
	class EditAttributeText extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		private handleChange(value: string) {
			this.handleUpdate(value)
		}
		render(): JSX.Element {
			return (
				<TextInputControl
					classNames={`${this.props.className || ''} ${this.state.valueError ? 'error ' : ''}`}
					modifiedClassName={this.props.modifiedClassName}
					disabled={this.props.disabled}
					placeholder={this.props.label}
					updateOnKey={this.props.updateOnKey}
					value={this.getAttribute() ?? ''}
					handleUpdate={this.handleChange}
				/>
			)
		}
	}
)
const EditAttributeMultilineText = wrapEditAttribute(
	class EditAttributeMultilineText extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		private handleChange(value: string[]) {
			this.handleUpdate(joinLines(value)) // as single string
		}
		render(): JSX.Element {
			return (
				<MultiLineTextInputControl
					classNames={`${this.props.className || ''} ${this.state.valueError ? 'error ' : ''}`}
					modifiedClassName={this.props.modifiedClassName}
					disabled={this.props.disabled}
					placeholder={this.props.label}
					updateOnKey={this.props.updateOnKey}
					value={splitValueIntoLines(this.getAttribute())}
					handleUpdate={this.handleChange}
				/>
			)
		}
	}
)
const EditAttributeInt = wrapEditAttribute(
	class EditAttributeInt extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		private handleChange(value: number) {
			this.handleUpdate(value)
		}
		render(): JSX.Element {
			return (
				<IntInputControl
					classNames={this.props.className || ''}
					modifiedClassName={this.props.modifiedClassName}
					disabled={this.props.disabled}
					placeholder={this.props.label}
					updateOnKey={this.props.updateOnKey}
					value={this.getAttribute() ?? ''}
					handleUpdate={this.handleChange}
				/>
			)
		}
	}
)
const EditAttributeFloat = wrapEditAttribute(
	class EditAttributeFloat extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		private handleChange(value: number) {
			this.handleUpdate(value)
		}
		render(): JSX.Element {
			return (
				<FloatInputControl
					classNames={this.props.className || ''}
					modifiedClassName={this.props.modifiedClassName}
					disabled={this.props.disabled}
					placeholder={this.props.label}
					updateOnKey={this.props.updateOnKey}
					value={this.getAttribute() ?? ''}
					handleUpdate={this.handleChange}
				/>
			)
		}
	}
)
const EditAttributeCheckbox = wrapEditAttribute(
	class EditAttributeCheckbox extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		private handleChange(value: boolean) {
			this.handleUpdate(value)
		}
		render(): JSX.Element {
			const classNames = _.compact([
				this.props.className,
				this.state.editing ? this.props.modifiedClassName : undefined,
			]).join(' ')

			return (
				<label>
					<CheckboxControl
						classNames={classNames}
						value={!!this.getAttribute()}
						handleUpdate={this.handleChange}
						disabled={this.props.disabled}
					/>
				</label>
			)
		}
	}
)
const EditAttributeToggle = wrapEditAttribute(
	class EditAttributeToggle extends EditAttributeBase {
		constructor(props: any) {
			super(props)
		}
		isChecked() {
			return !!this.getEditAttribute()
		}
		handleChange = () => {
			if (!this.props.disabled) {
				this.handleUpdate(!this.state.value)
			}
		}
		handleClick = () => {
			this.handleChange()
		}
		render(): JSX.Element {
			return (
				<div className="mvs">
					<a
						className={ClassNames(
							'switch-button',
							'mrs',
							this.props.className,
							this.state.editing ? this.props.modifiedClassName : undefined,
							this.props.disabled ? 'disabled' : '',
							{
								'sb-on': this.isChecked(),
							}
						)}
						role="button"
						onClick={this.handleClick}
						tabIndex={0}
					>
						<div className="sb-content">
							<div className="sb-label">
								<span className="mls">&nbsp;</span>
								<span className="mrs right">&nbsp;</span>
							</div>
							<div className="sb-switch"></div>
						</div>
					</a>
					<span>{this.props.label}</span>
				</div>
			)
		}
	}
)
const EditAttributeSwitch = wrapEditAttribute(
	class EditAttributeSwitch extends EditAttributeBase {
		constructor(props: any) {
			super(props)
		}
		isChecked() {
			return !!this.getEditAttribute()
		}
		handleChange = () => {
			this.handleUpdate(!this.state.value)
		}
		handleClick = () => {
			this.handleChange()
		}
		render(): JSX.Element {
			return (
				<div
					className={
						'switch ' +
						' ' +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '') +
						' ' +
						(this.isChecked() ? 'switch-active' : '') +
						' ' +
						(this.props.disabled ? 'disabled' : '')
					}
					onClick={this.handleClick}
				>
					{this.props.label}
				</div>
			)
		}
	}
)

const EditAttributeDropdown = wrapEditAttribute(
	class EditAttributeDropdown extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(value: string) {
			this.handleUpdate(this.props.optionsAreNumbers ? parseInt(value, 10) : value)
		}
		render(): JSX.Element {
			const options = getDropdownInputOptions<string>(this.props.options)

			return (
				<DropdownInputControl
					classNames={this.props.className}
					disabled={this.props.disabled}
					value={this.getAttribute()}
					options={options}
					handleUpdate={this.handleChange}
				/>
			)
		}
	}
)
const EditAttributeDropdownText = wrapEditAttribute(
	class EditAttributeDropdownText extends EditAttributeBase {
		private _id: string

		constructor(props: any) {
			super(props)

			this.handleChangeDropdown = this.handleChangeDropdown.bind(this)
			this.handleChangeText = this.handleChangeText.bind(this)
			this.handleBlurText = this.handleBlurText.bind(this)
			this.handleEscape = this.handleEscape.bind(this)

			this._id = getRandomString()
		}
		handleChangeDropdown(event: React.ChangeEvent<HTMLInputElement>) {
			// because event.target.value is always a string, use the original value instead
			const option = _.find(this.getOptions(), (o) => {
				return o.value + '' === event.target.value + ''
			})

			const value = option ? option.value : event.target.value

			this.handleUpdate(this.props.optionsAreNumbers ? Number(value) : value)
		}
		handleChangeText(event: React.ChangeEvent<HTMLInputElement>) {
			this.handleChangeDropdown(event)
		}
		handleBlurText(event: React.FocusEvent<HTMLInputElement>) {
			this.handleUpdate(event.target.value)
		}
		handleEscape(e: React.KeyboardEvent<HTMLInputElement>) {
			if (e.key === 'Escape') {
				this.handleDiscard()
			}
		}
		getOptions() {
			return getDropdownInputOptions(this.props.options)
		}
		render(): JSX.Element {
			return (
				<div className="input-dropdowntext">
					<input
						type="text"
						className={
							'form-control' +
							' ' +
							(this.state.valueError ? 'error ' : '') +
							(this.props.className || '') +
							' ' +
							(this.state.editing ? this.props.modifiedClassName || '' : '')
						}
						placeholder={this.props.label}
						value={this.getEditAttribute() || ''}
						onChange={this.handleChangeText}
						onBlur={this.handleBlurText}
						onKeyUp={this.handleEscape}
						disabled={this.props.disabled}
						spellCheck={false}
						list={this._id}
					/>

					<datalist id={this._id}>
						{this.getOptions().map((o, j) =>
							Array.isArray(o.value) ? (
								<optgroup key={j} label={o.name}>
									{o.value.map((v, i) => (
										<option key={i} value={v + ''}></option>
									))}
								</optgroup>
							) : (
								<option key={o.i} value={o.value + ''}>
									{o.value !== o.name ? o.name : null}
								</option>
							)
						)}
					</datalist>
				</div>
			)
		}
	}
)

interface EditAttributeMultiSelectOptionsResult {
	options: MultiSelectOptions
	currentOptionMissing: boolean
}

const EditAttributeMultiSelect = wrapEditAttribute(
	class EditAttributeMultiSelect extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event: MultiSelectEvent) {
			this.handleUpdate(event.selectedValues)
		}
		getOptions(addOptionsForCurrentValue?: boolean): EditAttributeMultiSelectOptionsResult {
			const options: MultiSelectOptions = {}

			if (Array.isArray(this.props.options)) {
				// is it an enum?
				for (const val of this.props.options) {
					if (typeof val === 'object') {
						options[val.value] = { value: val.name }
					} else {
						options[val] = { value: val }
					}
				}
			} else if (typeof this.props.options === 'object') {
				// Is options an enum?
				const keys = Object.keys(this.props.options)
				const first = this.props.options[keys[0]]
				if (this.props.options[first] + '' === keys[0] + '') {
					// is an enum, only pick
					for (const key in this.props.options) {
						if (!_.isNaN(parseInt(key, 10))) {
							// key is a number (the key)
							const enumValue = this.props.options[key]
							const enumKey = this.props.options[enumValue]
							options[enumKey] = { value: enumValue }
						}
					}
				} else {
					for (const key in this.props.options) {
						const val = this.props.options[key]
						if (Array.isArray(val)) {
							options[key] = { value: val }
						} else {
							options[val] = { value: key + ': ' + val }
						}
					}
				}
			}

			const currentValue = this.getAttribute()
			const missingOptions = Array.isArray(currentValue) ? currentValue.filter((v) => !(v in options)) : []

			if (addOptionsForCurrentValue) {
				missingOptions.forEach((option) => {
					options[option] = { value: `${option}`, className: 'option-missing' }
				})
			}

			return { options, currentOptionMissing: !!missingOptions.length }
		}
		render(): JSX.Element {
			const options = this.getOptions(true)
			return (
				<MultiSelect
					className={ClassNames(this.props.className, options.currentOptionMissing && 'option-missing')}
					availableOptions={options.options}
					value={this.getAttribute()}
					placeholder={this.props.label}
					onChange={this.handleChange}
				></MultiSelect>
			)
		}
	}
)

const EditAttributeJson = wrapEditAttribute(
	class EditAttributeJson extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		private handleChange(value: object) {
			const storeValue = this.props.storeJsonAsObject ? value : JSON.stringify(value, undefined, 2)
			this.handleUpdate(storeValue)
		}
		render(): JSX.Element {
			const value = this.props.storeJsonAsObject ? this.getAttribute() : tryParseJson(this.getAttribute())?.parsed

			return (
				<JsonTextInputControl
					classNames={`${this.props.className || ''} ${
						this.state.valueError ? `${this.props.invalidClassName || 'error'} ` : ''
					}`}
					invalidClassName={this.props.invalidClassName}
					modifiedClassName={this.props.modifiedClassName}
					disabled={this.props.disabled}
					placeholder={this.props.label}
					updateOnKey={this.props.updateOnKey}
					value={value}
					handleUpdate={this.handleChange}
				/>
			)
		}
	}
)
const EditAttributeArray = wrapEditAttribute(
	class EditAttributeArray extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
			this.handleBlur = this.handleBlur.bind(this)
			this.handleEscape = this.handleEscape.bind(this)
		}
		isArray(strOrg: string): { parsed: any[] } | false {
			if (!(strOrg + '').trim().length) return { parsed: [] }

			const values: any[] = []
			const strs = (strOrg + '').split(',')

			for (const str of strs) {
				// Check that the values in the array are of the right type:

				if (this.props.arrayType === 'boolean') {
					const parsed = JSON.parse(str)
					if (typeof parsed !== 'boolean') return false // type check failed
					values.push(parsed)
				} else if (this.props.arrayType === 'int') {
					const parsed = parseInt(str, 10)

					if (Number.isNaN(parsed)) return false // type check failed
					values.push(parsed)
				} else if (this.props.arrayType === 'float') {
					const parsed = parseFloat(str)
					if (Number.isNaN(parsed)) return false // type check failed
					values.push(parsed)
				} else {
					// else this.props.arrayType is 'string'
					const parsed = str + ''
					if (typeof parsed !== 'string') return false // type check failed
					values.push(parsed.trim())
				}
			}
			return { parsed: values }
		}
		handleChange(event: React.ChangeEvent<HTMLInputElement>) {
			const v = event.target.value

			const arrayObj = this.isArray(v)
			if (arrayObj) {
				this.handleEdit(v, arrayObj.parsed)
				this.setState({
					valueError: false,
				})
			} else {
				this.handleUpdateButDontSave(v, true)
			}
		}
		handleBlur(event: React.FocusEvent<HTMLInputElement>) {
			const v = event.target.value

			const arrayObj = this.isArray(v)
			if (arrayObj) {
				this.handleUpdate(v, arrayObj.parsed)
				this.setState({
					valueError: false,
				})
			} else {
				this.handleUpdateButDontSave(v, true)
				this.setState({
					valueError: true,
				})
			}
		}
		handleEscape(e: React.KeyboardEvent<HTMLInputElement>) {
			if (e.key === 'Escape') {
				this.handleDiscard()
			}
		}
		getAttribute() {
			const value = super.getAttribute()
			if (Array.isArray(value)) {
				return value.join(', ')
			} else {
				return ''
			}
		}
		render(): JSX.Element {
			return (
				<input
					type="text"
					className={ClassNames(
						'form-control',
						this.props.className,
						this.state.valueError && this.props.invalidClassName
							? this.props.invalidClassName
							: this.state.editing
							? this.props.modifiedClassName || ''
							: ''
					)}
					placeholder={this.props.label}
					value={this.getEditAttribute() || ''}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					onKeyUp={this.handleEscape}
					disabled={this.props.disabled}
				/>
			)
		}
	}
)

const EditAttributeColorPicker = wrapEditAttribute(
	class EditAttributeColorPicker extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event: ColorPickerEvent) {
			this.handleUpdate(event.selectedValue)
		}
		render(): JSX.Element {
			return (
				<ColorPicker
					className={this.props.className}
					availableOptions={this.props.options}
					value={this.getAttribute()}
					placeholder={this.props.label}
					onChange={this.handleChange}
				></ColorPicker>
			)
		}
	}
)
const EditAttributeIconPicker = wrapEditAttribute(
	class extends EditAttributeBase {
		constructor(props: any) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event: IconPickerEvent) {
			this.handleUpdate(event.selectedValue)
		}
		render(): JSX.Element {
			return (
				<IconPicker
					className={this.props.className}
					availableOptions={this.props.options}
					value={this.getAttribute()}
					placeholder={this.props.label}
					onChange={this.handleChange}
				></IconPicker>
			)
		}
	}
)
