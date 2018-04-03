import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'

import * as ClassNames from 'classnames'
import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'

interface IRunningOrderListItemPropsHeader {
	key: string,
	runningOrder: RunningOrder
}
export class RunningOrderList extends React.Component<IRunningOrderListItemPropsHeader> {
	render () {
		return (
			<tr className='rundown-list-item'>
				<td className='device-item__name'>
			<p>{this.props.runningOrder.name}</p>
		</td>
			</tr>
		)
	}
}

/* export default withTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		devices: PeripheralDevices.find({}, { sort: { created: -1 } }).fetch(),
	};
})(SystemStatus); */
