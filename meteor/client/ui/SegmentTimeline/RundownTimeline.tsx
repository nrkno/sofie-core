import * as React from 'react'
import * as _ from 'underscore'
import { Rundown } from '../../../lib/collections/Rundowns'

interface IProps {
	key: string
	rundown: Rundown
}
interface IState {}
export class RundownDividerTimeline extends React.Component<IProps, IState> {
	constructor(props, context) {
		super(props, context)
		this.state = {}
	}

	render() {
		return (
			<div className="rundown-divider-timeline">
				<h2 className="rundown-divider-timeline__title">{this.props.rundown.name}</h2>
			</div>
		)
	}
}
