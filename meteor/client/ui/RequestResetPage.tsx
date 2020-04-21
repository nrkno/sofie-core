import * as React from 'react'
import * as _ from 'underscore'
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

const validEmailRegex = new RegExp('/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/')

enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS'
}

interface IRequestResetPageProps extends RouteComponentProps {
	coreSystem: ICoreSystem
}

interface IRequestResetPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	email: string
}

export const RequestResetPage = translateWithTracker((props: IRequestResetPageProps) => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		// https://reacttraining.com/react-router/web/api/Redirect
		props.history.push('/lobby')
	}

	return {
		
	}
})(
class extends MeteorReactComponent<Translated<IRequestResetPageProps>, IRequestResetPageState> {
	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			email: ''
		}
	}

	private validateEmail (e: React.FocusEvent<HTMLInputElement>) {
		if(!validEmailRegex.test(this.state.email)) {
			/** @TODO Display error to user in UI */
		}
	}

	private resetPassword (e: React.MouseEvent<HTMLButtonElement>): void {
		if(!this.state.email.length || !validEmailRegex.test(this.state.email)) {
			/** @TODO Display error to user in UI */
		} else {
			/**
			 * Attmept to get userid for email entered
			 * Accounts.sendResetPasswordEmail(userid, *optional email*)
			 */
		}
		
	}
 

	render() {
		const { t } = this.props
		return (
			<div className="reset-password container">
				<p>Lost password?</p>
				<input 
					type="text" 
					value={this.state.email} 
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
						this.setState({...this.state, email: e.target.value})} 
					onBlur={this.validateEmail}
					placeholder={t('Email Address')}
					name="email"
				/>
				<button onClick={this.resetPassword}>{t('Send reset email')}</button>
			</div>
		)
	}
})