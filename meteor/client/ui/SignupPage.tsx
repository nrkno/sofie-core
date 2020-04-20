import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
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

interface ISignupPageProps {
	coreSystem: ICoreSystem
	rundownPlaylists: Array<RundownPlaylistUi>
}

interface ISignupPageState {
	systemStatus?: StatusResponse
	subsReady: boolean
	email: string
	password: string
}

export const SignupPage = translateWithTracker(() => {

	const user = getUser()
	if (user) {
		// If user is logged in, forward to lobby:
		// https://reacttraining.com/react-router/web/api/Redirect
	}

	return {
		
	}
})(
class extends MeteorReactComponent<Translated<ISignupPageProps>, ISignupPageState> {
	constructor (props) {
		super(props)

		this.state = {
			subsReady: false,
			email: '',
			password: ''
		}
	}
	render() {
		const { t } = this.props
		return (
			<React.Fragment>

			</React.Fragment>
		)
	}
})