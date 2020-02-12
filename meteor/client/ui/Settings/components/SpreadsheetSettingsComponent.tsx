import * as React from 'react'
import { translate } from 'react-i18next'
const Tooltip = require('rc-tooltip')
import {
	PeripheralDevice,
	PeripheralDevices,
	SpreadsheetDevice,
} from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { SpreadsheetDeviceSettings } from '../../../../lib/collections/PeripheralDeviceSettings/spreadsheet'
import { NotificationCenter, Notification, NoticeLevel } from '../../../lib/notifications/notifications'
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice'
import { fetchFrom } from '../../../lib/lib'
import { getHelpMode } from '../../../lib/localStorage'
interface ISpreadsheetSettingsComponentState {
}
interface ISpreadsheetSettingsComponentProps {
	device: PeripheralDevice
}
export const SpreadsheetSettingsComponent = translate()(class SpreadsheetSettingsComponent extends React.Component<Translated<ISpreadsheetSettingsComponentProps>, ISpreadsheetSettingsComponentState> {
	constructor (props: Translated<ISpreadsheetSettingsComponentProps>) {
		super(props)
		this.state = {}
	}
	onUploadCredentialsFile (e) {
		const { t } = this.props

		const file = e.target.files[0]
		if (!file) {
			return
		}

		const reader = new FileReader()
		reader.onload = (e2) => {
			// On file upload

			this.setState({
				uploadFileKey: Date.now()
			})

			console.log(e2)

			let uploadFileContents = (e2.target as any).result

			fetchFrom(`/devices/${this.props.device._id}/uploadCredentials`, {
				method: 'POST',
				body: uploadFileContents,
				headers: {
					'content-type': 'text/javascript'
				}
			}).then(res => {
				NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, t('Spreadsheet credentials succesfully uploaded.'), 'SpreadsheetSettingsComponent'))
			}).catch(err => {
				NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, t('Failed to upload spreadsheet credentials: {{errorMessage}}', { errorMessage: err + '' }), 'SpreadsheetSettingsComponent'))
			})

			// let uploadFileContents = (e2.target as any).result
			// let blueprint = this.props.blueprint

			// doModalDialog({
			// 	title: t('Update Blueprints?'),
			// 	message: <React.Fragment>
			// 		<p>{t('Are you sure you want to update the blueprints from the file "{{fileName}}"?', { fileName: file.name })}</p>,
			// 		<p>{t('Please note: This action is irreversible!')}</p>
			// 	</React.Fragment>,
			// 	onAccept: () => {
			// 		if (uploadFileContents && blueprint) {
			// 			fetch('/blueprints/restore/' + blueprint._id, {
			// 				method: 'POST',
			// 				body: uploadFileContents,
			// 				headers: {
			// 					'content-type': 'text/javascript'
			// 				},
			// 			}).then(res => {
			// 				console.log('Blueprint restore success')
			// 			}).catch(err => {
			// 				console.error('Blueprint restore failure: ', err)
			// 			})
			// 		}
			// 	},
			// 	onSecondary: () => {
			// 		this.setState({
			// 			uploadFileKey: Date.now()
			// 		})
			// 	}
			// })
		}
		reader.readAsText(file)
	}
	onUpdatedAccessToken (authToken: string) {
		authToken = (authToken + '').trim()
		console.log(authToken)
		if (authToken && authToken.length > 5) {

			PeripheralDeviceAPI.executeFunction(
				this.props.device._id,
				(e) => {
					if (e) {
						// nothing
						console.log(e)
						NotificationCenter.push(new Notification(undefined, NoticeLevel.WARNING, 'Error when authorizing access token: ' + e, ''))
					} else {
						NotificationCenter.push(new Notification(undefined, NoticeLevel.NOTIFICATION, 'Access token saved!', ''))
					}
				},
				'receiveAuthToken',
				authToken
			)
		}
	}
	render () {
		const { t } = this.props
		let settings = (this.props.device.settings || {}) as SpreadsheetDeviceSettings
		let device = this.props.device as SpreadsheetDevice
		return (<div>
			<div className='mod mvs mhn'>
				{
					!settings.secretCredentials ?
					<label className='field'>
						{t('Application credentials')}
						<div className='mdi'>
							<div>
								{t('Go to the url below and click on the "Enable the Drive API" button. Then click on "Download Client configuration", save the credentials.json file and upload it here.')}
							</div>
							<div>
								<a href='https://developers.google.com/drive/api/v3/quickstart/nodejs' target='_blank' >https://developers.google.com/drive/api/v3/quickstart/nodejs</a>
							</div>

							<div className='mdi'>
								<input type='file' accept='application/json,.json' onChange={e => this.onUploadCredentialsFile(e)} />
								<span className='mdfx'></span>
							</div>
						</div>
					</label> :
					null
				}
				{
					settings.secretCredentials && !settings.secretAccessToken ?
					<label className='field'>
						{t('Access token')}
						<div className='mdi'>
							<div>
								{t('Click on the link below and accept the permissions request. Paste the received URL below.')}
							</div>
							<div>
								{
									device.accessTokenUrl ?
									<a href={device.accessTokenUrl} target='_blank'>{device.accessTokenUrl}</a> :
									t('Waiting for gateway to generate URL...')
								}
							</div>
							<EditAttribute
								modifiedClassName='bghl'
								updateFunction={(edit: EditAttributeBase, newValue: any) => { this.onUpdatedAccessToken(newValue) }}
								attribute=''
								type='text'
								className='mdinput'
							></EditAttribute>
						</div>
					</label> : null
				}
				<label className='field'>
					{t('Drive folder name')}
					<div className='mdi'>
						<Tooltip
							overlay={t('Provide the name of the folder to download rundowns from')}
							visible={getHelpMode() && (!this.props.device.settings || !this.props.device.settings['folderPath'])}
							placement='top'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='settings.folderPath'
								obj={this.props.device}
								type='text'
								collection={PeripheralDevices}
								className='mdinput'
							></EditAttribute>
						</Tooltip>
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
