import React from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faPlus, faDownload, faUpload, faCopy } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ConfigManifestEntry, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { withTranslation } from 'react-i18next'
import { MeteorCall } from '../../../../lib/api/methods'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant, ShowStyleVariants } from '../../../../lib/collections/ShowStyleVariants'
import { EditAttribute } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { ConfigManifestSettings } from '../ConfigManifestSettings'
import { UploadButton } from '../../../lib/uploadButton'
import { NoticeLevel, Notification, NotificationCenter } from '../../../lib/notifications/notifications'
import _ from 'underscore'
import { logger } from '../../../../lib/logging'

interface IShowStyleVariantsProps {
	showStyleBase: ShowStyleBase
	showStyleVariants: ShowStyleVariant[]
	blueprintConfigManifest: ConfigManifestEntry[]

	layerMappings?: { [key: string]: MappingsExt }
	sourceLayers?: Array<{ name: string; value: string; type: SourceLayerType }>
}

interface IShowStyleVariantsSettingsState {
	editedMappings: ProtectedString<any>[]
	timestampedFileKey: number
}

export const ShowStyleVariantsSettings = withTranslation()(
	class ShowStyleVariantsSettings extends React.Component<
		Translated<IShowStyleVariantsProps>,
		IShowStyleVariantsSettingsState
	> {
		constructor(props: Translated<IShowStyleVariantsProps>) {
			super(props)

			this.state = {
				editedMappings: [],
				timestampedFileKey: Date.now(),
			}
		}

		private importShowStyleVariants = (event: React.ChangeEvent<HTMLInputElement>): void => {
			const { t } = this.props

			const file = event.target.files?.[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = () => {
				this.setState({
					timestampedFileKey: Date.now(),
				})

				const fileContents = reader.result as string

				const newShowStyleVariants: ShowStyleVariant[] = []
				try {
					JSON.parse(fileContents).map((showStyleVariant) => newShowStyleVariants.push(showStyleVariant))
					if (!_.isArray(newShowStyleVariants)) {
						throw new Error('Imported file did not contain an array')
					}
				} catch (error) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to import new showstyle variants: {{errorMessage}}', { errorMessage: error + '' }),
							'VariantSettings'
						)
					)
					return
				}

				this.importShowStyleVariantsFromArray(newShowStyleVariants)
			}
			reader.readAsText(file)
		}

		private importShowStyleVariantsFromArray = (showStyleVariants: ShowStyleVariant[]): void => {
			const { t } = this.props
			showStyleVariants.forEach((showStyleVariant: ShowStyleVariant) => {
				MeteorCall.showstyles.insertShowStyleVariantWithProperties(showStyleVariant, showStyleVariant._id).catch(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to import Variant {{name}}. Make sure it is not already imported.', {
								name: showStyleVariant.name,
							}),
							'VariantSettings'
						)
					)
				})
			})
		}

		private copyShowStyleVariant = (showStyleVariant: ShowStyleVariant): void => {
			showStyleVariant.name = `Copy of ${showStyleVariant.name}`
			MeteorCall.showstyles.insertShowStyleVariantWithProperties(showStyleVariant).catch(logger.warn)
		}

		private downloadShowStyleVariant = (showStyleVariant: ShowStyleVariant): void => {
			const showStyleVariants = [showStyleVariant]
			const jsonStr = JSON.stringify(showStyleVariants)
			const fileName = `${showStyleVariant.name}_showstyleVariant_${showStyleVariant._id}.json`
			this.download(jsonStr, fileName)
		}

		private downloadAllShowStyleVariants = (): void => {
			const jsonStr = JSON.stringify(this.props.showStyleVariants)
			const fileName = `All variants_${this.props.showStyleBase._id}.json`
			this.download(jsonStr, fileName)
		}

		private download = (jsonStr: string, fileName: string): void => {
			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = fileName

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}

		private isItemEdited = (layerId: ProtectedString<any>): boolean => {
			return this.state.editedMappings.indexOf(layerId) >= 0
		}

		private finishEditItem = (layerId: ProtectedString<any>): void => {
			const index = this.state.editedMappings.indexOf(layerId)
			if (index >= 0) {
				this.state.editedMappings.splice(index, 1)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			}
		}

		private editItem = (layerId: ProtectedString<any>): void => {
			if (this.state.editedMappings.indexOf(layerId) < 0) {
				this.state.editedMappings.push(layerId)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			} else {
				this.finishEditItem(layerId)
			}
		}

		private onAddShowStyleVariant = (): void => {
			MeteorCall.showstyles.insertShowStyleVariant(this.props.showStyleBase._id).catch(logger.warn)
		}

		private confirmRemove = (showStyleVariant: ShowStyleVariant): void => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Variant?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					MeteorCall.showstyles.removeShowStyleVariant(showStyleVariant._id).catch(logger.warn)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the variant "{{showStyleVariantId}}"?', {
								showStyleVariantId: showStyleVariant.name,
							})}
						</p>
					</React.Fragment>
				),
			})
		}

		private renderShowStyleVariants() {
			const { t } = this.props

			return this.props.showStyleVariants.map((showStyleVariant) => {
				return (
					<React.Fragment key={unprotectString(showStyleVariant._id)}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(showStyleVariant._id),
							})}
						>
							<th className="settings-studio-showStyleVariant__name c3">
								{showStyleVariant.name || t('Unnamed variant')}
							</th>
							<td className="settings-studio-showStyleVariant__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.downloadShowStyleVariant(showStyleVariant)}>
									<FontAwesomeIcon icon={faDownload} />
								</button>
								<button className="action-btn" onClick={() => this.copyShowStyleVariant(showStyleVariant)}>
									<FontAwesomeIcon icon={faCopy} />
								</button>
								<button className="action-btn" onClick={() => this.editItem(showStyleVariant._id)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmRemove(showStyleVariant)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(showStyleVariant._id) && (
							<tr className="expando-details hl">
								<td colSpan={5}>
									<div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Name')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'name'}
													obj={showStyleVariant}
													type="text"
													collection={ShowStyleVariants}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
									</div>
									<div className="row">
										<div className="col c12 r1-c12 phs">
											<ConfigManifestSettings
												t={this.props.t}
												i18n={this.props.i18n}
												tReady={this.props.tReady}
												manifest={this.props.blueprintConfigManifest}
												collection={ShowStyleVariants}
												configPath={'blueprintConfig'}
												alternateObject={this.props.showStyleBase}
												object={showStyleVariant}
												layerMappings={this.props.layerMappings}
												sourceLayers={this.props.sourceLayers}
												subPanel={true}
											/>
										</div>
									</div>
									<div className="mod alright">
										<button className="btn btn-primary" onClick={() => this.finishEditItem(showStyleVariant._id)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>
						)}
					</React.Fragment>
				)
			})
		}

		render() {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">{t('Show Style Variants')}</h2>
					<div className="mod mhs"></div>
					<table className="table expando settings-studio-showStyleVariants-table">
						<tbody>{this.renderShowStyleVariants()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={this.onAddShowStyleVariant}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
						<UploadButton
							className="btn btn-secondary mls"
							accept="application/json,.json"
							onChange={(event) => this.importShowStyleVariants(event)}
							key={this.state.timestampedFileKey}
						>
							<FontAwesomeIcon icon={faUpload} />
							&nbsp;{t('Import')}
						</UploadButton>
						<button className="btn btn-secondary mls" onClick={this.downloadAllShowStyleVariants}>
							<FontAwesomeIcon icon={faDownload} />
							&nbsp;{t('Export')}
						</button>
					</div>
				</div>
			)
		}
	}
)
