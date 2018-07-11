import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker, ReactMeteorData } from '../../lib/ReactMeteorData/react-meteor-data'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime } from '../../../lib/lib'
import { ClientAPI } from '../../../lib/api/client'
import * as _ from 'underscore'
import { ModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { UserActionsLog, UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import * as classNames from 'classnames'

interface IUserActivityProps {
}
interface IUserActivityState {
}
interface IUserActivityTrackedProps {
	log: UserActionsLogItem[]
}

const UserActivity = translateWithTracker<IUserActivityProps, IUserActivityState, IUserActivityTrackedProps>((props: IUserActivityProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		log: UserActionsLog.find({}, {
			sort: {
				timestamp: -1
			}
		}).fetch()
	}
})(class ExternalMessages extends MeteorReactComponent<Translated<IUserActivityProps & IUserActivityTrackedProps>, IUserActivityState> {
	componentWillMount () {
		// Subscribe to data:
		this.subscribe('userActionsLog', {})
	}

	renderMessageHead () {
		const { t } = this.props
		return (
			<thead>
				<tr>
					<th className='c3 user-action-log__timestamp'>
						{t('Timestamp')}
					</th>
					<th className='c1 user-action-log__userId'>
						{t('User ID')}
					</th>
					<th className='c2 user-action-log__clientAddress'>
						{t('Client IP')}
					</th>
					<th className='c3 user-action-log__method'>
						{t('Action')}
					</th>
					<th className='c1 user-action-log__args'>
						{t('Parameters')}
					</th>
				</tr>
			</thead>
		)
	}

	renderUserActivity () {
		const { t } = this.props
		return (
			<div>
				<table className='table user-action-log'>
					{this.renderMessageHead()}
					<tbody>
						{_.map(this.props.log, (msg) => {
							return (
								<tr key={msg._id}>
									<td className='user-action-log__timestamp'><Moment format='YYYY/MM/DD HH:mm:ss'>{msg.timestamp}</Moment></td>
									<td className='user-action-log__userId'>{msg.userId}</td>
									<td className='user-action-log__clientAddress'>{msg.clientAddress}</td>
									<td className='user-action-log__method'>{msg.method}</td>
									<td className='user-action-log__args'>{msg.args}</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		)
	}

	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter external-message-status'>
				<header className='mbs'>
					<h1>{t('User activity log')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderUserActivity()}
				</div>
			</div>
		)
	}
})
export { UserActivity }
