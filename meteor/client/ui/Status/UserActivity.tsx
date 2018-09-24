import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker, ReactMeteorData } from '../../lib/ReactMeteorData/react-meteor-data'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime, Time } from '../../../lib/lib'
import { ClientAPI } from '../../../lib/api/client'
import * as _ from 'underscore'
import { ModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { UserActionsLog, UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import * as faChevronRight from '@fortawesome/fontawesome-free-solid/faChevronRight'
import * as faChevronLeft from '@fortawesome/fontawesome-free-solid/faChevronLeft'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as classNames from 'classnames'
import { DatePickerFromTo } from '../../lib/datePicker'
import * as moment from 'moment'
interface IUserActivityProps {
}
interface IUserActivityState {
	dateFrom: Time,
	dateTo: Time
}
interface IUserActivityTrackedProps {
	log: UserActionsLogItem[]
}

const UserActivity = translateWithTracker<IUserActivityProps, IUserActivityState, IUserActivityTrackedProps>((props: IUserActivityProps) => {

	return {
		log: UserActionsLog.find({}, {
			sort: {
				timestamp: 1
			}
		}).fetch()
	}
})(class ExternalMessages extends MeteorReactComponent<Translated<IUserActivityProps & IUserActivityTrackedProps>, IUserActivityState> {
	private _currentsub: string = ''
	private _sub?: Meteor.SubscriptionHandle
	constructor (props) {
		super(props)

		this.state = {
			dateFrom: moment().startOf('day').valueOf(),
			dateTo: moment().add(1, 'days').startOf('day').valueOf()
		}
	}
	componentWillMount () {
		// Subscribe to data:
		this.updateSubscription()
	}
	componentDidUpdate () {
		this.updateSubscription()
	}
	updateSubscription () {

		let h = this.state.dateFrom + '_' + this.state.dateTo
		if (h !== this._currentsub) {
			this._currentsub = h
			if (this._sub) {
				this._sub.stop()
			}
			this._sub = Meteor.subscribe('userActionsLog', {
				timestamp: {
					$gte: this.state.dateFrom,
					$lt: this.state.dateTo,
				}
			})

		}

	}
	componentWillUnmount () {
		if (this._sub) {
			this._sub.stop()
		}
		this._cleanUp()
	}

	renderMessageHead () {
		const { t } = this.props
		return (
			<thead>
				<tr>
					<th className='c3 user-action-log__timestamp'>
						{t('Timestamp')}
					</th>
					<th className='c3 user-action-log__executionTime'>
						{t('Execution time')}
					</th>
					<th className='c1 user-action-log__userId'>
						{t('User ID')}
					</th>
					<th className='c2 user-action-log__clientAddress'>
						{t('Client IP')}
					</th>
					<th className='c3 user-action-log__context'>
						{t('Action')}
					</th>
					<th className='c3 user-action-log__method'>
						{t('Method')}
					</th>
					<th className='c1 user-action-log__args'>
						{t('Parameters')}
					</th>
				</tr>
			</thead>
		)
	}
	handleChangeDate = (from: Time, to: Time) => {
		this.setState({
			dateFrom: from,
			dateTo: to
		})
	}

	renderUserActivity () {
		const { t } = this.props
		return (
			<div>
				<div className='paging'>
					<DatePickerFromTo from={this.state.dateFrom} to={this.state.dateTo} onChange={this.handleChangeDate} />
				</div>
				<table className='table user-action-log'>
					{this.renderMessageHead()}
					<tbody>
						{_.map(_.filter(this.props.log, (ua) => {
							return (
								ua.timestamp >= this.state.dateFrom &&
								ua.timestamp < this.state.dateTo
							)
						}), (msg) => {
							return (
								<tr key={msg._id}>
									<td className='user-action-log__timestamp'><Moment format='YYYY/MM/DD HH:mm:ss'>{msg.timestamp}</Moment></td>
									<td className='user-action-log__args'>{msg.executionTime ? msg.executionTime + 'ms' : ''}</td>
									<td className='user-action-log__userId'>{msg.userId}</td>
									<td className='user-action-log__clientAddress'>{msg.clientAddress}</td>
									<td className='user-action-log__context'>{msg.context}</td>
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
					<h1>{t('User Activity Log')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderUserActivity()}
				</div>
			</div>
		)
	}
})
export { UserActivity }
