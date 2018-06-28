import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker, ReactMeteorData } from '../../lib/ReactMeteorData/react-meteor-data'
import { PeripheralDevice,
		PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import Moment from 'react-moment'
import { translate } from 'react-i18next'
import { getCurrentTime } from '../../../lib/lib'
import { Link } from 'react-router-dom'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as _ from 'underscore'
import { ModalDialog } from '../../lib/ModalDialog'
import { ExternalMessageQueue, ExternalMessageQueueObj } from '../../../lib/collections/ExternalMessageQueue'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { makeTableOfObject } from '../../lib/utilComponents'

interface IExternalMessagesProps {
}
interface IExternalMessagesState {
	// devices: Array<PeripheralDevice>
}
interface IExternalMessagesTrackedProps {
	queuedMessages: Array<ExternalMessageQueueObj>
	sentMessages: Array<ExternalMessageQueueObj>
}

interface DeviceInHierarchy {
	device: PeripheralDevice
	children: Array<DeviceInHierarchy>
}

const ExternalMessages = translateWithTracker<IExternalMessagesProps, IExternalMessagesState, IExternalMessagesTrackedProps>((props: IExternalMessagesProps) => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	return {
		queuedMessages: ExternalMessageQueue.find({
			sent: {$not: {$gt: 0}}
		}, {
			sort: {
				created: 1,
				lastTry: 1
			}
		}).fetch(),
		sentMessages: ExternalMessageQueue.find({
			sent: {$gt: 0}
		}, {
			sort: {
				sent: 1,
				lastTry: 1
			}
		}).fetch()
	}
})(class ExternalMessages extends MeteorReactComponent<Translated<IExternalMessagesProps & IExternalMessagesTrackedProps>, IExternalMessagesState> {

	componentWillMount () {
		// Subscribe to data:
		this.subscribe('externalMessageQueue', {})
	}

	renderMessageHead () {
		const { t } = this.props
		return (
			<thead>
				<tr>
					<th className='c1'>
						{t('Id')}
					</th>
					<th className='c1'>
						{t('Created')}
					</th>
					<th className='c1'>
						{t('Sent')}
					</th>
					<th className='c1'>
						{t('Try count')}
					</th>
					<th className='c1'>
						{t('Error message')}
					</th>
					<th className='c1'>
						{t('Message')}
					</th>
				</tr>
			</thead>
		)
	}
	remove (msg: ExternalMessageQueueObj) {
		Meteor.call('removeExternalMessageQueueObj', msg._id)
	}
	renderMessageRow (msg: ExternalMessageQueueObj) {
		return (
			<tr key={msg._id}>
				<td className='c1'>
					<button className='action-btn' onClick={(e) => this.remove(msg)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
				<td className='c1'>{msg._id}</td>
				<td className='c1'><Moment fromNow unit='seconds'>{msg.created}</Moment></td>
				<td className='c1'>
					{(msg.sent ?
						<Moment fromNow unit='seconds'>{msg.sent}</Moment>
					: null)}
				</td>
				<td className='c1'>{msg.tryCount}</td>
				<td className='c1'>{msg.errorMessage}</td>
				<td className='c1'>
					<div>
						{makeTableOfObject(msg.receiver)}
					</div>
					<div>
						{makeTableOfObject(msg.message)}
					</div>
				</td>
			</tr>
		)
	}

	renderQueuedMessages () {
		const { t } = this.props
		return (
			<div>
				<h2>{t('Queued messages')}</h2>
				<table className='table system-status-table'>
					{this.renderMessageHead()}

					<tbody>
						{_.map(this.props.queuedMessages, (msg) => {
							return this.renderMessageRow(msg)
						})}
					</tbody>
				</table>
			</div>
		)
	}

	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter system-status'>
				<header className='mvs'>
					<h1>{t('Message queue')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderQueuedMessages()}
					{/* <table className='table system-status-table'>
						<thead>
							<tr>
								<th className='c2'>
									{t('ID')}
								</th>
								<th className='c3'>
									{t('Name')}
								</th>
								<th className='c1'>
									{t('Telemetry')}
								</th>
								<th className='c2'>
									{t('Type')}
								</th>
								<th className='c2'>
									{t('Status')}
								</th>
								<th className='c2'>
									{t('Last seen')}
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderPeripheralDevices()}
						</tbody>
					</table> */}
				</div>
			</div>
		)
	}
})
export { ExternalMessages }
