import React from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faPlus, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { HotkeyDefinition } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { Random } from 'meteor/random'
import { withTranslation } from 'react-i18next'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { AHKBaseHeader, AHKModifierMap, AHKKeyboardMap, useAHKComboTemplate } from '../../../../lib/tv2/AHKkeyboardMap'
import { defaultColorPickerPalette } from '../../../lib/colorPicker'
import { downloadBlob } from '../../../lib/downloadBlob'
import { EditAttribute } from '../../../lib/EditAttribute'
import { hotkeyHelper } from '../../../lib/hotkeyHelper'
import { NotificationCenter, NoticeLevel, Notification } from '../../../../lib/notifications/notifications'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { UploadButton } from '../../../lib/uploadButton'
import _ from 'underscore'
import { Settings } from '../../../../lib/Settings'
import { ShowStyleBases } from '../../../collections'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides'

interface IHotkeyLegendSettingsProps {
	showStyleBase: ShowStyleBase
}
interface IHotkeyLegendSettingsState {
	editedItems: Array<string>
	uploadFileKey: number
}

export const HotkeyLegendSettings = withTranslation()(
	class HotkeyLegendSettings extends React.Component<
		Translated<IHotkeyLegendSettingsProps>,
		IHotkeyLegendSettingsState
	> {
		constructor(props: Translated<IHotkeyLegendSettingsProps>) {
			super(props)

			this.state = {
				editedItems: [],
				uploadFileKey: Date.now(),
			}
		}

		isItemEdited = (item: HotkeyDefinition) => {
			return this.state.editedItems.indexOf(item._id) >= 0
		}
		finishEditItem = (item: HotkeyDefinition) => {
			const index = this.state.editedItems.indexOf(item._id)
			if (index >= 0) {
				this.state.editedItems.splice(index, 1)
				this.setState({
					editedItems: this.state.editedItems,
				})
			}
		}

		editItem = (item: HotkeyDefinition) => {
			if (this.state.editedItems.indexOf(item._id) < 0) {
				this.state.editedItems.push(item._id)
				this.setState({
					editedItems: this.state.editedItems,
				})
			} else {
				this.finishEditItem(item)
			}
		}

		onDeleteHotkeyLegend = (item: HotkeyDefinition) => {
			if (this.props.showStyleBase) {
				ShowStyleBases.update(this.props.showStyleBase._id, {
					$pull: {
						hotkeyLegend: {
							_id: item._id,
						},
					},
				})
			}
		}
		onAddHotkeyLegend = () => {
			const newItem = literal<HotkeyDefinition>({
				_id: getRandomString(),
				key: '',
				label: 'New hotkey',
			})

			ShowStyleBases.update(this.props.showStyleBase._id, {
				$push: {
					hotkeyLegend: newItem,
				},
			})
		}

		onDownloadAHKScript = () => {
			// AHK = Auto Hot Key
			const mappedKeys = this.props.showStyleBase.hotkeyLegend
			let ahkCommands: string[] = _.clone(AHKBaseHeader)

			function convertComboToAHK(combo: string, isPlatform: boolean) {
				return combo
					.split(/\s*\+\s*/)
					.map((key) => {
						const lowerCaseKey = key.toLowerCase()
						if (AHKModifierMap[lowerCaseKey] !== undefined) {
							return AHKModifierMap[lowerCaseKey]
						} else if (AHKKeyboardMap[lowerCaseKey] !== undefined) {
							const ahkKey = AHKKeyboardMap[lowerCaseKey]
							return Array.isArray(ahkKey) ? ahkKey[isPlatform ? 0 : 1] : ahkKey
						} else {
							return lowerCaseKey
						}
					})
					.join('')
			}

			if (mappedKeys) {
				ahkCommands = ahkCommands.concat(
					mappedKeys
						.filter((key) => !!key.platformKey && key.key.toLowerCase() !== key.platformKey.toLowerCase())
						.map((key) => {
							const platformKeyCombo = convertComboToAHK(key.platformKey!, true)
							const browserKeyCombo = convertComboToAHK(key.key, false)

							return useAHKComboTemplate({ platformKeyCombo, browserKeyCombo })
						})
				)
			}

			const blob = new Blob([ahkCommands.join('\r\n')], { type: 'text/plain' })
			downloadBlob(
				blob,
				`${this.props.showStyleBase.name}_${new Date().toLocaleDateString()}_${new Date().toLocaleTimeString()}.ahk`
			)
		}

		exportHotkeyJSON() {
			const jsonStr = JSON.stringify(this.props.showStyleBase.hotkeyLegend, undefined, 4)

			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = `${this.props.showStyleBase._id}_${this.props.showStyleBase.name.replace(
				/\W/g,
				'_'
			)}_hotkeys.json`

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}

		importHotKeyJSON(e: React.ChangeEvent<HTMLInputElement>) {
			const { t } = this.props

			const file = e.target.files ? e.target.files[0] : null
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

				// Parse the config
				let newConfig: Array<HotkeyDefinition> = []
				try {
					newConfig = JSON.parse(uploadFileContents)
					if (!_.isArray(newConfig)) {
						throw new Error('Not an array')
					}
				} catch (err) {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to update config: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestSettings'
						)
					)
					return
				}

				// Validate the config
				const conformedConfig: Array<HotkeyDefinition> = []
				_.forEach(newConfig, (entry) => {
					const newEntry: HotkeyDefinition = {
						_id: Random.id(),
						key: entry.key || '',
						label: entry.label || '',
						sourceLayerType: entry.sourceLayerType,
						platformKey: entry.platformKey,
						buttonColor: entry.buttonColor,
					}
					conformedConfig.push(newEntry)
				})

				ShowStyleBases.update({ _id: this.props.showStyleBase._id }, { $set: { hotkeyLegend: conformedConfig } })
			}
			reader.readAsText(file)
		}

		renderItems() {
			const { t } = this.props
			return (this.props.showStyleBase.hotkeyLegend || []).map((item, index) => {
				return (
					<React.Fragment key={item.key}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(item),
							})}
						>
							<th className="settings-studio-custom-config-table__name c2">{hotkeyHelper.shortcutLabel(item.key)}</th>
							<td className="settings-studio-custom-config-table__value c3">{item.label}</td>
							{Settings.enableKeyboardPreview && (
								<>
									<td className="settings-studio-custom-config-table__value c2">{item.platformKey || ''}</td>
									<td className="settings-studio-custom-config-table__value c2">
										{item.sourceLayerType !== undefined ? SourceLayerType[item.sourceLayerType] : ''}
									</td>
								</>
							)}

							<td className="settings-studio-custom-config-table__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editItem(item)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button
									className="action-btn"
									onClick={() => this.onDeleteHotkeyLegend && this.onDeleteHotkeyLegend(item)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(item) && (
							<tr className="expando-details hl">
								<td colSpan={4}>
									<div className="properties-grid">
										<label className="field">
											<LabelActual label={t('Key')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={'hotkeyLegend.' + index + '.key'}
												obj={this.props.showStyleBase}
												type="text"
												collection={ShowStyleBases}
												className="input text-input input-l"
											></EditAttribute>
										</label>
										<label className="field">
											<LabelActual label={t('Value')} />
											<EditAttribute
												modifiedClassName="bghl"
												attribute={'hotkeyLegend.' + index + '.label'}
												obj={this.props.showStyleBase}
												type="text"
												collection={ShowStyleBases}
												className="input text-input input-l"
											></EditAttribute>
										</label>
										{Settings.enableKeyboardPreview && (
											<>
												<label className="field">
													<LabelActual label={t('Host Key')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={'hotkeyLegend.' + index + '.platformKey'}
														obj={this.props.showStyleBase}
														type="text"
														collection={ShowStyleBases}
														className="input text-input input-l"
													></EditAttribute>
												</label>

												<label className="field">
													<LabelActual label={t('Source Layer type')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={'hotkeyLegend.' + index + '.sourceLayerType'}
														obj={this.props.showStyleBase}
														type="dropdown"
														options={SourceLayerType}
														optionsAreNumbers
														collection={ShowStyleBases}
														className="input text-input input-l dropdown"
														mutateUpdateValue={(v) => (v ? v : undefined)}
													/>
												</label>

												<label className="field">
													<LabelActual label={t('Key color')} />
													<EditAttribute
														modifiedClassName="bghl"
														attribute={'hotkeyLegend.' + index + '.buttonColor'}
														obj={this.props.showStyleBase}
														options={defaultColorPickerPalette}
														type="colorpicker"
														collection={ShowStyleBases}
														className="input text-input input-s"
													></EditAttribute>
												</label>
											</>
										)}
									</div>
									<div className="mod alright">
										<button className="btn btn-primary" onClick={() => this.finishEditItem(item)}>
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

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">{t('Custom Hotkey Labels')}</h2>
					<table className="expando settings-studio-custom-config-table">
						<tbody>{this.renderItems()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={this.onAddHotkeyLegend}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
						{Settings.enableKeyboardPreview && (
							<button className="btn mls btn-secondary" onClick={this.onDownloadAHKScript}>
								<FontAwesomeIcon icon={faDownload} />
								&nbsp;{t('AHK')}
							</button>
						)}
						<button className="btn mls btn-secondary" onClick={() => this.exportHotkeyJSON()}>
							<FontAwesomeIcon icon={faDownload} />
							&nbsp;{t('Export')}
						</button>
						<UploadButton
							className="btn mls btn-secondary"
							accept="application/json,.json"
							onChange={(e) => this.importHotKeyJSON(e)}
							key={this.state.uploadFileKey}
						>
							<FontAwesomeIcon icon={faUpload} />
							&nbsp;{t('Import')}
						</UploadButton>
					</div>
				</div>
			)
		}
	}
)
