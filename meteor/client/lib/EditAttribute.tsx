import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

interface IEditAttribute extends IPropsEditAttributeBase {
	type: string
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
		} else if (this.props.type === 'dropdown') {
			return (
				<EditAttributeDropdown {...this.props} />
			)
		}

		return <div>Unknown edit type {this.props.type}</div>
	}
}

interface IPropsEditAttributeBase {
	updateOnKey?: boolean,
	attribute: string,
	collection: Mongo.Collection<any>,
	myObject?: any,
	obj?: any
	options?: any
	optionsAreNumbers?: boolean
	className?: string
	modifiedClassName?: string
	updateFunction?: (edit: EditAttributeBase, newValue: any ) => void
	overrideDisplayValue?: any
}
interface IStateEditAttributeBase {
	value: any,
	editing: boolean
}
export class EditAttributeBase extends React.Component<IPropsEditAttributeBase, IStateEditAttributeBase> {
	constructor (props) {
		super(props)

		this.state = {
			value: this.getAttribute(),
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
		return f(obj, attr)
	}
	getAttribute () {
		if (this.props.overrideDisplayValue) return this.props.overrideDisplayValue
		return this.deepAttribute(this.props.myObject, this.props.attribute)
	}
	getAttributeText () {
		return this.getAttribute()
	}
	getEditAttribute () {
		return (this.state.editing ? this.state.value : this.getAttribute())
	}
	updateValue (newValue) {
		if (this.props.updateFunction && typeof this.props.updateFunction === 'function') {
			this.props.updateFunction(this, newValue)
		} else {
			let m = {}
			m[this.props.attribute] = newValue
			this.props.collection.update(this.props.obj._id, { $set: m })
		}

	}
}
let wrapEditAttribute = (newClass) => {
	return withTracker((props) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection.findOne(props.obj._id)
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
				className={'form-control' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

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
				className={'form-control' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

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
			<input type='checkbox'
				className={'form-control' + ' ' + (this.props.className || '') + ' ' + (this.state.editing ? (this.props.modifiedClassName || '') : '')}

				checked={this.isChecked()}
				onChange={this.handleChange}
			/>
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
