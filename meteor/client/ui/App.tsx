import * as React from 'react'
import { translate, InjectedI18nProps } from 'react-i18next'
import * as m from 'moment'
import 'moment/min/locales'
import { parse as queryStringParse } from 'query-string'
import Header from './Header'
import {
	setAllowStudio,
	setAllowConfigure,
	getAllowStudio,
	getAllowConfigure,
	setAllowDeveloper,
	setAllowTesting,
	getAllowTesting,
	getAllowDeveloper,
	setAllowSpeaking,
	setAllowService,
	getAllowService,
	setHelpMode,
	setUIZoom,
	getUIZoom
} from '../lib/localStorage'
import Status from './Status'
import SettingsComponent from './Settings'
import TestTools from './TestTools'
import { RundownList } from './RundownList'
import { RundownView } from './RundownView'
import { ActiveRundownView } from './ActiveRundownView'
import { ClockView } from './ClockView'
import { ConnectionStatusNotification } from './ConnectionStatusNotification'
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect
} from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { PrompterView } from './Prompter/PrompterView'
import { ModalDialogGlobalContainer } from '../lib/ModalDialog'
import { Settings } from '../../lib/Settings'
import { LoginPage } from './LoginPage'
import { SignupPage } from './SignupPage'
import { RequestResetPage } from './RequestResetPage'
import { ResetPage } from './ResetPage'
import { AccountPage } from './AccountPage';

interface IAppState {
	allowStudio: boolean
	allowConfigure: boolean
	allowTesting: boolean
	allowDeveloper: boolean
	allowService: boolean
}

const NullComponent = () => null

const CRON_INTERVAL = 30 * 60 * 1000
const LAST_RESTART_LATENCY = 3 * 60 * 60 * 1000
const WINDOW_START_HOUR = 3
const WINDOW_END_HOUR = 5

const authenticate = {
	auth: false,
	login: function() {
		this.auth = true
	},
	logout: function() {
		this.auth = false
	}
}

const ProtectedRoute = ({component: Component, ...args}: any) => {
	if(!Settings.enableUserAccounts) {
		return <Route {...args} render={Component}/>
	} else {
		return <Route {...args} render={(props) => (
			authenticate.auth 
				? <Component {...props} />
				: <Redirect to='/' />
		)}/>
	}
	
}

// App component - represents the whole app
class App extends React.Component<InjectedI18nProps, IAppState> {
	private lastStart = 0
	

	constructor (props) {
		super(props)

		const params = queryStringParse(location.search)

		if (params['studio']) 	setAllowStudio(params['studio'] === '1')
		if (params['configure']) setAllowConfigure(params['configure'] === '1')
		if (params['develop']) setAllowDeveloper(params['develop'] === '1')
		if (params['testing']) setAllowTesting(params['testing'] === '1')
		if (params['speak']) setAllowSpeaking(params['speak'] === '1')
		if (params['service']) setAllowService(params['service'] === '1')
		if (params['help']) setHelpMode(params['help'] === '1')
		if (params['zoom'] && typeof params['zoom'] === 'string') {
			setUIZoom(parseFloat(params['zoom'] as string || '1') / 100 || 1)
		}

		if (params['admin']) {
			const val = params['admin'] === '1'
			setAllowStudio(val)
			setAllowConfigure(val)
			setAllowDeveloper(val)
			setAllowTesting(val)
			setAllowService(val)
		}

		this.state = {
			allowStudio: getAllowStudio(),
			allowConfigure: getAllowConfigure(),
			allowTesting: getAllowTesting(),
			allowDeveloper: getAllowDeveloper(),
			allowService: getAllowService()
		}

		this.lastStart = Date.now()
		this.updateLoggedInStatus = this.updateLoggedInStatus.bind(this)
	}
	cronJob = () => {
		const now = new Date()
		const hour = now.getHours() + (now.getMinutes() / 60)
		// if the time is between 3 and 5
		if ((hour >= WINDOW_START_HOUR) && (hour < WINDOW_END_HOUR) &&
		// and the previous restart happened more than 3 hours ago
			(Date.now() - this.lastStart > LAST_RESTART_LATENCY) &&
		// and not in an active rundown
			(document.querySelector('.rundown.active') === null)
		) {
			// forceReload is marked as deprecated, but it's still usable
			// tslint:disable-next-line
			setTimeout(() => window.location.reload(true))
		}
	}

	updateLoggedInStatus (status: boolean) {
		status ? authenticate.login() : authenticate.logout()
	}


	componentDidMount () {
		const { i18n } = this.props

		m.locale(i18n.language)
		document.documentElement.lang = i18n.language
		setInterval(this.cronJob, CRON_INTERVAL)

		const uiZoom = getUIZoom()
		if (uiZoom !== 1) {
			document.documentElement.style.fontSize = (uiZoom * 16) + 'px'
		}
	}

	render () {
		console.log(Settings)
		return (
			<Router>
				<div className='container-fluid'>
					{/* Header switch - render the usual header for all pages but the rundown view */}
					<ErrorBoundary>
						<Switch>
							<Route path='/rundown/:playlistId' component={NullComponent} />
							<Route path='/countdowns/:studioId/presenter' component={NullComponent} />
							<Route path='/countdowns/presenter' component={NullComponent} />
							<Route path='/activeRundown' component={NullComponent} />
							<Route path='/prompter/:studioId' component={NullComponent} />
							<Route path='/' render={(props) => <Header {...props} allowConfigure={this.state.allowConfigure} allowTesting={this.state.allowTesting} allowDeveloper={this.state.allowDeveloper} />} />
						</Switch>
					</ErrorBoundary>
					{/* Main app switch */}
					<ErrorBoundary>
						<Switch>
							{Settings.enableUserAccounts ?
								[
									<Route exact path='/' component={(props) => <LoginPage updateLoggedInStatus={this.updateLoggedInStatus} {...props}/>} />,
									<Route exact path='/login' component={() => <Redirect to='/'/>}/>,
									<Route exact path='/signup' component={SignupPage} />,
									<Route exact path='/reset' component={RequestResetPage} />,
									<Route exact path='/reset/:token' component={ResetPage} />,
									<ProtectedRoute exact path='/account' component={AccountPage} />,
									<ProtectedRoute exact path='/lobby' component={RundownList} />
								]:
								<Route exact path='/' component={RundownList} />
							}
							<ProtectedRoute path='/rundowns' component={RundownList} />
							<ProtectedRoute path='/rundown/:playlistId' component={RundownView} />
							<ProtectedRoute path='/activeRundown/:studioId' component={ActiveRundownView} />
							<ProtectedRoute path='/prompter/:studioId' component={PrompterView} />
							<ProtectedRoute path='/countdowns/:studioId/presenter' component={ClockView} />
							<ProtectedRoute path='/status' component={Status} />
							<ProtectedRoute path='/settings' component={SettingsComponent} />
							<Route path='/testTools' component={TestTools} />
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<Switch>
							{/* Put views that should NOT have the Notification center here: */}
							<Route path='/countdowns/:studioId/presenter' component={NullComponent} />
							<Route path='/countdowns/presenter' component={NullComponent} />
							<Route path='/prompter/:studioId' component={NullComponent} />

							<Route path='/' component={ConnectionStatusNotification} />
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<ModalDialogGlobalContainer />
					</ErrorBoundary>
				</div>
			</Router>
		)
	}
}

export default translate()(App)
