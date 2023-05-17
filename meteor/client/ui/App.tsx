import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
	setAllowVibrating,
	setAllowService,
	getAllowService,
	setHelpMode,
	setUIZoom,
	getUIZoom,
	setShowHiddenSourceLayers,
	setIgnorePieceContentStatus,
	setShelfFollowsOnAir,
	setReportNotifications,
	unsetReportNotifications,
	getShelfFollowsOnAir,
	getAllowSpeaking,
	getAllowVibrating,
	getShowHiddenSourceLayers,
	getIgnorePieceContentStatus,
	getHelpMode,
	getReportNotifications,
} from '../lib/localStorage'
import Status from './Status'
import { Settings as SettingsView } from './Settings'
import TestTools from './TestTools'
import { RundownList } from './RundownList'
import { RundownView } from './RundownView'
import { ActiveRundownView } from './ActiveRundownView'
import { ClockView } from './ClockView/ClockView'
import { ConnectionStatusNotification } from '../lib/ConnectionStatusNotification'
import { BrowserRouter as Router, Route, Switch, Redirect, useHistory } from 'react-router-dom'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { PrompterView } from './Prompter/PrompterView'
import { ModalDialogGlobalContainer, doModalDialog } from '../lib/ModalDialog'
import { Settings } from '../../lib/Settings'
import { LoginPage } from './Account/NotLoggedIn/LoginPage'
import { SignupPage } from './Account/NotLoggedIn/SignupPage'
import { LostPasswordPage } from './Account/NotLoggedIn/LostPassword'
import { ResetPasswordPage } from './Account/NotLoggedIn/ResetPasswordPage'
import { AccountPage } from './Account/AccountPage'
import { OrganizationPage } from './Account/OrganizationPage'
import { getUser, User } from '../../lib/collections/Users'
import { PubSub } from '../../lib/api/pubsub'
import { useTracker, useSubscription } from '../lib/ReactMeteorData/ReactMeteorData'
import { DocumentTitleProvider } from '../lib/DocumentTitleProvider'
import { Spinner } from '../lib/Spinner'
import { isRunningInPWA } from '../lib/lib'
import { firstIfArray, protectString } from '../../lib/lib'

const NullComponent = () => null

const CRON_INTERVAL = 30 * 60 * 1000
const LAST_RESTART_LATENCY = 3 * 60 * 60 * 1000
const WINDOW_START_HOUR = 3
const WINDOW_END_HOUR = 5

const UserContext = React.createContext<User | null>(null)
const UserSubscriptionReadyContext = React.createContext<boolean>(false)

