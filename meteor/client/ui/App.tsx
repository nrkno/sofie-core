import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { translate, InjectedI18nProps } from 'react-i18next'
import * as m from 'moment'
import 'moment/min/locales'
import { parse as queryStringParse } from 'query-string'
import Header from './Header'
import Dashboard from './Dashboard'
import Status from './Status'
import Settings from './Settings'
import { RunningOrderList } from './RunningOrderList'
import { RunningOrderView } from './RunningOrderView'
import { ClockView } from './ClockView'
import { ConnectionStatusNotification } from './ConnectionStatusNotification'
import { NymansPlayground } from './NymansPlayground'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { ErrorBoundary } from '../lib/ErrorBoundary'

interface IAppState {
	studioMode: boolean
}

const NullComponent = () => null

// App component - represents the whole app
class App extends React.Component<InjectedI18nProps, IAppState> {
	constructor (props) {
		super(props)

		const params = queryStringParse(location.search)

		this.state = {
			studioMode: params['studio'] !== undefined ? true : false
		}

		if (this.state.studioMode) {
			localStorage.setItem('studioMode', '1')
		}
	}

	render () {
		const { i18n } = this.props

		m.locale(i18n.language)

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
		let sub8 = Meteor.subscribe('timeline', {})

		Tracker.autorun(() => {
			// temporary implementation:
			let studio = StudioInstallations.findOne()
			if (studio) {
				let sub9 = Meteor.subscribe('mediaObjects', studio._id, {})
			}
		})

		return (
			<Router>
				<div className='container-fluid'>
					{/* Header switch - render the usual header for all pages but the running order view */}
					<ErrorBoundary>
						<Switch>
							<Route path='/ro/:runningOrderId' component={NullComponent} />
							<Route path='/countdowns/presenter' component={NullComponent} />
							<Route path='/' component={Header} />
						</Switch>
					</ErrorBoundary>
					{/* Main app switch */}
					<ErrorBoundary>
						<Switch>
							<Route exact path='/' component={Dashboard} />
							<Route path='/runningOrders' component={RunningOrderList} />
							<Route path='/ro/:runningOrderId' component={RunningOrderView} />
							<Route path='/countdowns/presenter' component={ClockView} />
							<Route path='/nymansPlayground' component={NymansPlayground} />
							<Route path='/status' component={Status} />
							<Route path='/settings' component={Settings} />
							<Redirect to='/' />
						</Switch>
					</ErrorBoundary>
					<ConnectionStatusNotification />
				</div>
			</Router>
		)
	}
}

export default translate()(App)
