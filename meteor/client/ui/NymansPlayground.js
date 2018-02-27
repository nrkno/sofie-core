/*
Please note that the contents of this file is quite unstructured and for test purposes only
*/
import React, { Component } 	from 'react';
import { withTracker } 			from 'meteor/react-meteor-data';

import { Tasks } 				from '/lib/collections/tasks.js';

//import {EditAttribute} from 'meteor/superfly:mypackage'; // import from packages

// ----------------------------------------------------------------------------
class EditAttribute extends Component {
	render() {

		if (this.props.type === "text") {
			return (
				<EditAttributeText {...this.props} />
			);
		} else if (this.props.type === "checkbox") {
			return (
				<EditAttributeCheckbox {...this.props} />
			);
		}
	}
}

class EditAttributeBase extends Component {
	constructor(props) {
		super(props);

		
		this.state = {
			value: this.getAttribute(),
			editing: false
		};

		this.handleEdit 	= this.handleEdit.bind(this)
		this.handleUpdate 	= this.handleUpdate.bind(this)
	}
	handleEdit(newValue) {
		this.setState({
			value: newValue,
			editing: true
		});
		if (this.props.updateOnKey) {
			this.updateValue(newValue);
		}
	}
	handleUpdate(newValue) {
		this.setState({
			value: newValue,
			editing: false
		});

		this.updateValue(newValue);
	}
	deepAttribute(obj,attr) {
		// Returns a value deep inside an object
		// Example: deepAttribute(company,"ceo.address.street");

		const f = (obj) => {
			if (obj) {
				var attributes = attr.split(".");
				
				if (attributes.length > 1) {
					var outerAttr = attributes.shift();
					var innerAttrs = attributes.join(".");
					
					return f(obj[outerAttr],innerAttrs);
					
				} else {
					return obj[attributes[0]];
				}
			} else {
				return obj;
			}
		}
		return f(obj,attr);
	}
	getAttribute() {
		return this.deepAttribute(this.props.myObject, this.props.attribute);
	}
	getAttributeText() {
		return this.getAttribute();
	}
	getEditAttribute() {
		return ( this.state.editing ? this.state.value : this.getAttribute());
	}
	updateValue(newValue) {
		var m = {};
		m[this.props.attribute] = newValue;
		this.props.collection.update(this.props.obj._id, {$set: m});
	}
}
var wrapEditAttribute = (newClass) => {
	return withTracker((props) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection.findOne(props.obj._id)
		};
	})(newClass);
};

const EditAttributeText = wrapEditAttribute(class extends EditAttributeBase {
	constructor(props) {
		super(props);

		this.handleChange 	= this.handleChange.bind(this)
		this.handleBlur 	= this.handleBlur.bind(this)
	}
	handleChange(event) {
		this.handleEdit(event.target.value);
	}
	handleBlur(event) {
		this.handleUpdate(event.target.value);
	}
	render() {
		console.log('render', this.getEditAttribute());
		return (
			<div>
				<input type='text' 
					className='form-control' 
					

					value={this.getEditAttribute()}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
				/>
				
				
			</div>
		);
	}
});
const EditAttributeCheckbox = wrapEditAttribute(class extends EditAttributeBase {
	constructor(props) {
		super(props);

		this.handleChange 	= this.handleChange.bind(this)
	}
	isChecked() {
		return !!this.getEditAttribute();
	}
	handleChange(event) {

		this.handleUpdate(!this.state.value);
	}
	render() {
		return (
			<div>
				<input type='checkbox' 
					className='form-control' 
					

					checked={this.isChecked()}
					onChange={this.handleChange}
				/>
			</div>
		);
	}
});



// ----------------------------------------------------------------------------
const EditTasks = withTracker(() => {
	
	
	// These properties will be exposed under this.props
	// Note that these properties are reactively recalculated
	return {
		tasks: Tasks.find({}, { sort: { createdAt: -1 } }).fetch(),
	};
})(
class extends Component {
	renderTasks() {
		
		return this.props.tasks.map((task) => (
			<div key={task._id}>
				Edit Task:
				<div>
					Text:
					<EditAttribute 
						collection={Tasks}
						obj={task} 
						type="text" 
						attribute="text" 
					/>
				</div>
				<div>
					Text (updated on key):
					<EditAttribute 
						collection={Tasks}
						obj={task} 
						type="text" 
						attribute="text"
						updateOnKey="1"
					/>
				</div>
				<div>
					Checkbox:
					<EditAttribute 
						collection={Tasks}
						obj={task} 
						type="checkbox" 
						attribute="checked"
					/>
					<EditAttribute 
						collection={Tasks}
						obj={task} 
						type="checkbox" 
						attribute="checked"
					/>
				</div>
				
			</div>
		));
	}
	render() {
		return (
			<div>
				EditTasks
				<div>
					{this.renderTasks()}
				</div>
			</div>
		);
	}
});

// ----------------------------------------------------------------------------

 class NymansPlayground extends Component {
	render() {
		return (
			<div>
				<h1>Nyman's playground</h1>
				<div>
					<EditTasks />
				</div>
			</div>
		);
	}
}


export default NymansPlayground;