export const App: React.FC = function App() {
	const { t } = useTranslation()
	const user = useTracker(
		() => {
			return getUser()
		},
		[],
		null
	)

	const [lastStart] = useState(Date.now())
	const [requestedRoute, setRequestedRoute] = useState<undefined | string>()

	const userReady = useSubscription(PubSub.loggedInUser)
	const orgReady = useSubscription(PubSub.organization, { _id: user?.organizationId ?? protectString('__never') })

	const subsReady = userReady && orgReady

	const roles = useRoles(user, subsReady)
	const featureFlags = useFeatureFlags()

	useEffect(() => {
		if (user) return

		const path = String(window.location.pathname)
		if (Settings.enableUserAccounts && !path.match(/verify-email/)) {
			setRequestedRoute(path)
		}
	}, [user])

	useEffect(() => {
		if (!user) return

		setRequestedRoute(undefined)
	}, [user])

	useEffect(() => {
		function cronJob() {
			const now = new Date()
			const hour = now.getHours() + now.getMinutes() / 60
			// if the time is between 3 and 5
			if (
				hour >= WINDOW_START_HOUR &&
				hour < WINDOW_END_HOUR &&
				// and the previous restart happened more than 3 hours ago
				Date.now() - lastStart > LAST_RESTART_LATENCY &&
				// and not in an active rundown
				document.querySelector('.rundown.active') === null
			) {
				// @ts-expect-error forceReload is marked as deprecated, but it's still usable
				setTimeout(() => window.location.reload(true), 1)
			}
		}

		const interval = setInterval(cronJob, CRON_INTERVAL)

		return () => {
			clearInterval(interval)
		}
	}, [lastStart])

	const mountPWAFullScreenTrigger = useCallback(() => {
		document.addEventListener(
			'mousedown',
			(event) => {
				event.preventDefault()

				document.documentElement
					.requestFullscreen({
						navigationUI: 'auto',
					})
					.then(() => {
						document.addEventListener('fullscreenchange', mountPWAFullScreenTrigger, {
							once: true,
						})
					})
					.catch((e) => console.error('Could not get FullScreen when running as a PWA', e))

				// Use Keyboard API to lock the keyboard and disable all browser shortcuts
				if (!('keyboard' in navigator)) return
				// but we check for its availability, so it should be fine.
				// Keyboard Lock: https://wicg.github.io/keyboard-lock/
				navigator.keyboard.lock().catch((e) => console.error('Could not get Keyboard Lock when running as a PWA', e))
			},
			{
				once: true,
				passive: false,
			}
		)
	}, [])

	useEffect(() => {
		if (Settings.customizationClassName) {
			document.body.classList.add(Settings.customizationClassName)
		}
		const uiZoom = featureFlags.zoom
		if (uiZoom !== 1) {
			document.documentElement.style.fontSize = uiZoom * 16 + 'px'
		}
	}, [featureFlags.zoom])

	useEffect(() => {
		if (isRunningInPWA()) {
			mountPWAFullScreenTrigger()
		} else {
			window.addEventListener('appinstalled', mountPWAFullScreenTrigger)

			return () => {
				window.removeEventListener('appinstalled', mountPWAFullScreenTrigger)
			}
		}
	}, [mountPWAFullScreenTrigger])

	const isAuthenticated = !Settings.enableUserAccounts || user
	const shouldUseAuthentication = Settings.enableUserAccounts

	const onNavigationUserConfirmation = useCallback((message: string, callback: (result: boolean) => void) => {
		doModalDialog({
			title: t('Are you sure?'),
			message,
			onAccept: () => {
				callback(true)
			},
			onDiscard: () => {
				callback(false)
			},
		})
	}, [])

	return (
		<UserContext.Provider value={user}>
			<UserSubscriptionReadyContext.Provider value={subsReady}>
				<Router getUserConfirmation={onNavigationUserConfirmation}>
					<div className="container-fluid header-clear">
						{/* Header switch - render the usual header for all pages but the rundown view */}
						{isAuthenticated && (
							<ErrorBoundary>
								<Switch>
									<Route path="/rundown/:playlistId" component={NullComponent} />
									<Route path="/countdowns/:studioId" component={NullComponent} />
									<Route path="/activeRundown" component={NullComponent} />
									<Route path="/prompter/:studioId" component={NullComponent} />
									<Route
										path="/"
										render={(props) => (
											<Header
												{...props}
												loggedIn={user ? true : false}
												allowConfigure={roles.configure}
												allowTesting={roles.testing}
												allowDeveloper={roles.developer}
											/>
										)}
									/>
								</Switch>
							</ErrorBoundary>
						)}
						{/* Main app switch */}
						<ErrorBoundary>
							<Switch>
								{shouldUseAuthentication ? (
									<>
										<Route
											exact
											path="/"
											render={(props) => <LoginPage {...props} requestedRoute={requestedRoute} />}
										/>
										<Route exact path="/login" render={() => <Redirect to="/" />} />
										<Route
											exact
											path="/login/verify-email/:token"
											render={(props) => <LoginPage {...props} requestedRoute={requestedRoute} />}
										/>
										<Route exact path="/signup" component={SignupPage} />
										<Route exact path="/reset" component={LostPasswordPage} />
										<Route exact path="/reset/:token" component={ResetPasswordPage} />
										<Route
											exact
											path="/account"
											render={() => (
												<RequireAuth>
													<AccountPage />
												</RequireAuth>
											)}
										/>
										<Route
											exact
											path="/organization"
											render={() => (
												<RequireAuth>
													<OrganizationPage />
												</RequireAuth>
											)}
										/>
									</>
								) : (
									<Route exact path="/" component={RundownList} />
								)}
								<Route
									path="/rundowns"
									render={() => (
										<RequireAuth>
											<RundownList />
										</RequireAuth>
									)}
								/>
								<Route
									path="/rundown/:playlistId/shelf"
									exact
									render={(props) => (
										<RequireAuth>
											<RundownView
												playlistId={protectString(decodeURIComponent(props.match.params.playlistId))}
												onlyShelf={true}
											/>
										</RequireAuth>
									)}
								/>
								<Route
									path="/rundown/:playlistId"
									render={(props) => (
										<RequireAuth>
											<RundownView playlistId={protectString(decodeURIComponent(props.match.params.playlistId))} />
										</RequireAuth>
									)}
								/>
								<Route
									path="/activeRundown/:studioId"
									render={(props) => (
										<RequireAuth>
											<ActiveRundownView studioId={protectString(decodeURIComponent(props.match.params.studioId))} />
										</RequireAuth>
									)}
								/>
								<Route
									path="/prompter/:studioId"
									render={(props) => (
										<RequireAuth>
											<PrompterView studioId={protectString(decodeURIComponent(props.match.params.studioId))} />
										</RequireAuth>
									)}
								/>
								{/* We switch to the general ClockView component, and allow it to do the switch between various types of countdowns */}
								<Route
									path="/countdowns/:studioId"
									render={(props) => (
										<RequireAuth>
											<ClockView studioId={protectString(decodeURIComponent(props.match.params.studioId))} />
										</RequireAuth>
									)}
								/>
								<Route
									path="/status"
									render={() => (
										<RequireAuth>
											<Status />
										</RequireAuth>
									)}
								/>
								<Route
									path="/settings"
									render={() => (
										<RequireAuth>
											<SettingsView />
										</RequireAuth>
									)}
								/>
								<Route
									path="/testTools"
									render={() => (
										<RequireAuth>
											<TestTools />
										</RequireAuth>
									)}
								/>
								<Route>
									<Redirect to="/" />
								</Route>
							</Switch>
						</ErrorBoundary>
						<ErrorBoundary>
							<Switch>
								{/* Put views that should NOT have the Notification center here: */}
								<Route path="/countdowns/:studioId" component={NullComponent} />
								<Route path="/prompter/:studioId" component={NullComponent} />
								<Route path="/" component={ConnectionStatusNotification} />
							</Switch>
						</ErrorBoundary>
						<ErrorBoundary>
							<DocumentTitleProvider />
						</ErrorBoundary>
						<ErrorBoundary>
							<ModalDialogGlobalContainer />
						</ErrorBoundary>
					</div>
				</Router>
			</UserSubscriptionReadyContext.Provider>
		</UserContext.Provider>
	)
}

