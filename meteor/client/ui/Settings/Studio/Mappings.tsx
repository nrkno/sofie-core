import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import { Studio, Studios, MappingExt, getActiveRoutes } from '../../../../lib/collections/Studios'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { withTranslation } from 'react-i18next'
import { LookaheadMode, TSR } from '@sofie-automation/blueprints-integration'
import { ConfigManifestEntryType, MappingManifestEntry, MappingsManifest } from '../../../../lib/api/deviceConfig'
import { LOOKAHEAD_DEFAULT_SEARCH_DISTANCE } from '@sofie-automation/shared-lib/dist/core/constants'
import { MongoCollection } from '../../../../lib/collections/lib'
import { renderEditAttribute } from '../components/ConfigManifestEntryComponent'

interface IStudioMappingsProps {
	studio: Studio
	manifest?: MappingsManifest
}
interface IStudioMappingsState {
	editedMappings: Array<string>
}

export const StudioMappings = withTranslation()(
	class StudioMappings extends React.Component<Translated<IStudioMappingsProps>, IStudioMappingsState> {
		constructor(props: Translated<IStudioMappingsProps>) {
			super(props)

			this.state = {
				editedMappings: [],
			}
		}
		isItemEdited = (layerId: string) => {
			return this.state.editedMappings.indexOf(layerId) >= 0
		}
		finishEditItem = (layerId: string) => {
			const index = this.state.editedMappings.indexOf(layerId)
			if (index >= 0) {
				this.state.editedMappings.splice(index, 1)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			}
		}
		editItem = (layerId: string) => {
			if (this.state.editedMappings.indexOf(layerId) < 0) {
				this.state.editedMappings.push(layerId)
				this.setState({
					editedMappings: this.state.editedMappings,
				})
			} else {
				this.finishEditItem(layerId)
			}
		}
		confirmRemove = (mappingId: string) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this mapping?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeLayer(mappingId)
				},
				message: (
					<React.Fragment>
						<p>{t('Are you sure you want to remove mapping for layer "{{mappingId}}"?', { mappingId: mappingId })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		removeLayer = (mappingId: string) => {
			const unsetObject = {}
			unsetObject['mappings.' + mappingId] = ''
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		addNewLayer = () => {
			// find free key name
			const newLayerKeyName = 'newLayer'
			let iter = 0
			while ((this.props.studio.mappings || {})[newLayerKeyName + iter.toString()]) {
				iter++
			}
			const setObject = {}
			setObject['mappings.' + newLayerKeyName + iter.toString()] = {
				device: TSR.DeviceType.CASPARCG,
				deviceId: 'newDeviceId',
			}

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		updateLayerId = (edit: EditAttributeBase, newValue: string) => {
			const oldLayerId = edit.props.overrideDisplayValue
			const newLayerId = newValue + ''
			const layer = this.props.studio.mappings[oldLayerId]

			if (this.props.studio.mappings[newLayerId]) {
				throw new Meteor.Error(400, 'Layer "' + newLayerId + '" already exists')
			}

			const mSet = {}
			const mUnset = {}
			mSet['mappings.' + newLayerId] = layer
			mUnset['mappings.' + oldLayerId] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditItem(oldLayerId)
			this.editItem(newLayerId)
		}

		renderSummary(manifest: MappingsManifest, mapping: MappingExt) {
			const m = manifest[mapping.device]
			if (m) {
				return (
					<span>
						{m
							.filter((entry) => entry.includeInSummary)
							.map((entry) => {
								const summary = entry.name + ': '

								let mappingValue = entry.values && entry.values[mapping[entry.id]]
								if (!mappingValue) {
									mappingValue = mapping[entry.id]
								}

								if (entry.type === ConfigManifestEntryType.INT && entry.zeroBased && _.isNumber(mappingValue)) {
									mappingValue += 1
								}

								return summary + mappingValue
							})
							.join(' - ')}
					</span>
				)
			} else {
				return <span>-</span>
			}
		}

		renderMappings(manifest: MappingsManifest) {
			const { t } = this.props

			const activeRoutes = getActiveRoutes(this.props.studio)

			return _.map(this.props.studio.mappings, (mapping: MappingExt, layerId: string) => {
				return (
					<React.Fragment key={layerId}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(layerId),
							})}
						>
							<th className="settings-studio-device__name c3 notifications-s notifications-text">
								{mapping.layerName || layerId}
								{activeRoutes.existing[layerId] !== undefined ? (
									<Tooltip
										overlay={t('This layer is now rerouted by an active Route Set: {{routeSets}}', {
											routeSets: activeRoutes.existing[layerId].map((s) => s.outputMappedLayer).join(', '),
											count: activeRoutes.existing[layerId].length,
										})}
										placement="right"
									>
										<span className="notification">{activeRoutes.existing[layerId].length}</span>
									</Tooltip>
								) : null}
							</th>
							<td className="settings-studio-device__id c2">{TSR.DeviceType[mapping.device]}</td>
							<td className="settings-studio-device__id c2">{mapping.deviceId}</td>
							<td className="settings-studio-device__id c4">{this.renderSummary(manifest, mapping)}</td>

							<td className="settings-studio-device__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editItem(layerId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmRemove(layerId)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(layerId) && (
							<tr className="expando-details hl">
								<td colSpan={5}>
									<div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Layer ID')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings'}
													overrideDisplayValue={layerId}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													updateFunction={this.updateLayerId}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed">{t('ID of the timeline-layer to map to some output')}</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Layer Name')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.layerName'}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed">{t('Human-readable name of the layer')}</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Device Type')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.device'}
													obj={this.props.studio}
													type="dropdown"
													options={TSR.DeviceType}
													optionsAreNumbers={true}
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed">{t('The type of device to use for the output')}</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Device ID')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.deviceId'}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
												<span className="text-s dimmed">
													{t('ID of the device (corresponds to the device ID in the peripheralDevice settings)')}
												</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Lookahead Mode')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.lookahead'}
													obj={this.props.studio}
													type="dropdown"
													options={LookaheadMode}
													optionsAreNumbers={true}
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Lookahead Target Objects (Default = 1)')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.lookaheadDepth'}
													obj={this.props.studio}
													type="int"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Lookahead Maximum Search Distance (Default = {{limit}})', {
													limit: LOOKAHEAD_DEFAULT_SEARCH_DISTANCE,
												})}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.lookaheadMaxSearchDistance'}
													obj={this.props.studio}
													type="int"
													collection={Studios}
													className="input text-input input-l"
												></EditAttribute>
											</label>
										</div>
										<DeviceMappingSettings
											mapping={mapping}
											studio={this.props.studio}
											attribute={'mappings.' + layerId}
											manifest={manifest}
										/>
									</div>
									<div className="mod alright">
										<button className={ClassNames('btn btn-primary')} onClick={() => this.finishEditItem(layerId)}>
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
					<h2 className="mhn">{t('Layer Mappings')}</h2>
					{!this.props.manifest && (
						<span>{t('Add a playout device to the studio in order to edit the layer mappings')}</span>
					)}
					{this.props.manifest && (
						<React.Fragment>
							<table className="expando settings-studio-mappings-table">
								<tbody>{this.renderMappings(this.props.manifest)}</tbody>
							</table>
							<div className="mod mhs">
								<button className="btn btn-primary" onClick={() => this.addNewLayer()}>
									<FontAwesomeIcon icon={faPlus} />
								</button>
							</div>
						</React.Fragment>
					)}
				</div>
			)
		}
	}
)

