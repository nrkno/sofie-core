import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from './ReactMeteorData/react-meteor-data'
import * as faCheckSquare from '@fortawesome/fontawesome-free-solid/faCheckSquare'
import * as faSquare from '@fortawesome/fontawesome-free-solid/faSquare'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { Mongo } from 'meteor/mongo'

interface IEditAttribute extends IEditAttributeBaseProps {
	type: 'text' | 'multiline' | 'int' | 'checkbox' | 'dropdown' | 'switch'
}
export class EditAttribute extends React.Component<IEditAttribute> {
	render () {

		if (this.props.type === 'text') {
			return (
				<EditAttributeText {...this.props} />
			)
		} else if (this.props.type === 'multiline') {
			return (
				<EditAttributeMultilineText {...this.props} />
			)
		} else if (this.props.type === 'int') {
			return (
				<EditAttributeInt {...this.props} />
			)
		} else if (this.props.type === 'checkbox') {
			return (
				<EditAttributeCheckbox {...this.props} />
			)
		} else if (this.props.type === 'switch') {
			return (
				<EditAttributeSwitch {...this.props} />
			)
		} else if (this.props.type === 'dropdown') {
			return (
				<EditAttributeDropdown {...this.props} />
			)
		}

		return <div>Unknown edit type {this.props.type}</div>
	}
}

interface IEditAttributeBaseProps {
	updateOnKey?: boolean,
	attribute?: string,
	collection?: Mongo.Collection<any>,
	myObject?: any,
	obj?: any
	options?: any
	optionsAreNumbers?: boolean
	className?: string
	modifiedClassName?: string
	updateFunction?: (edit: EditAttributeBase, newValue: any ) => void
	overrideDisplayValue?: any
	label?: string
	mutateDisplayValue?: any
	mutateUpdateValue?: any
}
interface IEditAttributeBaseState {
	value: any,
	valueError: boolean,
	editing: boolean
}
export class EditAttributeBase extends React.Component<IEditAttributeBaseProps, IEditAttributeBaseState> {
	constructor (props) {
		super(props)

		this.state = {
			value: this.getAttribute(),
			valueError: false,
			editing: false
		}

		this.handleEdit = this.handleEdit.bind(this)
		this.handleUpdate = this.handleUpdate.bind(this)
		this.handleDiscard = this.handleDiscard.bind(this)
	}
	handleEdit (newValue) {
		this.setState({
			value: newValue,
			editing: true
		})
		if (this.props.updateOnKey) {
			this.updateValue(newValue)
		}
	}
	handleUpdate (newValue) {
		this.handleUpdateButDontSave(newValue)
		this.updateValue(newValue)
	}
	handleUpdateButDontSave (newValue) {
		this.setState({
			value: newValue,
			editing: false
		})
	}
	handleDiscard () {
		console.log('discard')
		this.setState({
			value: this.getAttribute(),
			editing: false
		})
	}
	deepAttribute (obj, attr): any {
		// Returns a value deep inside an object
		// Example: deepAttribute(company,"ceo.address.street");

		const f = (obj, attr) => {
			if (obj) {
				let attributes = attr.split('.')

				if (attributes.length > 1) {
					let outerAttr = attributes.shift()
					let innerAttrs = attributes.join('.')

					return f(obj[outerAttr], innerAttrs)

				} else {
					return obj[attributes[0]]
				}
			} else {
				return obj
			}
		}
		return f(obj, attr || '')
	}
	getAttribute () {
		let v = null
		if (this.props.overrideDisplayValue) {
			v = this.props.overrideDisplayValue
		} else {
			v = this.deepAttribute(this.props.myObject, this.props.attribute)
		}
		return this.props.mutateDisplayValue ? this.props.mutateDisplayValue(v) : v
	}
	getAttributeText () {
		return this.getAttribute()
	}
	getEditAttribute () {
		return (this.state.editing ? this.state.value : this.getAttribute())
	}
	updateValue (newValue) {
		if (this.props.mutateUpdateValue) {
			try {
				newValue = this.props.mutateUpdateValue(newValue)
				this.setState({
					valueError: false
				})
			} catch (e) {
				this.setState({
					valueError: true,
					editing: true
				})
				return
			}
		}

		if (this.props.updateFunction && typeof this.props.updateFunction === 'function') {
			this.props.updateFunction(this, newValue)
		} else {
			if (this.props.collection && this.props.attribute) {
				let m = {}
				m[this.props.attribute] = newValue
				this.props.collection.update(this.props.obj._id, { $set: m })
			}
		}

	}
}
function wrapEditAttribute (newClass) {
	return withTracker((props: IEditAttributeBaseProps) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection ? props.collection.findOne(props.obj._id) : (props.obj || {})
		}
	})(newClass)
}

