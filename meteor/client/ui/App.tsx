import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { translate, InjectedI18nProps } from 'react-i18next'
import * as m from 'moment'
import 'moment/min/locales'
import { parse as queryStringParse } from 'query-string'
import Header from './Header'
import {
	setStudioMode,
	setAdminMode,
	getStudioMode,
	getAdminMode,
	setDeveloperMode,
	setTestingMode,
	getTestingMode
} from '../lib/localStorage'
import Status from './Status'
import Settings from './Settings'
import TestTools from './TestTools'
import { RunningOrderList } from './RunningOrderList'
import { RunningOrderView } from './RunningOrderView'
import { ActiveROView } from './ActiveROView'
import { ClockView } from './ClockView'
import { ConnectionStatusNotification } from './ConnectionStatusNotification'
import { NymansPlayground } from './NymansPlayground'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { PrompterView } from './PrompterView'
import { ModalDialogGlobalContainer } from '../lib/ModalDialog'
import { RunningOrderNotifier } from './RunningOrderView/RunningOrderNotifier'

interface IAppState {
	studioMode: boolean
	adminMode: boolean
	testingMode: boolean
}

const NullComponent = () => null

// App component - represents the whole app
class App extends React.Component<InjectedI18nProps, IAppState> {
	constructor (props) {
		super(props)

		const params = queryStringParse(location.search)

		if (params['studio']) 	setStudioMode(params['studio'] === '1')
		if (params['configure']) setAdminMode(params['configure'] === '1')
		if (params['develop']) setDeveloperMode(params['develop'] === '1')
		if (params['testing']) setTestingMode(params['testing'] === '1')

		this.state = {
			studioMode: getStudioMode(),
			adminMode: getAdminMode(),
			testingMode: getTestingMode()
		}

	}

	componentDidMount () {
		const { i18n } = this.props

		m.locale(i18n.language)
	}

	render () {
		return (
			<Router>
				<div className='container-fluid'>
					{/* Header switch - render the usual header for all pages but the running order view */}
					<ErrorBoundary>
						<Switch>
							<Route path='/ro/:runningOrderId' component={NullComponent} />
							<Route path='/countdowns/:studioId/presenter' component={NullComponent} />
							<Route path='/countdowns/presenter' component={NullComponent} />
							<Route path='/activeRo' component={NullComponent} />
							<Route path='/prompter/:studioId' component={NullComponent} />
							<Route path='/' render={(props) => <Header {...props} adminMode={this.state.adminMode} testingMode={this.state.testingMode} />} />
						</Switch>
					</ErrorBoundary>
					{/* Main app switch */}
					<ErrorBoundary>
						<Switch>
							{/* <Route exact path='/' component={Dashboard} /> */}
							<Route exact path='/' component={RunningOrderList} />
							<Route path='/runningOrders' component={RunningOrderList} />
							<Route path='/ro/:runningOrderId' component={RunningOrderView} />
							<Route path='/activeRo/:studioId' component={ActiveROView} />
							<Route path='/prompter/:studioId' component={PrompterView} />
							{/* <Route path='/activeRo' component={ActiveROView} /> */}
							<Route path='/countdowns/:studioId/presenter' component={ClockView} />
							{/* <Route path='/countdowns/presenter' component={ClockView} /> */}
							<Route path='/nymansPlayground' component={NymansPlayground} />
							<Route path='/status' component={Status} />
							<Route path='/settings' component={Settings} />
							<Route path='/testTools' component={TestTools} />
							<Redirect to='/' />
						</Switch>
					</ErrorBoundary>
					<Switch>
						<Route path='/countdowns/:studioId/presenter' component={NullComponent} />
						<Route path='/countdowns/presenter' component={NullComponent} />
						<Route path='/prompter/:studioId' component={NullComponent} />
						<Route path='/' component={ConnectionStatusNotification} />
					</Switch>
					<Switch>
						<Route path='/ro/:runningOrderId' component={RunningOrderNotifier} />
						<Route path='/activeRo/:studioId' component={RunningOrderNotifier} />
					</Switch>
					<ModalDialogGlobalContainer />
				</div>
			</Router>
		)
	}
}

export default translate()(App)
