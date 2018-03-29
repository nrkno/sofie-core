import * as React from 'react'

import { Task } from '../../lib/collections/Tasks'

// import {EditAttribute} from 'meteor/superfly:mypackage'; // import from packages

// Task component - represents a single todo item
interface IPropsTaskItem {
	task: Task,
}
export default class TaskItem extends React.Component<IPropsTaskItem> {
	render () {
		return (
			<li>
				<div>
					{this.props.task.text}
					<div></div>
				</div>
			</li>
		)
	}
}
