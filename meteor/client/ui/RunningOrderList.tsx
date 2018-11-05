import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
import * as Tooltip from 'rc-tooltip'
import timer from 'react-timer-hoc'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import Moment from 'react-moment'
import { RundownUtils } from '../lib/rundown'
import { getCurrentTime } from '../../lib/lib'
import { MomentFromNow } from '../lib/Moment'
import { statusCodeToString } from './Status/SystemStatus'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faSync from '@fortawesome/fontawesome-free-solid/faSync'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { ModalDialog, doModalDialog } from '../lib/ModalDialog'
import { ClientAPI } from '../../lib/api/client'
import { eventContextForLog } from '../lib/eventTargetLogHelper'
import { PlayoutAPI } from '../../lib/api/playout';
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice';
import { RundownAPI } from '../../lib/api/rundown';

const PackageInfo = require('../../package.json')

interface IRunningOrdersListProps {
	runningOrders: Array<RunningOrder>
}

interface IRunningOrdersListState {
	systemStatus?: string
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
		Meteor.call('systemStatus.getSystemStatus', (err: any, res: any) => {
			if (err) {
				console.error(err)
				return
			}

			this.setState({
				systemStatus: res.status
			})
		})
	}

	deleteRO = (ro: RunningOrder, e: any) => {
		const { t } = this.props

		if (!ro.active) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), RundownAPI.methods.roDelete, ro._id, (err, res) => {
				if (err) {
					// todo: notify the user
					console.error(err)
				} else {
					// console.log('segmentLineItemId', segmentLineItemId)
					console.log(res)
				}
			})
		} else {
			doModalDialog({
				title: t('Running Order is active'),
				message: (<p>The running order is active. You need to deactivate it to be able to delete it.</p>),
				acceptOnly: true,
				yes: 'OK',
				onAccept: () => { console.log('Discarded') }
			})
		}
	}

	syncRO = (ro: RunningOrder, e: any) => {
		const { t } = this.props

		if (!ro.active) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), RundownAPI.methods.roResync, ro._id, (err, res) => {
				if (err) {
					// todo: notify the user
					console.error(err)
				} else {
					// console.log('segmentLineItemId', segmentLineItemId)
					console.log(res)
				}
			})
		} else {
			doModalDialog({
				title: t('Running Order is active'),
				message: (<p>The running order is active. You need to deactivate it to be able to re-sync it with MOS.</p>),
				acceptOnly: true,
				yes: 'OK',
				onAccept: () => { console.log('Discarded') }
			})
		}
	}

	renderRunningOrders () {
		return this.props.runningOrders.map((runningOrder) => (
			<RunningOrderListItem key={runningOrder._id} runningOrder={runningOrder} onDeleteRO={this.deleteRO} onSyncRO={this.syncRO} t={this.props.t} />
		))
	}
	componentWillMount () {
		// Subscribe to data:
		// TODO: make something clever here, to not load ALL the runningOrders
		this.subscribe('runningOrders', {})
	}

	render () {
		const { t } = this.props

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
							{this.renderRunningOrders()}
						</tbody>
					</table>
				</div>
			</div>
			<div className='mtl gutter version-info'>
				<p>{t('Sofie Automation')} {t('version')}: {PackageInfo.version || 'UNSTABLE'}, {t('status')}: {this.state.systemStatus}</p>
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

interface IRunningOrderListItemProps {
	key: string,
	runningOrder: RunningOrder,

	onDeleteRO: (ro: RunningOrder, e: any) => void,
	onSyncRO: (ro: RunningOrder, e: any) => void
}

interface IRunningOrderListItemStats {
	showDeleteConfirm: boolean,
	showSyncConfirm: boolean,
	actionConfirmItem?: RunningOrder
}

export class RunningOrderListItem extends React.Component<Translated<IRunningOrderListItemProps>, IRunningOrderListItemStats> {
	constructor (props) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			showSyncConfirm: false
		}
	}

	getRunningOrderLink (runningOrderId) {
		// double encoding so that "/" are handled correctly
		return '/ro/' + encodeURIComponent(encodeURIComponent( runningOrderId ))
	}

	handleConfirmDeleteCancel = (e) => {
		this.setState({
			actionConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	handleConfirmDeleteAccept = (e) => {
		if (this.props.onDeleteRO && typeof this.props.onDeleteRO === 'function' && this.state.actionConfirmItem) {
			this.props.onDeleteRO(this.state.actionConfirmItem, e)
		}

		this.setState({
			actionConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	handleConfirmSyncCancel = (e) => {
		this.setState({
			actionConfirmItem: undefined,
			showSyncConfirm: false
		})
	}

	handleConfirmSyncAccept = (e) => {
		if (this.props.onSyncRO && typeof this.props.onSyncRO === 'function' && this.state.actionConfirmItem) {
			this.props.onSyncRO(this.state.actionConfirmItem, e)
		}

		this.setState({
			actionConfirmItem: undefined,
			showSyncConfirm: false
		})
	}

	confirmDelete (item: RunningOrder) {
		this.setState({
			showDeleteConfirm: true,
			actionConfirmItem: item
		})
	}

	confirmSyncRO (item: RunningOrder) {
		this.setState({
			showSyncConfirm: true,
			actionConfirmItem: item
		})
	}

	render () {
		const { t } = this.props

		return (
			<React.Fragment>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete running order "{{runningOrderSlug}}"?', { runningOrderSlug: this.state.actionConfirmItem && this.state.actionConfirmItem.name })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</ModalDialog>
				<ModalDialog title={t('Re-Sync this running order?')} acceptText={t('Re-Sync')} secondaryText={t('Cancel')} show={this.state.showSyncConfirm} onAccept={(e) => this.handleConfirmSyncAccept(e)} onSecondary={(e) => this.handleConfirmSyncCancel(e)}>
					<p>{t('Are you sure you want to re-sync running order "{{runningOrderSlug}}" with MOS script?', { runningOrderSlug: this.state.actionConfirmItem && this.state.actionConfirmItem.name })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</ModalDialog>
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
						{this.props.runningOrder && this.props.runningOrder.unsynced &&
							<React.Fragment>
								<Tooltip overlay={t('Delete')} placement='top'>
									<button className='action-btn' onClick={(e) => this.confirmDelete(this.props.runningOrder)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</Tooltip>
								<Tooltip overlay={t('Re-sync with MOS')} placement='top'>
									<button className='action-btn' onClick={(e) => this.confirmSyncRO(this.props.runningOrder)}>
										<FontAwesomeIcon icon={faSync} />
									</button>
								</Tooltip>
							</React.Fragment>
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
