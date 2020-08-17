import * as React from 'react'
import * as _ from 'underscore'
import Escape from 'react-escape'

interface IPropsHeader {
	shown: boolean
}

export class FloatingInspector extends React.Component<IPropsHeader> {
	render() {
		return this.props.shown ? <Escape to="document">{this.props.children}</Escape> : null
	}
}