/**
 * This is a poly-fill, replicating the behavior of a <Navigate> element in React-Router-DOM v6.
 * TODO: Use React-Router-DOM element once React-Router-DOM is upgraded to v6.
 */
const Navigate = React.memo(function Navigate({ to }: { to: string }): null {
	const history = useHistory()

	useEffect(() => {
		history.push(to)
	}, [to])

	return null
})

const RequireAuth = React.memo(function RequireAuth({ children }: React.PropsWithChildren<{}>) {
	const user = useContext(UserContext)
	const ready = useContext(UserSubscriptionReadyContext)

	let isAuthenticated = false
	let isWorking = false
	if (!Settings.enableUserAccounts || (ready && user)) {
		isAuthenticated = true
	} else if (!ready) {
		isWorking = true
	}

	if (isWorking) return <Spinner />
	if (isAuthenticated) return <>{children}</>

	return <Navigate to="/" />
})

function useRoles(user: User | null, subsReady: boolean) {
	const location = window.location

	const [roles, setRoles] = useState(
		Settings.enableUserAccounts
			? {
					studio: false,
					configure: false,
					developer: false,
					testing: false,
					service: false,
			  }
			: {
					studio: getAllowStudio(),
					configure: getAllowConfigure(),
					developer: getAllowDeveloper(),
					testing: getAllowTesting(),
					service: getAllowService(),
			  }
	)

	useEffect(() => {
		if (!Settings.enableUserAccounts) {
			if (!location.search) return

			const params = queryStringParse(location.search)

			if (params['studio']) setAllowStudio(params['studio'] === '1')
			if (params['configure']) setAllowConfigure(params['configure'] === '1')
			if (params['develop']) setAllowDeveloper(params['develop'] === '1')
			if (params['testing']) setAllowTesting(params['testing'] === '1')
			if (params['service']) setAllowService(params['service'] === '1')

			if (params['admin']) {
				const val = params['admin'] === '1'
				setAllowStudio(val)
				setAllowConfigure(val)
				setAllowDeveloper(val)
				setAllowTesting(val)
				setAllowService(val)
			}

			setRoles({
				studio: getAllowStudio(),
				configure: getAllowConfigure(),
				developer: getAllowDeveloper(),
				testing: getAllowTesting(),
				service: getAllowService(),
			})
		} else if (user && subsReady) {
			setRoles({
				studio: getAllowStudio(),
				configure: getAllowConfigure(),
				developer: getAllowDeveloper(),
				testing: getAllowTesting(),
				service: getAllowService(),
			})
		}
	}, [location.search, user, subsReady])

	return roles
}

