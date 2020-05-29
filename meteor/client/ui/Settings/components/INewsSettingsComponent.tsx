import * as React from 'react'
import { withTranslation } from 'react-i18next'
import { faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as ClassNames from 'classnames'
import { literal } from '../../../../lib/lib'
import { Random } from 'meteor/random'
import { mousetrapHelper } from '../../../lib/mousetrapHelper'
import {
	PeripheralDevice,
	PeripheralDevices,
	INewsDevice,
} from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { INewsDeviceSettings, INewsHost, INewsQueue } from '../../../../lib/collections/PeripheralDeviceSettings/iNews'
interface IINewsSettingsComponentState {
	editedItems: Array<string>
}
interface IINewsSettingsComponentProps {
	device: PeripheralDevice
}
export const INewsSettingsComponent = withTranslation()(class INewsSettingsComponent extends React.Component<Translated<IINewsSettingsComponentProps>, IINewsSettingsComponentState> {
	constructor (props: Translated<IINewsSettingsComponentProps>) {
		super(props)
		this.state = {
			editedItems: []
		}
	}
	isItemEdited = (item: INewsHost | INewsQueue) => {
		return this.state.editedItems.indexOf(item._id) >= 0
	}
	finishEditItem = (item: INewsHost | INewsQueue) => {
		let index = this.state.editedItems.indexOf(item._id)
		if (index >= 0) {
			this.state.editedItems.splice(index, 1)
			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	editItem = (item: INewsHost | INewsQueue) => {
		if (this.state.editedItems.indexOf(item._id) < 0) {
			this.state.editedItems.push(item._id)
			this.setState({
				editedItems: this.state.editedItems
			})
		} else {
			this.finishEditItem(item)
		}
	}
	onDeleteHost = (item: INewsHost) => {
		if (this.props.device.settings) {
			PeripheralDevices.update(this.props.device._id, {
				$pull: {
					'settings.hosts': {
						_id: item._id
					}
				}
			})
		}
	}
	onDeleteQueue = (item: INewsQueue) => {
		if (this.props.device.settings) {
			PeripheralDevices.update(this.props.device._id, {
				$pull: {
					'settings.queues': {
						_id: item._id
					}
				}
			})
		}
	}
	onAddHost = () => {

		const newItem = literal<INewsHost>({
			_id: Random.id(),
			host: ''
		})

		PeripheralDevices.update(this.props.device._id, {
			$push: {
				'settings.hosts': newItem
			}
		})
	}
	onAddQueue = () => {

		const newItem = literal<INewsQueue>({
			_id: Random.id(),
			queue: ''
		})

		PeripheralDevices.update(this.props.device._id, {
			$push: {
				'settings.queues': newItem
			}
		})
	}
	renderHosts () {
		const { t } = this.props
		let settings = (this.props.device.settings || {}) as INewsDeviceSettings
		return (
			(settings.hosts || []).map((item, index) => {
				return <React.Fragment key={item._id}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<td className='settings-studio-custom-config-table__value c3'>
							{item.host}
						</td>
						<td className='settings-studio-custom-config-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.onDeleteHost && this.onDeleteHost(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isItemEdited(item) &&
						<tr className='expando-details hl'>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Host')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.hosts.' + index + '.host'}
												obj={this.props.device}
												type='text'
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
								</div>
								<div className='mod alright'>
									<button className='btn btn-primary' onClick={(e) => this.finishEditItem(item)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					}
				</React.Fragment>
			})
		)
	}
	renderQueues () {
		const { t } = this.props
		let settings = (this.props.device.settings || {}) as INewsDeviceSettings
		return (
			(settings.queues || []).map((item, index) => {
				return <React.Fragment key={item._id}>
					<tr className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<td className='settings-studio-custom-config-table__value c3'>
							{item.queue}
						</td>
						<td className='settings-studio-custom-config-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.onDeleteQueue && this.onDeleteQueue(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
					{this.isItemEdited(item) &&
						<tr className='expando-details hl'>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Queue')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'settings.queues.' + index + '.queue'}
												obj={this.props.device}
												type='text'
												collection={PeripheralDevices}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
								</div>
								<div className='mod alright'>
									<button className='btn btn-primary' onClick={(e) => this.finishEditItem(item)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					}
				</React.Fragment>
			})
		)
	}
	render () {
		const { t } = this.props
		let settings = (this.props.device.settings || {}) as INewsDeviceSettings
		let device = this.props.device as INewsDevice
		return (<div>
			<div className='mod mvs mhn'>
				<label className='field'>
					{t('Hosts')}
					<table className='expando settings-studio-custom-config-table'>
						<tbody>
							{this.renderHosts()}
						</tbody>
					</table>
					<div className='mod mhs'>
						<button className='btn btn-primary' onClick={this.onAddHost}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</label>
				<label className='field'>
					{t('iNews Queues')}
					<table className='expando settings-studio-custom-config-table'>
						<tbody>
							{this.renderQueues()}
						</tbody>
					</table>
					<div className='mod mhs'>
						<button className='btn btn-primary' onClick={this.onAddQueue}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</label>
				<label className='field'>
					{t('User')}
					<div className='mdi'>
						<EditAttribute
							modifiedClassName='bghl'
							attribute='settings.user'
							obj={this.props.device}
							type='text'
							collection={PeripheralDevices}
							className='mdinput'
						></EditAttribute>
					</div>
				</label>
				<label className='field'>
					{t('Password')}
					<div className='mdi'>
						<EditAttribute
							modifiedClassName='bghl'
							attribute='settings.password'
							obj={this.props.device}
							type='text'
							collection={PeripheralDevices}
							className='mdinput'
						></EditAttribute>
					</div>
				</label>
				<label className='field'>
					{t('Debug logging')}
					<div className='mdi'>
						<EditAttribute
							modifiedClassName='bghl'
							attribute='settings.debugLogging'
							obj={this.props.device}
							type='checkbox'
							collection={PeripheralDevices}
							className='mdinput'
						></EditAttribute>
					</div>
				</label>
			</div>
		</div>)
	}
})
