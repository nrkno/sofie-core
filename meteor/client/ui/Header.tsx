import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import { Link, NavLink } from 'react-router-dom'

interface IPropsHeader {

}
export default class Header extends React.Component<IPropsHeader> {
	render () {
		return (
			<div className='header row'>
				<div className='col c6 dark'>
					<div className='badge mod'>
						<div className='media-elem mrs sofie-logo' />
						<div className='bd mls'><span className='logo-text'>Sofie</span></div>
					</div>
				</div>
				<div className='col c6 dark'>
					<div className='links mod'>
						<NavLink to='/' activeClassName='active'>Home</NavLink>
						<NavLink to='/runningOrders' activeClassName='active'>Running Orders</NavLink>
						<NavLink to='/nymansPlayground' activeClassName='active'>Nyman's Playground</NavLink>
						<NavLink to='/status' activeClassName='active'>Status</NavLink>
					</div>
				</div>
			</div>
		)
	}
}