const EditAttributeText = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange = this.handleChange.bind(this)
		this.handleBlur = this.handleBlur.bind(this)
		this.handleEscape = this.handleEscape.bind(this)
	}
	handleChange (event) {
		this.handleEdit(event.target.value)
	}
	handleBlur (event) {
		this.handleUpdate(event.target.value)
	}
	handleEscape (event) {
		let e = event as KeyboardEvent
		if (e.key === 'Escape') {
			this.handleDiscard()
		}
	}
	render () {
		return (
			<input type='text'
				className={'form-control' + ' ' + (this.state.valueError ? 'error ' : '') + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

				value={this.getEditAttribute() || ''}
				onChange={this.handleChange}
				onBlur={this.handleBlur}
				onKeyUp={this.handleEscape}
			/>
		)
	}
})
const EditAttributeMultilineText = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange = this.handleChange.bind(this)
		this.handleBlur = this.handleBlur.bind(this)
		this.handleEscape = this.handleEscape.bind(this)
	}
	handleChange (event) {
		this.handleEdit(event.target.value)
	}
	handleBlur (event) {
		this.handleUpdate(event.target.value)
	}
	handleEscape (event) {
		let e = event as KeyboardEvent
		if (e.key === 'Escape') {
			this.handleDiscard()
		}
	}
	render () {
		return (
			<textarea
				className={'form-control' + ' ' + (this.state.valueError ? 'error ' : '') + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

				value={this.getEditAttribute() || ''}
				onChange={this.handleChange}
				onBlur={this.handleBlur}
				onKeyUp={this.handleEscape}
			/>
		)
	}
})
const EditAttributeInt = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange = this.handleChange.bind(this)
		this.handleBlur = this.handleBlur.bind(this)
	}
	getValue (event) {
		return parseInt(event.target.value, 10)
	}
	handleChange (event) {
		// this.handleEdit(this.getValue(event))
		let v = this.getValue(event)
		_.isNaN(v) ? this.handleUpdateButDontSave(v) : this.handleUpdate(v)
	}
	handleBlur (event) {
		let v = this.getValue(event)
		_.isNaN(v) ? this.handleDiscard() : this.handleUpdate(v)
	}
	getEditAttributeNumber () {
		let val = this.getEditAttribute()
		if (_.isNaN(val)) val = 'NaN'
		return val
	}
	render () {
		return (
			<input type='number'
				step='1'
				className={'form-control' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

				value={this.getEditAttributeNumber()}
				onChange={this.handleChange}
				onBlur={this.handleBlur}
			/>
		)
	}
})
const EditAttributeCheckbox = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange = this.handleChange.bind(this)
	}
	isChecked () {
		return !!this.getEditAttribute()
	}
	handleChange (event) {

		this.handleUpdate(!this.state.value)
	}
	render () {
		return (
			<label>
				<span className='checkbox'>
					<input type='checkbox'
						className={'form-control' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

						checked={this.isChecked()}
						onChange={this.handleChange}
					/>
					<span className='checkbox-checked'><FontAwesomeIcon icon={faCheckSquare} /></span>
					<span className='checkbox-unchecked'><FontAwesomeIcon icon={faSquare} /></span>
				</span>
			</label>
		)
	}
})

const EditAttributeSwitch = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)
	}
	isChecked () {
		return !!this.getEditAttribute()
	}
	handleChange = (event) => {
		this.handleUpdate(!this.state.value)
	}
	handleClick = (event) => {
		this.handleChange(event)
	}
	render () {
		return (
			<div
				className={'switch ' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '') + ' ' + (this.isChecked() ? 'switch-active' : '')}

				onClick={this.handleClick}
			>
				{this.props.label}
			</div>
		)
	}
})
const EditAttributeDropdown = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange = this.handleChange.bind(this)
	}
	handleChange (event) {
		this.handleUpdate(this.props.optionsAreNumbers !== undefined ? parseInt(event.target.value, 10) : event.target.value)
	}
	getOptions () {
		let options: Array<{ value: any, name: string, i?: number }> = []

		if (Array.isArray(this.props.options)) {
			// is it an enum?
			for (let key in this.props.options) {
				let val = this.props.options[key]
				if (typeof val === 'object') {
					options.push({
						name: val.name,
						value: val.value
					})
				} else {
					options.push({
						name: val,
						value: val
					})
				}
			}
		} else if (typeof this.props.options === 'object') {

			// Is options an enum?
			let keys = Object.keys(this.props.options)
			let first = this.props.options[keys[0]]
			if ((this.props.options[first] + '') === (keys[0] + '')) {
				// is an enum, only pick
				for (let key in this.props.options) {
					if ( !_.isNaN(parseInt(key, 10)) ) {
						let val = this.props.options[key]
						options.push({
							name: val,
							value: key
						})
					}
				}
			} else {

				for (let key in this.props.options) {
					let val = this.props.options[key]
					options.push({
						name: key + ': ' + val,
						value: val
					})
				}
			}

		}

		for (let i = 0; i < options.length; i++) {
			options[i].i = i
		}

		return options
	}
	componentDidMount () {
		let availableOptions = this.getOptions()
		let initialValue = this.getAttribute()
		// set the value to the first one (default), if value not within available options
		// and availableOptions has any items
		if (!availableOptions.find((item) => {
			if (this.props.optionsAreNumbers) {
				return (item.value === (initialValue + ''))
			} else {
				return (item.value === initialValue)
			}
		}) && availableOptions.length > 0) {
			this.handleUpdate(this.props.optionsAreNumbers !== undefined ? parseInt(availableOptions[0].value, 10) : availableOptions[0].value)
		}
	}
	// getAttributeOption () {
	// }
	render () {
		return (
			<select
				className={'form-control' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

				value={this.getAttribute()}
				onChange={this.handleChange}
			>
				{this.getOptions().map((o) => (
					<option key={o.i} value={o.value}>{o.name}</option>
				))}
			</select>
		)
	}
})
