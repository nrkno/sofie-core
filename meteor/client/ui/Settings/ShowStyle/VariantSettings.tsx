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

interface IShowStyleVariantsProps {
	showStyleBase: ShowStyleBase
	showStyleVariants: ShowStyleVariant[]
	blueprintConfigManifest: ConfigManifestEntry[]

	layerMappings?: { [key: string]: MappingsExt }
	sourceLayers?: Array<{ name: string; value: string; type: SourceLayerType }>
}

interface IShowStyleVariantsSettingsState {
	editedMappings: ProtectedString<any>[]
	uploadFileKey: number
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
				uploadFileKey: Date.now(),
			}
		}

		importVariants(event: React.ChangeEvent<HTMLInputElement>) {
			const { t } = this.props

			const file = event.target.files ? event.target.files[0] : null
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (progressEvent: ProgressEvent<FileReader>) => {
				this.setState({
					uploadFileKey: Date.now(),
				})

				const uploadFileContents = (progressEvent.target as any).result

				let newVariants: ShowStyleVariant[]
				try {
					newVariants = JSON.parse(uploadFileContents)
					if (!_.isArray(newVariants)) {
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

				this.importVariantsFromArray(newVariants)
			}
			reader.readAsText(file)
		}

		importVariantsFromArray = (variants: ShowStyleVariant[]) => {
			const { t } = this.props
			_.forEach(variants, (entry: ShowStyleVariant) => {
				MeteorCall.showstyles.insertShowStyleVariantWithBlueprint(entry, entry._id).catch((error) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t(`Failed to import Variant ${entry.name}. Make sure it is not already imported.`, {
								errorMessage: error + '',
							}),
							'VariantSettings'
						)
					)
				})
			})
		}

		copyVariant = (showStyleVariant: ShowStyleVariant) => {
			MeteorCall.showstyles.insertShowStyleVariantWithBlueprint(showStyleVariant).catch(console.error)
		}

		downloadVariant = (showstyleVariant: ShowStyleVariant) => {
			const variantArray = [showstyleVariant]
			const jsonStr = JSON.stringify(variantArray)

			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = `${showstyleVariant.name}_showstyleVariant_${showstyleVariant._id}.json`

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}

		downloadAllVariants = () => {
			const jsonStr = JSON.stringify(this.props.showStyleVariants)

			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = `All variants_${this.props.showStyleBase._id}.json`

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}

		isItemEdited = (layerId: ProtectedString<any>) => {
			return this.state.editedMappings.indexOf(layerId) >= 0
		}

		finishEditItem = (layerId: ProtectedString<any>) => {
			const index = this.state.editedMappings.indexOf(layerId)
			if (index >= 0) {
				this.state.editedMappings.splice(index, 1)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			}
		}

		editItem = (layerId: ProtectedString<any>) => {
			if (this.state.editedMappings.indexOf(layerId) < 0) {
				this.state.editedMappings.push(layerId)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			} else {
				this.finishEditItem(layerId)
			}
		}

		onAddShowStyleVariant = () => {
			MeteorCall.showstyles.insertShowStyleVariant(this.props.showStyleBase._id).catch(console.error)
		}

		confirmRemove = (showStyleVariant: ShowStyleVariant) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Variant?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					MeteorCall.showstyles.removeShowStyleVariant(showStyleVariant._id).catch(console.error)
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

		renderShowStyleVariants() {
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
								<button className="action-btn" onClick={() => this.downloadVariant(showStyleVariant)}>
									<FontAwesomeIcon icon={faDownload} />
								</button>
								<button className="action-btn" onClick={() => this.copyVariant(showStyleVariant)}>
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
												{t('Variant Name')}
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
					<h2 className="mhn">{t('Variants')}</h2>
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
							onChange={(event) => this.importVariants(event)}
							key={this.state.uploadFileKey}
						>
							<FontAwesomeIcon icon={faUpload} />
							&nbsp;{t('Import')}
						</UploadButton>
						<button className="btn btn-secondary mls" onClick={this.downloadAllVariants}>
							<FontAwesomeIcon icon={faDownload} />
							&nbsp;{t('Export')}
						</button>
					</div>
				</div>
			)
		}
	}
)
