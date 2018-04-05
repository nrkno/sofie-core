import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
// import * as withTracker from 'meteor/react-meteor-data';
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import Header from './Header'
import Dashboard from './Dashboard'
import SystemStatus from './SystemStatus'
import { RunningOrderList } from './RunningOrderList'
import { RunningOrderView } from './RunningOrderView'
import { NymansPlayground } from '../ui/NymansPlayground'
import {
  BrowserRouter as Router,
  Route,
  Link
} from 'react-router-dom'

// App component - represents the whole app
class App extends React.Component {
	render () {

		// EXAMPLE IMPLEMENTATION of subscription
		//
		// Subscribe to data
		// Note: we should NOT call the subscription in this place, but instead move it into something handled by the router,
		// so the subscriptions are set/stopped when navigating between pages, or something.
		//
		let sub = Meteor.subscribe('peripheralDevices', {}, { // subscribe to ALL peripherals
			onReady () {
					// called when ready
			},
			onStop () {
					// called when stopped
			}
		})
		// Subscription status available at sub.ready()
		// Stop subscription by calling sub.stop()
		// TEMPORARY subscriptions:
		let sub2 = Meteor.subscribe('runningOrders', {})
		let sub3 = Meteor.subscribe('segments', {})
		let sub4 = Meteor.subscribe('segmentLines', {})
		let sub5 = Meteor.subscribe('segmentLineItems', {})
		let sub6 = Meteor.subscribe('studioInstallations', {})
		let sub7 = Meteor.subscribe('showStyles', {})

		return (
			<Router>
				<div className='container-fluid'>
					<Header />
					<Route exact path='/' component={Dashboard} />
					<Route exact path='/runningOrders' component={RunningOrderList} />
					<Route path='/ro/:runningOrderId' component={RunningOrderView} />
					<Route path='/nymansPlayground' component={NymansPlayground} />
					<Route path='/status' component={SystemStatus} />
				</div>
			</Router>
		)
	}
}

export default App
