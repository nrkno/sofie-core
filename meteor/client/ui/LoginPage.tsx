import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import { RouteComponentProps } from 'react-router'
const Tooltip = require('rc-tooltip')
import timer from 'react-timer-hoc'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../lib/collections/RundownPlaylists'
import Moment from 'react-moment'
import { RundownUtils } from '../lib/rundown'
import { getCurrentTime, literal, unprotectString } from '../../lib/lib'
import { MomentFromNow } from '../lib/Moment'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faSync from '@fortawesome/fontawesome-free-solid/faSync'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { doModalDialog } from '../lib/ModalDialog'
import { StatusResponse } from '../../lib/api/systemStatus'
import { ManualPlayout } from './manualPlayout'
import { getAllowDeveloper, getAllowConfigure, getAllowService, getHelpMode } from '../lib/localStorage'
import { doUserAction } from '../lib/userAction'
import { getCoreSystem, ICoreSystem, GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from '../lib/notifications/notifications'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { ShowStyleBases, ShowStyleBaseId } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { PubSub } from '../../lib/api/pubsub'
import { ReactNotification } from '../lib/notifications/ReactNotification'
import { Spinner } from '../lib/Spinner'
import { MeteorCall } from '../../lib/api/methods'
import { getUser } from '../../lib/collections/Users'

const PackageInfo = require('../../package.json')

const validEmailRegex = new RegExp("/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/igm")

interface RundownPlaylistUi extends RundownPlaylist {
	rundownStatus: string
	rundownAirStatus: string
	unsyncedRundowns: Rundown[]
	studioName: string
	showStyles: Array<{ id: ShowStyleBaseId, baseName?: string, variantName?: string }>
}

enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS'
}

interface ILoginPageProps extends RouteComponentProps {
	coreSystem: ICoreSystem
	rundownPlaylists: Array<RundownPlaylistUi>
	updateLoggedInStatus: (status: boolean) => void
}

interface ILoginPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	email: string
	password: string
}

export const LoginPage = translateWithTracker((props: ILoginPageProps) => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		props.history.push('/lobby')
		props.updateLoggedInStatus(true)
	}

	return {
		
	}
})(
class extends MeteorReactComponent<Translated<ILoginPageProps>, ILoginPageState> {
	// private _subscriptions: Array<Meteor.SubscriptionHandle> = []

	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			email: '',
			password: ''
		}

		this.handleChange = this.handleChange.bind(this)
		this.attempLogin = this.attempLogin.bind(this)
		this.handleLoginAttempt = this.handleLoginAttempt.bind(this)
	}

	private handleChange (e: React.ChangeEvent<HTMLInputElement>) {
		if(this.state[e.currentTarget.name] === undefined) return
		
		return this.setState({...this.state, [e.currentTarget.name]: e.currentTarget.value})
	}

	private attempLogin(): void {
		try {
			if(!this.state.email.length) throw new Error('Please enter an email address')
			// if(!validEmailRegex.test(this.state.email)) throw new Error('Invalid email address')
			if(!this.state.password.length) throw new Error('Please enter an password')
		} catch (error) {
			/** @TODO Display error to user in UI */
			console.error(error)
			return
		}
		Meteor.loginWithPassword(this.state.email, this.state.password, this.handleLoginAttempt)
	}

	private handleLoginAttempt (error: Error) {
		if(error) {
			/** @TODO dispaly error to client in ui */
		} else {
			this.props.updateLoggedInStatus(true)
			this.props.history.push('/lobby')
		}
	}



	componentDidMount () {
		const { t } = this.props

		// Subscribe to data:
		this.subscribe(PubSub.loggedInUser, {})
	}

	render () {
		const { t } = this.props

		return (
			<React.Fragment>
				<div className="sofie-logo"></div>
				<h1>{t('Sofie - TV Automation System')}</h1>
				<p>{t('Service provided by SuperFly.tv')}</p>
				<div className="login">
					<div className="container">
						<input 
							type="text" 
							value={this.state.email} 
							onChange={this.handleChange} 
							placeholder={t('Email Address')}
							name="email"
						/>
						<input 
							type="password" 
							value={this.state.password} 
							onChange={this.handleChange} 
							placeholder={t('Password')}
							name="password"
						/>
						<button onClick={() => this.attempLogin()}>Sign In</button>
						<Link className="float-left" to="/reset">{t('Lost password?')}</Link>
					</div>
					<div className="container">
					<Link to="/signup"><button>{t('Create new account')}</button></Link>
					</div>
				</div>
			</React.Fragment>
		)
	}
}
)
