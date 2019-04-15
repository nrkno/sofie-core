import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
const Tooltip = require('rc-tooltip')
import timer from 'react-timer-hoc'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import Moment from 'react-moment'
import { RundownUtils } from '../lib/rundown'
import { getCurrentTime } from '../../lib/lib'
import { MomentFromNow } from '../lib/Moment'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faSync from '@fortawesome/fontawesome-free-solid/faSync'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { ModalDialog, doModalDialog } from '../lib/ModalDialog'
import { SystemStatusAPI, StatusResponse } from '../../lib/api/systemStatus'
import { ManualPlayout } from './manualPlayout'
import { getDeveloperMode } from '../lib/localStorage'
import { doUserAction } from '../lib/userAction'
import { UserActionAPI } from '../../lib/api/userActions'
import { getAdminMode } from '../lib/localStorage'

const PackageInfo = require('../../package.json')

interface IRunningOrderListItemProps {
	key: string,
	runningOrder: RunningOrder
}

interface IRunningOrderListItemStats {
}

export class RunningOrderListItem extends React.Component<Translated<IRunningOrderListItemProps>, IRunningOrderListItemStats> {
	constructor (props) {
		super(props)
	}

	getRunningOrderLink (runningOrderId) {
		// double encoding so that "/" are handled correctly
		return '/ro/' + encodeURIComponent(encodeURIComponent(runningOrderId))
	}

	confirmDelete (runningOrder: RunningOrder) {
		const { t } = this.props

		doModalDialog({
			title: t('Delete this item?'),
			yes: t('Delete'),
			no: t('Cancel'),
			onAccept: (e) => {
				doUserAction(t, e, UserActionAPI.methods.removeRunningOrder, [runningOrder._id])
			},
			message: (
				t('Are you sure you want to delete running order "{{name}}"?', { name: runningOrder.name }) + '\n' +
				t('Please note: This action is irreversible!')
			)
		})
	}

	confirmReSyncRO (runningOrder: RunningOrder) {
		const { t } = this.props
		doModalDialog({
			title: t('Re-Sync this running order?'),
			yes: t('Re-Sync'),
			no: t('Cancel'),
			onAccept: (e) => {
				doUserAction(t, e, UserActionAPI.methods.resyncRunningOrder, [runningOrder._id])
			},
			message: (
				t('Are you sure you want to re-sync running order "{{name}}" with MOS script?', { name: runningOrder.name }) + '\n' +
				t('Please note: This action is irreversible!')
			)
		})
	}

