import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Time, unprotectString } from '../../../lib/lib'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { UserActionsLog, UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import { DatePickerFromTo } from '../../lib/datePicker'
import moment from 'moment'
import { PubSub, meteorSubscribe } from '../../../lib/api/pubsub'
import { withTranslation } from 'react-i18next'
import { parse as queryStringParse } from 'query-string'

const PARAM_DATE_FORMAT = 'YYYY-MM-DD'
const PARAM_NAME_FROM_DATE = 'fromDate'

interface IUserActionsListProps {
	logItems: UserActionsLogItem[]
	startDate?: number
	onItemClick?: (item: UserActionsLogItem) => void
	renderButtons?: (item: UserActionsLogItem) => React.ReactElement
}

function prettyPrintJsonString(str: string): string {
	try {
		return JSON.stringify(JSON.parse(str), undefined, 4)
	} catch (_e) {
		return str
	}
}

export const UserActionsList = withTranslation()(
	class UserActionsList extends React.Component<Translated<IUserActionsListProps>> {
		renderMessageHead() {
			const { t } = this.props
			return (
				<thead>
					<tr>
						<th className="c3 user-action-log__timestamp">{t('Timestamp')}</th>
						<th className="c3 user-action-log__executionTime">{t('Execution times')}</th>
						<th className="c1 user-action-log__userId">{t('User ID')}</th>
						<th className="c2 user-action-log__clientAddress">{t('Client IP')}</th>
						<th className="c3 user-action-log__context">{t('Action')}</th>
						<th className="c3 user-action-log__method">{t('Method')}</th>
						<th className="c1 user-action-log__status">{t('Status')}</th>
						<th className="c1 user-action-log__args">{t('Parameters')}</th>
						{this.props.renderButtons ? <th className="c1 user-action-log__buttons"></th> : null}
					</tr>
				</thead>
			)
		}

		render() {
			const { t } = this.props
			return (
				<table className="table user-action-log">
					{this.renderMessageHead()}
					<tbody>
						{_.map(this.props.logItems, (msg) => {
							const formattedTimestamp = moment(msg.timestamp).format('YYYY/MM/DD HH:mm:ss.SSS')
							const anchorId = `t${msg.timestamp}`
							const selfLink = `${location.pathname}?${PARAM_NAME_FROM_DATE}=${this.props.startDate}#${anchorId}`
							return (
								<tr
									className={this.props.onItemClick ? 'clickable' : undefined}
									key={unprotectString(msg._id)}
									onClick={() => this.props.onItemClick && this.props.onItemClick(msg)}
								>
									<td className="user-action-log__timestamp">
										<a id={anchorId} href={selfLink}>
											{formattedTimestamp}
										</a>
									</td>
									<td className="user-action-log__executionTime">
										<table>
											{msg.executionTime ? (
												<tr>
													<td>{t('Core')}:</td>
													<td>{msg.executionTime} ms</td>
												</tr>
											) : null}
											{msg.workerTime ? (
												<tr>
													<td>{t('Worker')}:</td>
													<td>{msg.workerTime} ms</td>
												</tr>
											) : null}
											{msg.gatewayDuration ? (
												<tr>
													<td>{t('Gateway')}:</td>
													<td>{msg.gatewayDuration.join(', ')} ms</td>
												</tr>
											) : null}
											{msg.timelineResolveDuration ? (
												<tr>
													<td>{t('TSR')}:</td>
													<td>{msg.timelineResolveDuration.join(', ')} ms</td>
												</tr>
											) : null}
										</table>
									</td>
									<td className="user-action-log__userId">{msg.userId}</td>
									<td className="user-action-log__clientAddress">{msg.clientAddress}</td>
									<td className="user-action-log__context">{msg.context}</td>
									<td className="user-action-log__method">{msg.method}</td>
									<td className="user-action-log__status">
										{msg.success ? 'Success' : msg.success === false ? 'Error: ' + msg.errorMessage : null}
									</td>
									<td className="user-action-log__args">{prettyPrintJsonString(msg.args)}</td>
									{this.props.renderButtons ? (
										<td className="user-action-log__buttons">{this.props.renderButtons(msg)}</td>
									) : null}
								</tr>
							)
						})}
					</tbody>
				</table>
			)
		}
	}
)

interface IUserActivityProps {}
interface IUserActivityState {
	dateFrom: Time
	dateTo: Time
}
interface IUserActivityTrackedProps {
	log: UserActionsLogItem[]
}

const UserActivity = translateWithTracker<IUserActivityProps, IUserActivityState, IUserActivityTrackedProps>(
	(_props: IUserActivityProps) => {
		return {
			log: UserActionsLog.find(
				{},
				{
					sort: {
						timestamp: 1,
					},
				}
			).fetch(),
		}
	}
)(
	class UserActivity extends MeteorReactComponent<
		Translated<IUserActivityProps & IUserActivityTrackedProps>,
		IUserActivityState
	> {
		private _currentsub: string = ''
		private _sub?: Meteor.SubscriptionHandle
		constructor(props) {
			super(props)

			// use from and to from querystring if given
			const queryParams = queryStringParse(location.search, {
				arrayFormat: 'comma',
			})

			const qsStartDate = moment(queryParams[PARAM_NAME_FROM_DATE], PARAM_DATE_FORMAT, true)

			if (qsStartDate.isValid()) {
				this.state = {
					dateFrom: qsStartDate.startOf('day').valueOf(),
					dateTo: qsStartDate.add(1, 'days').startOf('day').valueOf(),
				}
			} else {
				this.state = {
					dateFrom: moment().startOf('day').valueOf(),
					dateTo: moment().add(1, 'days').startOf('day').valueOf(),
				}
			}
		}
		componentDidMount() {
			// Subscribe to data:
			this.updateSubscription()
		}
		componentDidUpdate() {
			this.updateSubscription()
		}
		updateSubscription() {
			const h = this.state.dateFrom + '_' + this.state.dateTo
			if (h !== this._currentsub) {
				this._currentsub = h
				if (this._sub) {
					this._sub.stop()
				}
				this._sub = meteorSubscribe(PubSub.userActionsLog, {
					timestamp: {
						$gte: this.state.dateFrom,
						$lt: this.state.dateTo,
					},
				})
			}
		}
		componentWillUnmount() {
			if (this._sub) {
				this._sub.stop()
			}
			this._cleanUp()
		}

		handleChangeDate = (from: Time, to: Time) => {
			this.setState({
				dateFrom: from,
				dateTo: to,
			})
		}

		renderUserActivity() {
			const { dateFrom, dateTo } = this.state
			const logItems = this.props.log.filter(({ timestamp }) => timestamp >= dateFrom && timestamp < dateTo)

			return (
				<div>
					<div className="paging">
						<DatePickerFromTo from={dateFrom} to={dateTo} onChange={this.handleChangeDate} />
					</div>
					<UserActionsList logItems={logItems} startDate={dateFrom} />
				</div>
			)
		}

		render() {
			const { t } = this.props
			return (
				<div className="mhl gutter external-message-status">
					<header className="mbs">
						<h1>{t('User Activity Log')}</h1>
					</header>
					<div className="mod mvl">{this.renderUserActivity()}</div>
				</div>
			)
		}
	}
)
export { UserActivity }
