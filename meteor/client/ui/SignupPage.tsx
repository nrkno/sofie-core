import * as React from 'react'
import * as _ from 'underscore'
import { Accounts } from 'meteor/accounts-base'
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

const validEmailRegex = new RegExp("/[^@]+@[^\.]+\..+/g")

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

interface ISignupPageProps extends RouteComponentProps {
	coreSystem: ICoreSystem
	rundownPlaylists: Array<RundownPlaylistUi>
}

interface ISignupPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	email: string
	password: string
	organization: string
}

export const SignupPage = translateWithTracker((props: ISignupPageProps) => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		// https://reacttraining.com/react-router/web/api/Redirect
		props.history.push('/lobby')
	}

	return {
		
	}
})(
class extends MeteorReactComponent<Translated<ISignupPageProps>, ISignupPageState> {
	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			email: 'chrisryanouellette@gmail.com',
			password: '123123',
			organization: 'New Org!'
		}
	}

	private createAccount() {
		
		try {
			if(!this.state.email.length) throw new Error('Please enter an email address')
			// if(!validEmailRegex.test(this.state.email)) throw new Error('Invalid email address')
			if(!this.state.password.length) throw new Error('Please enter an password')
		} catch (error) {
			/** @TODO Display error to user in UI */
			console.error(error)
			return;
		}

		const userId = Accounts.createUser({
			email: this.state.email, 
			password: this.state.password
		}, (error) => {
			if(error) {
				console.error(error);
			}
			console.log(userId)
			MeteorCall.organization.insertOrganization(this.state.organization)
			.then(id => console.log('NEW ORG:' + id))
			.catch(console.error)
		})
	}
	render() {
		const { t } = this.props
		return (
			<React.Fragment>
				<button onClick={() => this.createAccount()} >Sign Up</button>
			</React.Fragment>
		)
	}
})