function useFeatureFlags() {
	const location = window.location

	const [featureFlags, setFeatureFlags] = useState({
		shelfFollowsOnAir: getShelfFollowsOnAir(),
		speak: getAllowSpeaking(),
		vibrate: getAllowVibrating(),
		help: getHelpMode(),
		zoom: getUIZoom(),
		showHiddenSourceLayers: getShowHiddenSourceLayers(),
		ignorePieceContentStatus: getIgnorePieceContentStatus(),
		reportNotifications: getReportNotifications(),
	})

	useEffect(() => {
		if (!location.search) return

		const params = queryStringParse(location.search)

		if (params['shelffollowsonair']) setShelfFollowsOnAir(params['shelffollowsonair'] === '1')
		if (params['speak']) setAllowSpeaking(params['speak'] === '1')
		if (params['vibrate']) setAllowVibrating(params['vibrate'] === '1')
		if (params['help']) setHelpMode(params['help'] === '1')
		if (params['zoom'] && typeof params['zoom'] === 'string') {
			setUIZoom(parseFloat(firstIfArray(params['zoom']) || '1') / 100 || 1)
		}
		if (params['show_hidden_source_layers']) {
			setShowHiddenSourceLayers(params['show_hidden_source_layers'] === '1')
		}
		if (params['ignore_piece_content_status']) {
			setIgnorePieceContentStatus(params['ignore_piece_content_status'] === '1')
		}
		if (params['reportNotificationsId'] && params['reportNotificationsId'] !== '0') {
			const notificationsId = firstIfArray(params['reportNotificationsId'])
			if (notificationsId) setReportNotifications(notificationsId)
		} else if (params['reportNotificationsId'] === '0') {
			unsetReportNotifications()
		}

		setFeatureFlags({
			shelfFollowsOnAir: getShelfFollowsOnAir(),
			speak: getAllowSpeaking(),
			vibrate: getAllowVibrating(),
			help: getHelpMode(),
			zoom: getUIZoom(),
			showHiddenSourceLayers: getShowHiddenSourceLayers(),
			ignorePieceContentStatus: getIgnorePieceContentStatus(),
			reportNotifications: getReportNotifications(),
		})
	}, [location.search])

	return featureFlags
}

export default App
