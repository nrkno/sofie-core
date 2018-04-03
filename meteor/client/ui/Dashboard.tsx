import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

interface IPropsHeader {

}
export default class Dashboard extends React.Component<IPropsHeader> {
	render () {
		return (
			<div>
				<div className='mvl'>
					<h1>Welcome to SEFF</h1>
				</div>
			</div>
		)
	}
}
