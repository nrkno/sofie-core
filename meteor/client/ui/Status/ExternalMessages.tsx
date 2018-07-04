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
import * as classNames from 'classnames'

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
				created: -1,
				lastTry: -1
			}
		}).fetch(),
		sentMessages: ExternalMessageQueue.find({
			sent: {$gt: 0}
		}, {
			sort: {
				sent: -1,
				lastTry: -1
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
					<th className='c1'></th>
					<th className='c2'>
						{t('Id')}
					</th>
					<th className='c2'>
						{t('Created')}
					</th>
					<th className='c3'>
						{t('Status')}
					</th>
					<th className='c4'>
						{t('Message')}
					</th>
				</tr>
			</thead>
		)
	}
	removeMessage (msg: ExternalMessageQueueObj) {
		Meteor.call('removeExternalMessageQueueObj', msg._id)
	}
	renderMessageRow (msg: ExternalMessageQueueObj) {

		let classes: string[] = ['message-row']
		let info: JSX.Element | null = null
		if (msg.sent) {
			classes.push('sent')
			info = (
				<div>
					<b>Sent: </b>
					<Moment fromNow unit='seconds'>{msg.sent}</Moment>
				</div>
			)
		} else if ((getCurrentTime() - (msg.lastTry || 0)) < 10 * 1000) {
			classes.push('sending')
			info = (
				<div>
					<b>Sending...</b>
				</div>
			)
		} else if (msg.errorFatal) {
			classes.push('fatal')
			info = (
				<div>
					<b>Fatal error: </b>
					<i>{msg.errorMessage}</i>
				</div>
			)
		} else if (msg.errorMessage) {
			classes.push('error')
			info = (
				<div>
					<b>Error: </b>
					<i>{msg.errorMessage}</i>
				</div>
			)
		} else {
			classes.push('waiting')
			if (msg.tryCount) {
				info = (
					<div>
						<b>Tried {msg.tryCount} times</b>
					</div>
				)
			}
			if (msg.lastTry) {
				info = (
					<div>
						<b>Last try: </b>
						<Moment fromNow unit='seconds'>{msg.lastTry}</Moment>
					</div>
				)
			}
		}
		return (
			<tr key={msg._id} className={classNames(classes)}>
				<td className='c1'>
					<button className='action-btn' onClick={(e) => this.removeMessage(msg)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
				<td className='c2'>{msg._id}</td>
				<td className='c2'><Moment fromNow unit='seconds'>{msg.created}</Moment></td>
				<td className='c3'>{info}</td>
				<td className='c4 small'>
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
	renderSentMessages () {
		const { t } = this.props
		return (
			<div>
				<h2>{t('Sent messages')}</h2>
				<table className='table system-status-table'>
					{this.renderMessageHead()}

					<tbody>
						{_.map(this.props.sentMessages, (msg) => {
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
			<div className='mhl gutter external-message-status'>
				<header className='mbs'>
					<h1>{t('Message queue')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderQueuedMessages()}
					{this.renderSentMessages()}
				</div>
			</div>
		)
	}
})
export { ExternalMessages }
