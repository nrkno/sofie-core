import React, { Component } from 'react';

//import {EditAttribute} from 'meteor/superfly:mypackage'; // import from packages

// Task component - represents a single todo item
export default class TaskItem extends Component {
	render() {
		return (
			<li>
				<div>
					{this.props.task.text}
					<div></div>
				</div>
			</li>
		);
	}
}