interface IDeviceMappingSettingsProps {
	studio: Studio
	mapping: MappingExt
	attribute: string
	showOptional?: boolean
	manifest: MappingsManifest
}

export const DeviceMappingSettings = withTranslation()(
	class DeviceMappingSettings extends React.Component<Translated<IDeviceMappingSettingsProps>> {
		renderOptionalInput(attribute: string, obj: any, collection: MongoCollection<any>) {
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={obj}
					type="checkbox"
					collection={collection}
					className="mod mvn mhs"
					mutateDisplayValue={(v) => (v === undefined ? false : true)}
					mutateUpdateValue={() => undefined}
				/>
			)
		}

		renderManifestEntry(attribute: string, manifest: MappingManifestEntry[], showOptional?: boolean) {
			return (
				<React.Fragment>
					{manifest.map((m) => (
						<div className="mod mvs mhs" key={m.id}>
							<label className="field">
								{m.name}
								{showOptional && this.renderOptionalInput(attribute + '.' + m.id, this.props.studio, Studios)}
								{renderEditAttribute(Studios, m as any, this.props.studio, attribute + '.')}
								{m.hint && <span className="text-s dimmed">{m.hint}</span>}
							</label>
						</div>
					))}
				</React.Fragment>
			)
		}

		render() {
			const { mapping, attribute, showOptional } = this.props
			const manifest = this.props.manifest[mapping.device]

			if (manifest) return this.renderManifestEntry(attribute, manifest, showOptional)

			return null
		}
	}
)
