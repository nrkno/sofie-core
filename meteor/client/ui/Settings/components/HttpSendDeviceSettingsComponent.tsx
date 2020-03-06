import * as ClassNames from 'classnames'
import * as React from 'react'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { translate } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Random } from 'meteor/random'
import {
	IHttpSendDeviceSettingsComponentProps,
	IHttpSendDeviceSettingsComponentState
} from './IHttpSendDeviceSettingsComponentProps'
import { TSR } from 'tv-automation-sofie-blueprints-integration'

export const HttpSendDeviceSettingsComponent = translate()(class HttpSendDeviceSettingsComponent extends React.Component<Translated<IHttpSendDeviceSettingsComponentProps>, IHttpSendDeviceSettingsComponentState> {
	constructor (props: Translated<IHttpSendDeviceSettingsComponentProps>) {
		super(props)
		this.state = {
			deleteConfirmMakeReadyId: undefined,
			showDeleteConfirmMakeReady: false,
			editedMakeReady: []
		}
	}
	isItemEdited = (rowId: string) => {
		return this.state.editedMakeReady.indexOf(rowId) >= 0
	}
	finishEditItem = (rowId: string) => {
		let index = this.state.editedMakeReady.indexOf(rowId)
		if (index >= 0) {
			this.state.editedMakeReady.splice(index, 1)
			this.setState({
				editedMakeReady: this.state.editedMakeReady
			})
		}
	}
	editItem = (rowId: string) => {
		if (this.state.editedMakeReady.indexOf(rowId) < 0) {
			this.state.editedMakeReady.push(rowId)
			this.setState({
				editedMakeReady: this.state.editedMakeReady
			})
		} else {
			this.finishEditItem(rowId)
		}
	}
	handleConfirmRemoveCancel = (e) => {
		this.setState({
			showDeleteConfirmMakeReady: false,
			deleteConfirmMakeReadyId: undefined
		})
	}
	handleConfirmRemoveAccept = (e) => {
		this.state.deleteConfirmMakeReadyId && this.removeMakeReady(this.state.deleteConfirmMakeReadyId)
		this.setState({
			showDeleteConfirmMakeReady: false,
			deleteConfirmMakeReadyId: undefined
		})
	}
	confirmRemove = (rowId: string) => {
		this.setState({
			showDeleteConfirmMakeReady: true,
			deleteConfirmMakeReadyId: rowId
		})
	}
	removeMakeReady = (rowId: string) => {
		// TODO this
		let unsetObject = {}
		unsetObject['settings.devices.' + this.props.deviceId + '.options.makeReadyCommands'] = { id: rowId }
		PeripheralDevices.update(this.props.parentDevice._id, {
			$pull: unsetObject
		})
	}
	addNewHttpSendCommand () {
		const { deviceId } = this.props
		let setObject = {}
		setObject['settings.devices.' + deviceId + '.options.makeReadyCommands'] = {
			id: Random.id(),
			type: TSR.TimelineContentTypeHTTP.POST,
			url: 'http://',
			params: {}
		}
		PeripheralDevices.update(this.props.parentDevice._id, {
			$push: setObject
		})
	}
	renderHttpSendCommands () {
		const { t, device, deviceId } = this.props
		const commands = (device.options as any || {}).makeReadyCommands || []
		return commands.map((cmd: any, i) => {
			return <React.Fragment key={i}>
				<tr className={ClassNames({
					'hl': this.isItemEdited(cmd.id)
				})}>
					<th className='settings-studio-device-httpsend__url c5'>
						{cmd.url}
					</th>
					<td className='settings-studio-device-httpsend__type c4'>
						{cmd.type}
					</td>
					<td className='settings-studio-device-httpsend__actions table-item-actions c3'>
						<button className='action-btn' onClick={(e) => this.editItem(cmd.id)}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</button>
						<button className='action-btn' onClick={(e) => this.confirmRemove(cmd.id)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</td>
				</tr>
				{this.isItemEdited(cmd.id) &&
					<tr className='expando-details hl' key={cmd.id + '-details'}>
						<td colSpan={5}>
							<div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('URL')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.makeReadyCommands.' + i + '.url'} obj={this.props.parentDevice} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Type')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.makeReadyCommands.' + i + '.type'} obj={this.props.parentDevice} type='dropdown' options={TSR.TimelineContentTypeHTTP} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Params')}
										<EditAttribute modifiedClassName='bghl' attribute={'settings.devices.' + deviceId + '.options.makeReadyCommands.' + i + '.params'} mutateDisplayValue={v => JSON.stringify(v, undefined, 2)} mutateUpdateValue={v => JSON.parse(v)} obj={this.props.parentDevice} type='multiline' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
									</label>
								</div>
							</div>
							<div className='mod alright'>
								<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(cmd.id)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>}
			</React.Fragment>
		})
	}
	render () {
		const { t } = this.props
		return (<React.Fragment>
			<h3 className='mhs'>{t('Make ready commands')}</h3>
			<table className='expando settings-studio-device-httpsend-table'>
				<tbody>
					{this.renderHttpSendCommands()}
				</tbody>
			</table>

			<ModalDialog title={t('Remove this command?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirmMakeReady} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
				<p>{t('Are you sure you want to remove this command?')}</p>
			</ModalDialog>

			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewHttpSendCommand()}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</React.Fragment>)
	}
})
