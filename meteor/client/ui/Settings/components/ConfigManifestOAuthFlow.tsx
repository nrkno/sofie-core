import * as React from 'react'
import { withTranslation } from 'react-i18next'
import { PeripheralDevice } from '../../../../lib/collections/PeripheralDevices'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { IngestDeviceSettings } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceSettings/ingestDevice'
import { NotificationCenter, Notification, NoticeLevel } from '../../../lib/notifications/notifications'
import { fetchFrom } from '../../../lib/lib'

interface IConfigManifestOAuthFlowComponentState {}
interface IConfigManifestOAuthFlowComponentProps {
	device: PeripheralDevice
}
export const ConfigManifestOAuthFlowComponent = withTranslation()(
	class ConfigManifestOAuthFlowComponent extends React.Component<
		Translated<IConfigManifestOAuthFlowComponentProps>,
		IConfigManifestOAuthFlowComponentState
	> {
		constructor(props: Translated<IConfigManifestOAuthFlowComponentProps>) {
			super(props)
			this.state = {}
		}
		onUploadCredentialsFile(e) {
			const { t } = this.props

			const file = e.target.files[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				// On file upload

				this.setState({
					uploadFileKey: Date.now(),
				})

				const uploadFileContents = (e2.target as any).result

				fetchFrom(`/devices/${this.props.device._id}/uploadCredentials`, {
					method: 'POST',
					body: uploadFileContents,
					headers: {
						'content-type': 'text/javascript',
					},
				})
					.then(() => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								t('OAuth credentials succesfully uploaded.'),
								'ConfigManifestOAuthFlowComponent'
							)
						)
					})
					.catch((err) => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.WARNING,
								t('Failed to upload OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
								'ConfigManifestOAuthFlowComponent'
							)
						)
					})
			}
			reader.readAsText(file)
		}
		resetAuthentication() {
			const { t } = this.props

			fetchFrom(`/devices/${this.props.device._id}/resetAuth`, {
				method: 'POST',
			})
				.then(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('OAuth credentials successfuly reset'),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
				.catch((err) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to reset OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
		}
		render() {
			const { t } = this.props
			const settings = (this.props.device.settings || {}) as IngestDeviceSettings
			const device = this.props.device

			return (
				<div>
					{settings.secretAccessToken ? (
						// If this is set, we have completed the authentication procedure.
						// A reset button is provided to begin the flow again if authorization is revoked by the user.
						<div className="mod mvs mhs">
							<button className="btn btn-secondary" onClick={() => this.resetAuthentication()}>
								{t('Reset Authentication')}
							</button>
						</div>
					) : (
						<div className="mod mvs mhs">
							{!settings.secretCredentials ? (
								<label className="field">
									{t('Application credentials')}
									<div className="mdi">
										<div>{t(device.configManifest.deviceOAuthFlow!.credentialsHelp)}</div>
										<div>
											<a href={device.configManifest.deviceOAuthFlow!.credentialsURL} target="_blank" rel="noreferrer">
												{device.configManifest.deviceOAuthFlow!.credentialsURL}
											</a>
										</div>

										<div className="mdi">
											<input
												type="file"
												accept="application/json,.json"
												onChange={(e) => this.onUploadCredentialsFile(e)}
											/>
											<span className="mdfx"></span>
										</div>
									</div>
								</label>
							) : (
								<label className="field">
									{t('Access token')}
									<div className="mdi">
										<div>{t('Click on the link below and accept the permissions request.')}</div>
										<div>
											{device.accessTokenUrl ? (
												<a href={device.accessTokenUrl} target="_blank" rel="noreferrer">
													{device.accessTokenUrl}
												</a>
											) : (
												t('Waiting for gateway to generate URL...')
											)}
										</div>
									</div>
								</label>
							)}
						</div>
					)}
				</div>
			)
		}
	}
)
