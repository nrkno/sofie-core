/*
Please note that the contents of this file is quite unstructured and for test purposes only
*/

import * as React 				from 'react'
import { withTracker }       		from '../lib/ReactMeteorData/react-meteor-data'

import { Task, Tasks } 			from '../../lib/collections/Tasks'
import { Mongo } 				from 'meteor/mongo'

// ----------------------------------------------------------------------------

interface IEditAttribute extends IPropsEditAttributeBase {
	type: string
}
class EditAttribute extends React.Component<IEditAttribute> {
	render () {

		if (this.props.type === 'text') {
			return (
				<EditAttributeText {...this.props} />
			)
		} else if (this.props.type === 'checkbox') {
			return (
				<EditAttributeCheckbox {...this.props} />
			)
		}
	}
}
interface IPropsEditAttributeBase {
	updateOnKey?: boolean,
	attribute: string,
	collection: Mongo.Collection<any>,
	myObject?: any,
	obj?: any
}
interface IStateEditAttributeBase {
	value: any,
	editing: boolean
}
class EditAttributeBase extends React.Component<IPropsEditAttributeBase, IStateEditAttributeBase> {
	constructor (props) {
		super(props)

		this.state = {
			value: this.getAttribute(),
			editing: false
		}

		this.handleEdit 	= this.handleEdit.bind(this)
		this.handleUpdate 	= this.handleUpdate.bind(this)
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
		this.setState({
			value: newValue,
			editing: false
		})

		this.updateValue(newValue)
	}
	deepAttribute (obj,attr): any {
		// Returns a value deep inside an object
		// Example: deepAttribute(company,"ceo.address.street");

		const f = (obj, attr) => {
			if (obj) {
				let attributes = attr.split('.')

				if (attributes.length > 1) {
					let outerAttr = attributes.shift()
					let innerAttrs = attributes.join('.')

					return f(obj[outerAttr],innerAttrs)

				} else {
					return obj[attributes[0]]
				}
			} else {
				return obj
			}
		}
		return f(obj,attr)
	}
	getAttribute () {
		return this.deepAttribute(this.props.myObject, this.props.attribute)
	}
	getAttributeText () {
		return this.getAttribute()
	}
	getEditAttribute () {
		return ( this.state.editing ? this.state.value : this.getAttribute())
	}
	updateValue (newValue) {
		let m = {}
		m[this.props.attribute] = newValue
		this.props.collection.update(this.props.obj._id, {$set: m})
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

		this.handleChange 	= this.handleChange.bind(this)
		this.handleBlur 	= this.handleBlur.bind(this)
	}
	handleChange (event) {
		this.handleEdit(event.target.value)
	}
	handleBlur (event) {
		this.handleUpdate(event.target.value)
	}
	render () {
		console.log('render', this.getEditAttribute())
		return (
			<div>
				<input type='text'
					className='form-control'

					value={this.getEditAttribute()}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
				/>

			</div>
		)
	}
})
const EditAttributeCheckbox = wrapEditAttribute(class extends EditAttributeBase {
	constructor (props) {
		super(props)

		this.handleChange 	= this.handleChange.bind(this)
	}
	isChecked () {
		return !!this.getEditAttribute()
	}
	handleChange (event) {

		this.handleUpdate(!this.state.value)
	}
	render () {
		return (
			<div>
				<input type='checkbox'
					className='form-control'

					checked={this.isChecked()}
					onChange={this.handleChange}
				/>
			</div>
		)
	}
})

// ----------------------------------------------------------------------------

interface IEditTasks {
	tasks: Array<Task>
}
export const EditTasks = withTracker(() => {

	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		tasks: Tasks.find({}, { sort: { createdAt: -1 } }).fetch()
	}
})(
class extends React.Component<IEditTasks> {
	renderTasks () {

		return this.props.tasks.map((task) => (
			<div key={task._id}>
				Edit Task:
				<div>
					Text:
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='text'
						attribute='text'
					/>
				</div>
				<div>
					Text (updated on key):
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='text'
						attribute='text'
						updateOnKey={true}
					/>
				</div>
				<div>
					Checkbox:
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='checkbox'
						attribute='checked'
					/>
					<EditAttribute
						collection={Tasks}
						obj={task}
						type='checkbox'
						attribute='checked'
					/>
				</div>

			</div>
		))
	}
	render () {
		return (
			<div>
				EditTasks
				<div>
					{this.renderTasks()}
				</div>
			</div>
		)
	}
})

// ----------------------------------------------------------------------------

export class NymansPlayground extends React.Component {
	render () {
		return (
			<div>
				<h1>Nyman's playground</h1>
				<div>
					<EditTasks />
				</div>
			</div>
		)
	}
}
