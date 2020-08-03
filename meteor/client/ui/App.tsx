import * as React from 'react'
import { withTranslation, WithTranslation } from 'react-i18next'
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
	getUIZoom,
} from '../lib/localStorage'
import Status from './Status'
import Settings from './Settings'
import TestTools from './TestTools'
import { RundownList } from './RundownList'
import { RundownView } from './RundownView'
import { ActiveRundownView } from './ActiveRundownView'
import { ClockView } from './ClockView'
import { ConnectionStatusNotification } from './ConnectionStatusNotification'
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { PrompterView } from './Prompter/PrompterView'
import { ModalDialogGlobalContainer } from '../lib/ModalDialog'

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

// App component - represents the whole app
class App extends React.Component<WithTranslation, IAppState> {
	private lastStart = 0

	constructor(props) {
		super(props)

		const params = queryStringParse(location.search)

		if (params['studio']) setAllowStudio(params['studio'] === '1')
		if (params['configure']) setAllowConfigure(params['configure'] === '1')
		if (params['develop']) setAllowDeveloper(params['develop'] === '1')
		if (params['testing']) setAllowTesting(params['testing'] === '1')
		if (params['speak']) setAllowSpeaking(params['speak'] === '1')
		if (params['service']) setAllowService(params['service'] === '1')
		if (params['help']) setHelpMode(params['help'] === '1')
		if (params['zoom'] && typeof params['zoom'] === 'string') {
			setUIZoom(parseFloat((params['zoom'] as string) || '1') / 100 || 1)
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
			allowService: getAllowService(),
		}

		this.lastStart = Date.now()
	}

	cronJob = () => {
		const now = new Date()
		const hour = now.getHours() + now.getMinutes() / 60
		// if the time is between 3 and 5
		if (
			hour >= WINDOW_START_HOUR &&
			hour < WINDOW_END_HOUR &&
			// and the previous restart happened more than 3 hours ago
			Date.now() - this.lastStart > LAST_RESTART_LATENCY &&
			// and not in an active rundown
			document.querySelector('.rundown.active') === null
		) {
			// forceReload is marked as deprecated, but it's still usable
			// tslint:disable-next-line
			setTimeout(() => window.location.reload(true))
		}
	}

	componentDidMount() {
		const { i18n } = this.props

		document.body.classList.add('tv2')

		m.locale(i18n.language)
		document.documentElement.lang = i18n.language
		setInterval(this.cronJob, CRON_INTERVAL)

		const uiZoom = getUIZoom()
		if (uiZoom !== 1) {
			document.documentElement.style.fontSize = uiZoom * 16 + 'px'
		}
	}

	render() {
		return (
			<Router>
				<div className="container-fluid">
					{/* Header switch - render the usual header for all pages but the rundown view */}
					<ErrorBoundary>
						<Switch>
							<Route path="/rundown/:playlistId" component={NullComponent} />
							<Route path="/countdowns/:studioId/presenter" component={NullComponent} />
							<Route path="/countdowns/presenter" component={NullComponent} />
							<Route path="/activeRundown" component={NullComponent} />
							<Route path="/prompter/:studioId" component={NullComponent} />
							<Route
								path="/"
								render={(props) => (
									<Header
										{...props}
										allowConfigure={this.state.allowConfigure}
										allowTesting={this.state.allowTesting}
										allowDeveloper={this.state.allowDeveloper}
									/>
								)}
							/>
						</Switch>
					</ErrorBoundary>
					{/* Main app switch */}
					<ErrorBoundary>
						<Switch>
							{/* <Route exact path='/' component={Dashboard} /> */}
							<Route exact path="/" component={RundownList} />
							<Route path="/rundowns" component={RundownList} />
							<Route path="/rundown/:playlistId" component={RundownView} exact />
							<Route
								path="/rundown/:playlistId/shelf"
								exact
								render={(props) => <RundownView {...props} onlyShelf={true} />}
							/>
							<Route path="/activeRundown/:studioId" component={ActiveRundownView} />
							<Route path="/prompter/:studioId" component={PrompterView} />
							<Route path="/countdowns/:studioId/presenter" component={ClockView} />
							<Route path="/status" component={Status} />
							<Route path="/settings" component={Settings} />
							<Route path="/testTools" component={TestTools} />
							<Redirect to="/" />
						</Switch>
					</ErrorBoundary>
					<ErrorBoundary>
						<Switch>
							{/* Put views that should NOT have the Notification center here: */}
							<Route path="/countdowns/:studioId/presenter" component={NullComponent} />
							<Route path="/countdowns/presenter" component={NullComponent} />
							<Route path="/prompter/:studioId" component={NullComponent} />

							<Route path="/" component={ConnectionStatusNotification} />
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

export default withTranslation()(App)