	render () {
		const { t } = this.props
		return (
			<React.Fragment>
				<tr className='running-order-list-item'>
					<th className='running-order-list-item__name'>
						{this.props.runningOrder.active ?
							<div className='origo-pulse small right mrs'>
								<div className='pulse-marker'>
									<div className='pulse-rays'></div>
									<div className='pulse-rays delay'></div>
								</div>
							</div>
							: null
						}
						<Link to={this.getRunningOrderLink(this.props.runningOrder._id)}>{this.props.runningOrder.name}</Link>
					</th>
					<td className='running-order-list-item__id'>
						{this.props.runningOrder._id}
					</td>
					<td className='running-order-list-item__created'>
						<MomentFromNow>{this.props.runningOrder.created}</MomentFromNow>
					</td>
					<td className='running-order-list-item__airTime'>
						{this.props.runningOrder.expectedStart &&
							<Moment format='YYYY/MM/DD HH:mm:ss'>{this.props.runningOrder.expectedStart}</Moment>
						}
					</td>
					<td className='running-order-list-item__duration'>
						{this.props.runningOrder.expectedDuration &&
							RundownUtils.formatDiffToTimecode(this.props.runningOrder.expectedDuration, false, false, true, false, true)
						}
					</td>
					<td className='running-order-list-item__status'>
						{this.props.runningOrder.status}
					</td>
					<td className='running-order-list-item__air-status'>
						{this.props.runningOrder.airStatus}
					</td>
					<td className='running-order-list-item__actions'>
						{
							this.props.runningOrder.unsynced || getAdminMode() ?
							<Tooltip overlay={t('Delete')} placement='top'>
								<button className='action-btn' onClick={(e) => this.confirmDelete(this.props.runningOrder)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</Tooltip> : null
						}
						{
							this.props.runningOrder.unsynced ?
							<Tooltip overlay={t('Re-sync with MOS')} placement='top'>
								<button className='action-btn' onClick={(e) => this.confirmReSyncRO(this.props.runningOrder)}>
									<FontAwesomeIcon icon={faSync} />
								</button>
							</Tooltip> : null
						}
					</td>
				</tr>
				{this.props.runningOrder.startedPlayback && this.props.runningOrder.expectedDuration && this.props.runningOrder.active &&
					<tr className='hl expando-addon'>
						<td colSpan={8}>
							<ActiveProgressBar
								runningOrder={this.props.runningOrder}
							/>
						</td>
					</tr>
				}
			</React.Fragment>
		)
	}
}

interface IRunningOrdersListProps {
	runningOrders: Array<RunningOrder>
}

interface IRunningOrdersListState {
	systemStatus?: StatusResponse
}

export const RunningOrderList = translateWithTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		runningOrders: RunningOrders.find({}, { sort: { created: -1 } }).fetch()
	}
})(
class extends MeteorReactComponent<Translated<IRunningOrdersListProps>, IRunningOrdersListState> {
	// private _subscriptions: Array<Meteor.SubscriptionHandle> = []

	constructor (props) {
		super(props)

		this.state = {}
	}

	componentDidMount () {
		Meteor.call(SystemStatusAPI.getSystemStatus, (err: any, systemStatus: StatusResponse) => {
			if (err) {
				console.error(err)
				return
			}

			this.setState({
				systemStatus: systemStatus
			})
		})
	}

	renderRunningOrders (list: RunningOrder[]) {
		return list.map((runningOrder) => (
			<RunningOrderListItem key={runningOrder._id} runningOrder={runningOrder} t={this.props.t} />
		))
	}

	renderUnsyncedRunningOrders (list: RunningOrder[]) {
		return list.map((runningOrder) => (
			<RunningOrderListItem key={runningOrder._id} runningOrder={runningOrder} t={this.props.t} />
		))
	}

	componentWillMount () {
		// Subscribe to data:
		// TODO: make something clever here, to not load ALL the runningOrders
		this.subscribe('runningOrders', {})
	}

	render () {
		const { t } = this.props

		const synced = this.props.runningOrders.filter(i => !i.unsynced)
		const unsynced = this.props.runningOrders.filter(i => i.unsynced)

		return <React.Fragment>
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('Running Orders')}</h1>
				</header>
				<div className='mod mvl'>
					<table className='table system-status-table expando expando-tight'>
						<thead>
							<tr className='hl'>
								<th className='c3'>
									{t('Running Order')}
								</th>
								<th className='c2'>
									{t('ID')}
								</th>
								<th className='c2'>
									{t('Created')}
								</th>
								<th className='c2'>
									{t('On Air Start Time')}
								</th>
								<th className='c1'>
									{t('Duration')}
								</th>
								<th className='c1'>
									{t('Status')}
								</th>
								<th className='c1'>
									{t('Air Status')}
								</th>
								<th className='c1'>
									&nbsp;
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderRunningOrders(synced)}
						</tbody>
						{unsynced.length > 0 && <tbody>
							<tr className='hl'>
								<th colSpan={8} className='pvn phn'>
									<h2 className='mtm mbs mhn'>{t('Unsynced from MOS')}</h2>
								</th>
							</tr>
						</tbody>}
						<tbody>
							{this.renderUnsyncedRunningOrders(unsynced)}
						</tbody>
					</table>
				</div>
			</div>
			<div className='mtl gutter version-info'>
				<p>
					{t('Sofie Automation')} {t('version')}: {PackageInfo.version || 'UNSTABLE'}
				</p>
				<div>
					{
						this.state.systemStatus ?
							<React.Fragment>
								<div>
									{t('status')}: {this.state.systemStatus.status} / {this.state.systemStatus._internal.statusCodeString}
								</div>
								<div>
									{
										this.state.systemStatus._internal.messages.length ?
											<div>
												{t('Status Messages:')}
												<ul>
													{_.map(this.state.systemStatus._internal.messages, (message, i) => {
														return (
															<li key={i}>
																{message}
															</li>
														)
													})}
												</ul>
											</div> :
										null
									}
								</div>
							</React.Fragment>
							: null
					}
				</div>
				{
					getDeveloperMode() ?
					<ManualPlayout></ManualPlayout> : null
				}
			</div>
		</React.Fragment>
	}
}
)

interface IActiveProgressBarProps {
	runningOrder: RunningOrder
}

const ActiveProgressBar = timer(1000)(class extends React.Component<IActiveProgressBarProps> {
	render () {
		return (this.props.runningOrder.startedPlayback && this.props.runningOrder.expectedDuration ?
			<div className='progress-bar'>
				<div className='pb-indicator' style={{
					'width': Math.min(((getCurrentTime() - this.props.runningOrder.startedPlayback) / this.props.runningOrder.expectedDuration) * 100, 100) + '%'
				}} />
			</div> : null
		)
	}
})
