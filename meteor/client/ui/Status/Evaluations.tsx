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
import { Evaluations, Evaluation } from '../../../lib/collections/Evaluations'
import * as faChevronRight from '@fortawesome/fontawesome-free-solid/faChevronRight'
import * as faChevronLeft from '@fortawesome/fontawesome-free-solid/faChevronLeft'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as classNames from 'classnames'
import { DatePickerFromTo } from '../../lib/datePicker'
import * as moment from 'moment'
import { getQuestionOptions } from '../AfterBroadcastForm'
interface IEvaluationProps {
}
interface IEvaluationState {
	dateFrom: Time,
	dateTo: Time
}
interface IEvaluationTrackedProps {
	evaluations: Evaluation[]
}

const EvaluationView = translateWithTracker<IEvaluationProps, IEvaluationState, IEvaluationTrackedProps>((props: IEvaluationProps) => {

	return {
		evaluations: Evaluations.find({}, {
			sort: {
				timestamp: 1
			}
		}).fetch()
	}
})(class ExternalMessages extends MeteorReactComponent<Translated<IEvaluationProps & IEvaluationTrackedProps>, IEvaluationState> {
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
			this._sub = Meteor.subscribe('evaluations', {
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
					<th className='c1 user-action-log__userId'>
						{t('User ID')}
					</th>
					<th>
						{t('Running Order')}
					</th>
					<th colSpan={99} className='c8'>
						{t('Answers')}
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

	renderEvaluation () {
		const { t } = this.props
		return (
			<div>
				<div className='paging'>
					<DatePickerFromTo from={this.state.dateFrom} to={this.state.dateTo} onChange={this.handleChangeDate} />
				</div>
				<table className='table user-action-log'>
					{this.renderMessageHead()}
					<tbody>
						{_.map(_.filter(this.props.evaluations, (e) => {
							return (
								e.timestamp >= this.state.dateFrom &&
								e.timestamp < this.state.dateTo
							)
						}), (e) => {
							let tds = [
								<td key='c0' className='user-action-log__timestamp'><Moment format='YYYY/MM/DD HH:mm:ss'>{e.timestamp}</Moment></td>,
								<td key='c1' className='user-action-log__userId'>{e.userId}</td>,
								<td key='c2' className='user-action-log__runningOrder'>{e.runningOrderId}</td>
							]
							tds = tds.concat(_.map(e.answers, (answer, key) => {
								let str: string = answer
								if (key === 'q0') {
									_.find(getQuestionOptions(t), (o) => {
										if (o.value === str ) {
											str = o.name
											return true
										}
									})
								}
								return (
									<td key={key} className='user-action-log__answer'>{str}</td>
								)
							}))
							return (
								<tr key={e._id}>
									{tds}
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
					<h1>{t('Evaluations')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderEvaluation()}
				</div>
			</div>
		)
	}
})
export { EvaluationView }
