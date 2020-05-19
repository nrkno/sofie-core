import * as React from 'react'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { RouteComponentProps } from 'react-router'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { getCoreSystem, ICoreSystem, GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { NotificationCenter, Notification, NoticeLevel, NotificationAction } from '../lib/notifications/notifications'
import { MeteorCall } from '../../lib/api/methods'
import { getUser, User } from '../../lib/collections/Users'

interface IAccountPageProps extends RouteComponentProps {
	coreSystem: ICoreSystem
}

interface IAccountPageState {
	user: User | undefined
}

export const AccountPage = translateWithTracker(() => {
	return {}
})(
class extends MeteorReactComponent<Translated<IAccountPageProps>, IAccountPageState> {
	constructor (props) {
		super(props)
		this.state = { user: undefined }
	}

	private handleRemoveUser () {
		MeteorCall.user.removeUser().then((error) => {
			if (error) {
				throw error
			}
			this.props.history.push('/')
		}).catch(error => {
			console.log(error)
			NotificationCenter.push(new Notification(
				undefined,
				NoticeLevel.CRITICAL,
				'Error deleting account',
				'Account Page'
			))
		})
	}

	componentDidUpdate () {
		if (this.state.user === undefined && getUser() !== undefined) {
			this.setState({ user: getUser() as User })
		}
	}

	componentDidMount () {
		if (this.state.user === undefined && getUser() !== undefined) {
			this.setState({ user: getUser() as User })
		}
	}

	render () {
		const { t } = this.props

		return (
			<React.Fragment>
				<h1>{t('Account Page')}</h1>
				{this.state.user && <React.Fragment>
					<p>{t('Account Name:')} {this.state.user.profile.name}</p>
					<p>{t('Account Email:')} {this.state.user.emails.map(e => e.address).join(', ')}</p>
					<p>{t('Organization:')} {this.state.user.organizationId}</p>
				</React.Fragment>}
				<button onClick={() => this.handleRemoveUser()}>{t('Remove Self')}</button>
			</React.Fragment>
		)
	}
})
