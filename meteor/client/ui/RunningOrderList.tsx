import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { Link } from 'react-router-dom'

import * as ClassNames from 'classnames'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import Moment from 'react-moment'

interface IRunningOrdersListPropsHeader extends InjectedTranslateProps {
	runningOrders: Array<RunningOrder>
}

export const RunningOrderList = translate()(withTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		runningOrders: RunningOrders.find({}, { sort: { created: -1 } }).fetch()
	}
})(
class extends React.Component<IRunningOrdersListPropsHeader> {
	renderRunningOrders () {
		return this.props.runningOrders.map((runningOrder) => (
			<RunningOrderListItem key={runningOrder._id} runningOrder={runningOrder} />
		))
	}

	render () {
		const { t } = this.props

		return (
			<div>
				<header className='mvl'>
					<h1>{t('Running Orders')}</h1>
				</header>
				<div className='mod mvl'>
					<table className='table system-status-table'>
						<thead>
							<tr>
								<th className='c5'>
									{t('Slug')}
								</th>
								<th className='c2'>
									{t('ID')}
								</th>
								<th className='c2'>
									{t('Created')}
								</th>
								<th className='c1'>
									{t('Status')}
								</th>
								<th className='c1'>
									{t('Air Status')}
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderRunningOrders()}
						</tbody>
					</table>
				</div>
			</div>
		)
	}
}
)
)

interface IRunningOrderListItemPropsHeader {
	key: string,
	runningOrder: RunningOrder
}

export class RunningOrderListItem extends React.Component<IRunningOrderListItemPropsHeader> {
	getRunningOrderLink (runningOrderId) {
		return '/ro/' + runningOrderId
	}

	render () {
		return (
			<tr className='running-order-list-item'>
				<td className='running-order-list-item__name'>
					<p><Link to={this.getRunningOrderLink(this.props.runningOrder._id)}>{this.props.runningOrder.name}</Link></p>
				</td>
				<td className='running-order-list-item__id'>
					<p>{this.props.runningOrder._id}</p>
				</td>
				<td className='running-order-list-item__created'>
					<p><Moment fromNow>{this.props.runningOrder.created}</Moment></p>
				</td>
				<td className='running-order-list-item__status'>
					<p>{this.props.runningOrder.status}</p>
				</td>
				<td className='running-order-list-item__air-status'>
					<p>{this.props.runningOrder.airStatus}</p>
				</td>
			</tr>
		)
	}
}
