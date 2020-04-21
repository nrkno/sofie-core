import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import { RouteComponentProps } from 'react-router';
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


enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS'
}

interface IResetPageProps extends RouteComponentProps<{token: string}> {
	coreSystem: ICoreSystem
}

interface IResetPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	password: string
}

export const ResetPage = translateWithTracker((props: IResetPageProps) => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		// https://reacttraining.com/react-router/web/api/Redirect
		props.history.push('/lobby')
	}

	return {
		
	}
})(
class extends MeteorReactComponent<Translated<IResetPageProps>, IResetPageState> {
	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			password: ''
		}
	}

	private validateChange (e: React.ChangeEvent<HTMLInputElement>) {
		const val = e.target.value
		const token = this.props.match.params.token
		const errors: string[] = []
		const { t } = this.props

		if(val.length < 5) errors.push(t('Password must be'))
		/** Add more password rules */

		if(errors.length) {
			/** @TODO display errors to user in UI */
		} else {
			/** Accounts.resetPassword(token, this.state.password) */
		}
	}

	render() {
		const { t } = this.props
		return (
			<React.Fragment>
				<div className="reset-password container">
					<p>{t('Enter your new password')}</p>
					<input 
						type="text" 
						value={this.state.password} 
						onChange={this.validateChange} 
						placeholder={t('Password')}
					/>
					<button>{t('Set new password')}</button>
				</div>
			</React.Fragment>
		)
	}
})