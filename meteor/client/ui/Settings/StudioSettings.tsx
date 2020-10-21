import ClassNames from 'classnames'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import {
	Studio,
	Studios,
	MappingExt,
	StudioId,
	DBStudio,
	StudioRouteSet,
	StudioRouteBehavior,
	RouteMapping,
	StudioRouteSetExclusivityGroup,
	getActiveRoutes,
} from '../../../lib/collections/Studios'
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faTrash, faPencilAlt, faCheck, faPlus } from '@fortawesome/free-solid-svg-icons'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'

import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../lib/Moment'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { ShowStyleVariants, ShowStyleVariant, ShowStyleVariantId } from '../../../lib/collections/ShowStyleVariants'
import { withTranslation } from 'react-i18next'
import { ShowStyleBases, ShowStyleBase, ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import {
	LookaheadMode,
	BlueprintManifestType,
	TSR,
	ConfigManifestEntry,
	BlueprintMapping,
} from 'tv-automation-sofie-blueprints-integration'
import { ConfigManifestSettings } from './ConfigManifestSettings'
import { Blueprints, BlueprintId } from '../../../lib/collections/Blueprints'
import {
	mappingIsAbstract,
	mappingIsCasparCG,
	mappingIsAtem,
	mappingIsLawo,
	mappingIsPanasonicPtz,
	mappingIsHTTPSend,
	mappingIsHyperdeck,
	mappingIsPharos,
	mappingIsOSC,
	mappingIsQuantel,
	mappingIsSisyfos,
	mappingIsTCPSend,
	mappingIsSisyfosChannel,
} from '../../../lib/api/studios'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { getHelpMode } from '../../lib/localStorage'
import { SettingsNavigation } from '../../lib/SettingsNavigation'
import { unprotectString, protectString } from '../../../lib/lib'
import { PlayoutAPIMethods } from '../../../lib/api/playout'
import { MeteorCall } from '../../../lib/api/methods'
import { TransformedCollection } from '../../../lib/typings/meteor'
import { doUserAction, UserAction } from '../../lib/userAction'
import { Settings } from '../../../lib/Settings'

interface IStudioDevicesProps {
	studio: Studio
	studioDevices: Array<PeripheralDevice>
	availableDevices: Array<PeripheralDevice>
}
interface IStudioDevicesSettingsState {
	showAvailableDevices: boolean
}
const StudioDevices = withTranslation()(
	class StudioDevices extends React.Component<Translated<IStudioDevicesProps>, IStudioDevicesSettingsState> {
		constructor(props: Translated<IStudioDevicesProps>) {
			super(props)

			this.state = {
				showAvailableDevices: false,
			}
		}

		onRemoveDevice = (item: PeripheralDevice) => {
			PeripheralDevices.update(item._id, {
				$unset: {
					studioId: 1,
				},
			})
		}

		onAddDevice = (item: PeripheralDevice) => {
			PeripheralDevices.update(item._id, {
				$set: {
					studioId: this.props.studio._id,
				},
			})
		}
		confirmRemove = (device: PeripheralDevice) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this device?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.onRemoveDevice(device)
				},
				message: (
					<p>
						{t('Are you sure you want to remove device "{{deviceId}}"?', {
							deviceId: device && (device.name || device._id),
						})}
					</p>
				),
			})
		}

		renderDevices() {
			return this.props.studioDevices.map((device, index) => {
				return (
					<tr key={unprotectString(device._id)}>
						<th className="settings-studio-device__name c3">
							<Link to={'/settings/peripheralDevice/' + device._id}>{device.name}</Link>
						</th>
						<td className="settings-studio-device__id c3">{device._id}</td>
						<td className="settings-studio-device__id c3">
							<MomentFromNow date={device.lastSeen} />
						</td>
						<td className="settings-studio-device__actions table-item-actions c3">
							<button className="action-btn" onClick={(e) => this.confirmRemove(device)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>
				)
			})
		}

		showAvailableDevices() {
			this.setState({
				showAvailableDevices: !this.state.showAvailableDevices,
			})
		}

		isPlayoutConnected() {
			let connected = false
			this.props.studioDevices.map((device) => {
				if (device.type === PeripheralDeviceAPI.DeviceType.PLAYOUT) connected = true
			})
			return connected
		}

		render() {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">
						<Tooltip
							overlay={t('Devices are needed to control your studio hardware')}
							visible={getHelpMode() && !this.props.studioDevices.length}
							placement="right">
							<span>{t('Attached Devices')}</span>
						</Tooltip>
					</h2>
					&nbsp;
					{!this.props.studioDevices.length ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No devices connected')}
						</div>
					) : null}
					{!this.isPlayoutConnected() ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('Playout gateway not connected')}
						</div>
					) : null}
					<table className="expando settings-studio-device-table">
						<tbody>{this.renderDevices()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={(e) => this.showAvailableDevices()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
						{this.state.showAvailableDevices && (
							<div className="border-box text-s studio-devices-dropdown">
								<div className="ctx-menu">
									{this.props.availableDevices.map((device) => {
										return (
											<div
												className="ctx-menu-item"
												key={unprotectString(device._id)}
												onClick={(e) => this.onAddDevice(device)}>
												<b>{device.name}</b> <MomentFromNow date={device.lastSeen} /> ({unprotectString(device._id)})
											</div>
										)
									})}
								</div>
							</div>
						)}
					</div>
				</div>
			)
		}
	}
)

interface IDeviceMappingSettingsProps {
	studio: Studio
	mapping: BlueprintMapping
	attribute: string
	showOptional?: boolean
}

const DeviceMappingSettings = withTranslation()(
	class DeviceMappingSettings extends React.Component<Translated<IDeviceMappingSettingsProps>> {
		renderOptionalInput(attribute: string, obj: any, collection: TransformedCollection<any, any>) {
			return (
				<EditAttribute
					modifiedClassName="bghl"
					attribute={attribute}
					obj={obj}
					type="checkbox"
					collection={collection}
					className="mod mvn mhs"
					mutateDisplayValue={(v) => (v === undefined ? false : true)}
					mutateUpdateValue={(v) => undefined}
				/>
			)
		}

		renderCasparCGMappingSettings(attribute: string, showOptional?: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('CasparCG Channel')}
							{showOptional && this.renderOptionalInput(attribute + '.channel', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.channel'}
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
							<span className="text-s dimmed">{t('The CasparCG channel to use (1 is the first)')}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('CasparCG Layer')}
							{showOptional && this.renderOptionalInput(attribute + '.layer', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.layer'}
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
							<span className="text-s dimmed">{t('The layer in a channel to use')}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Preview when not on air')}
							{showOptional && this.renderOptionalInput(attribute + '.previewWhenNotOnAir', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.previewWhenNotOnAir'}
								obj={this.props.studio}
								type="checkbox"
								collection={Studios}
								className="input"></EditAttribute>
							<span className="text-s dimmed">{t('Whether to load to first frame')}</span>
						</label>
					</div>
				</React.Fragment>
			)
		}

		renderAtemMappingSettings(attribute: string, showOptional?: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Mapping type')}
							{showOptional && this.renderOptionalInput(attribute + '.mappingType', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.mappingType'}
								obj={this.props.studio}
								type="dropdown"
								options={TSR.MappingAtemType}
								optionsAreNumbers={true}
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Index')}
							{showOptional && this.renderOptionalInput(attribute + '.index', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.index'}
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
				</React.Fragment>
			)
		}
		renderLawoMappingSettings(attribute: string, showOptional?: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Mapping type')}
							{showOptional && this.renderOptionalInput(attribute + '.mappingType', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.mappingType'}
								obj={this.props.studio}
								type="dropdown"
								options={TSR.MappingLawoType}
								optionsAreNumbers={false}
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Identifier')}
							{showOptional && this.renderOptionalInput(attribute + '.identifier', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.identifier'}
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Priority')}
							{showOptional && this.renderOptionalInput(attribute + '.priority', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.priority'}
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
				</React.Fragment>
			)
		}
		renderPanasonicPTZSettings(attribute: string, showOptional?: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Mapping type')}
							{showOptional && this.renderOptionalInput(attribute + '.mappingType', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.mappingType'}
								obj={this.props.studio}
								type="dropdown"
								options={TSR.MappingPanasonicPtzType}
								optionsAreNumbers={false}
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
				</React.Fragment>
			)
		}
		renderTCPSendSettings(attribute: string, _showOptional?: boolean) {
			const { t } = this.props
			return <React.Fragment></React.Fragment>
		}

		renderHyperdeckMappingSettings(attribute: string, showOptional?: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Mapping type')}
							{showOptional && this.renderOptionalInput(attribute + '.mappingType', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.mappingType'}
								obj={this.props.studio}
								type="dropdown"
								options={TSR.MappingHyperdeckType}
								optionsAreNumbers={false}
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
				</React.Fragment>
			)
		}
		renderPharosMappingSettings(attribute: string, _showOptional?: boolean) {
			return <React.Fragment></React.Fragment>
		}
		renderSisyfosMappingSettings(prefix: string, showOptional?: boolean) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Sisyfos Channel')}
							{showOptional && this.renderOptionalInput(prefix + '.channel', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={prefix + '.channel'}
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
				</React.Fragment>
			)
		}
		renderQuantelMappingSettings(attribute: string, showOptional?: boolean) {
			const { t } = this.props

			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Quantel Port ID')}
							{showOptional && this.renderOptionalInput(attribute + '.portId', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.portId'}
								obj={this.props.studio}
								type="text"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
							<span className="text-s dimmed">{t("The name you'd like the port to have")}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Quantel Channel ID')}
							{showOptional && this.renderOptionalInput(attribute + '.channelId', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.channelId'}
								obj={this.props.studio}
								type="int"
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
							<span className="text-s dimmed">{t('The channel to use for output (0 is the first one)')}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Mode')}
							{showOptional && this.renderOptionalInput(attribute + '.mode', this.props.studio, Studios)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={attribute + '.mode'}
								obj={this.props.studio}
								type="dropdown"
								options={TSR.QuantelControlMode}
								optionsAreNumbers={false}
								collection={Studios}
								className="input text-input input-l"></EditAttribute>
						</label>
					</div>
				</React.Fragment>
			)
		}
		render() {
			const { mapping, attribute, showOptional } = this.props

			return mappingIsCasparCG(mapping)
				? this.renderCasparCGMappingSettings(attribute, showOptional)
				: mappingIsAtem(mapping)
				? this.renderAtemMappingSettings(attribute, showOptional)
				: mappingIsLawo(mapping)
				? this.renderLawoMappingSettings(attribute, showOptional)
				: mappingIsPanasonicPtz(mapping)
				? this.renderPanasonicPTZSettings(attribute, showOptional)
				: mappingIsTCPSend(mapping)
				? this.renderTCPSendSettings(attribute, showOptional)
				: mappingIsHyperdeck(mapping)
				? this.renderHyperdeckMappingSettings(attribute, showOptional)
				: mappingIsPharos(mapping)
				? this.renderPharosMappingSettings(attribute, showOptional)
				: mappingIsSisyfos(mapping)
				? this.renderSisyfosMappingSettings(attribute, showOptional)
				: mappingIsQuantel(mapping)
				? this.renderQuantelMappingSettings(attribute, showOptional)
				: null
		}
	}
)

interface IStudioMappingsProps {
	studio: Studio
}
interface IStudioMappingsState {
	editedMappings: Array<string>
}

const StudioMappings = withTranslation()(
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
			let index = this.state.editedMappings.indexOf(layerId)
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
			let unsetObject = {}
			unsetObject['mappings.' + mappingId] = ''
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		addNewLayer = () => {
			// find free key name
			let newLayerKeyName = 'newLayer'
			let iter = 0
			while ((this.props.studio.mappings || {})[newLayerKeyName + iter.toString()]) {
				iter++
			}
			let setObject = {}
			setObject['mappings.' + newLayerKeyName + iter.toString()] = {
				device: TSR.DeviceType.CASPARCG,
				deviceId: 'newDeviceId',
			}

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		updateLayerId = (edit: EditAttributeBase, newValue: string) => {
			let oldLayerId = edit.props.overrideDisplayValue
			let newLayerId = newValue + ''
			let layer = this.props.studio.mappings[oldLayerId]

			if (this.props.studio.mappings[newLayerId]) {
				throw new Meteor.Error(400, 'Layer "' + newLayerId + '" already exists')
			}

			let mSet = {}
			let mUnset = {}
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

		renderMappings() {
			const { t } = this.props

			const activeRoutes = getActiveRoutes(this.props.studio)

			return _.map(this.props.studio.mappings, (mapping: MappingExt, layerId: string) => {
				// If an internal mapping, then hide it
				if (mapping.internal) return <React.Fragment key={layerId}></React.Fragment>

				return (
					<React.Fragment key={layerId}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(layerId),
							})}>
							<th className="settings-studio-device__name c3 notifications-s notifications-text">
								{layerId}
								{activeRoutes.existing[layerId] !== undefined ? (
									<Tooltip
										overlay={t('This layer is now rerouted by an active Route Set: {{routeSets}}', {
											routeSets: activeRoutes.existing[layerId].join(', '),
											count: activeRoutes.existing[layerId].length,
										})}
										placement="right">
										<span className="notification">{activeRoutes.existing[layerId].length}</span>
									</Tooltip>
								) : null}
							</th>
							<td className="settings-studio-device__id c2">{TSR.DeviceType[mapping.device]}</td>
							<td className="settings-studio-device__id c2">{mapping.deviceId}</td>
							<td className="settings-studio-device__id c4">
								{(mappingIsAbstract(mapping) && <span>-</span>) ||
									(mappingIsCasparCG(mapping) && (
										<span>
											{mapping.channel} - {mapping.layer}
										</span>
									)) ||
									(mappingIsAtem(mapping) && (
										<span>
											{TSR.MappingAtemType[mapping.mappingType]} {mapping.index}
										</span>
									)) ||
									(mappingIsLawo(mapping) && (
										<span>
											{TSR.MappingLawoType[mapping.mappingType]} {mapping.identifier}
										</span>
									)) ||
									(mappingIsPanasonicPtz(mapping) && (
										<span>
											{mapping.mappingType === TSR.MappingPanasonicPtzType.PRESET
												? t('Preset')
												: mapping.mappingType === TSR.MappingPanasonicPtzType.PRESET_SPEED
												? t('Preset Transition Speed')
												: mapping.mappingType === TSR.MappingPanasonicPtzType.ZOOM
												? t('Zoom')
												: mapping.mappingType === TSR.MappingPanasonicPtzType.ZOOM_SPEED
												? t('Zoom Speed')
												: t('Unknown Mapping')}
										</span>
									)) ||
									(mappingIsHTTPSend(mapping) && <span>-</span>) ||
									(mappingIsHyperdeck(mapping) && <span>{mapping.mappingType}</span>) ||
									(mappingIsPharos(mapping) && <span>-</span>) ||
									(mappingIsOSC(mapping) && <span>-</span>) ||
									(mappingIsSisyfos(mapping) && mappingIsSisyfosChannel(mapping) ? (
										<span>{t('Channel: {{channel}}', { channel: mapping.channel })}</span>
									) : (
										''
									)) ||
									(mappingIsQuantel(mapping) && (
										<span>
											{t('Port: {{port}}, Channel: {{channel}}', { port: mapping.portId, channel: mapping.channelId })}
										</span>
									)) || (
										<span>{t('Unknown device type: {{device}}', { device: TSR.DeviceType[mapping.device] })} </span>
									)}
							</td>

							<td className="settings-studio-device__actions table-item-actions c3">
								<button className="action-btn" onClick={(e) => this.editItem(layerId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={(e) => this.confirmRemove(layerId)}>
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
													className="input text-input input-l"></EditAttribute>
												<span className="text-s dimmed">{t('ID of the timeline-layer to map to some output')}</span>
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
													className="input text-input input-l"></EditAttribute>
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
													className="input text-input input-l"></EditAttribute>
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
													className="input text-input input-l"></EditAttribute>
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
													className="input text-input input-l"></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Lookahead Maximum Search Distance (Default = unlimited/-1)')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'mappings.' + layerId + '.lookaheadMaxSearchDistance'}
													obj={this.props.studio}
													type="int"
													collection={Studios}
													className="input text-input input-l"></EditAttribute>
											</label>
										</div>
										<DeviceMappingSettings
											mapping={mapping}
											studio={this.props.studio}
											attribute={'mappings.' + layerId}
										/>
									</div>
									<div className="mod alright">
										<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(layerId)}>
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
					<table className="expando settings-studio-mappings-table">
						<tbody>{this.renderMappings()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={(e) => this.addNewLayer()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</div>
			)
		}
	}
)

interface IStudioRoutingsProps {
	studio: Studio
}
interface IStudioRoutingsState {
	editedRouteSets: Array<string>
}

const StudioRoutings = withTranslation()(
	class StudioRoutings extends React.Component<Translated<IStudioRoutingsProps>, IStudioRoutingsState> {
		constructor(props: Translated<IStudioRoutingsProps>) {
			super(props)

			this.state = {
				editedRouteSets: [],
			}
		}
		isItemEdited = (routeSetId: string) => {
			return this.state.editedRouteSets.indexOf(routeSetId) >= 0
		}
		finishEditItem = (routeSetId: string) => {
			let index = this.state.editedRouteSets.indexOf(routeSetId)
			if (index >= 0) {
				this.state.editedRouteSets.splice(index, 1)
				this.setState({
					editedRouteSets: this.state.editedRouteSets,
				})
			}
		}
		editItem = (routeSetId: string) => {
			if (this.state.editedRouteSets.indexOf(routeSetId) < 0) {
				this.state.editedRouteSets.push(routeSetId)
				this.setState({
					editedRouteSets: this.state.editedRouteSets,
				})
			} else {
				this.finishEditItem(routeSetId)
			}
		}
		confirmRemoveEGroup = (eGroupId: string, exclusivityGroup: StudioRouteSetExclusivityGroup) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Exclusivity Group?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeExclusivityGroup(eGroupId)
				},
				message: (
					<React.Fragment>
						<p>
							{t(
								'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
								{
									eGroupName: exclusivityGroup.name,
								}
							)}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		confirmRemoveRoute = (routeSetId: string, route: RouteMapping, index: number) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Route from this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeRouteSetRoute(routeSetId, index)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove the Route from "{{sourceLayerId}}" to "{{newLayerId}}"?', {
								sourceLayerId: route.mappedLayer,
								newLayerId: route.outputMappedLayer,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		confirmRemove = (routeSetId: string) => {
			const { t } = this.props
			doModalDialog({
				title: t('Remove this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					this.removeRouteSet(routeSetId)
				},
				message: (
					<React.Fragment>
						<p>{t('Are you sure you want to remove the Route Set "{{routeId}}"?', { routeId: routeSetId })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		removeExclusivityGroup = (eGroupId: string) => {
			let unsetObject = {}
			_.forEach(this.props.studio.routeSets, (routeSet, routeSetId) => {
				if (routeSet.exclusivityGroup === eGroupId) {
					unsetObject['routeSets.' + routeSetId + '.exclusivityGroup'] = 1
				}
			})
			unsetObject['routeSetExclusivityGroups.' + eGroupId] = ''
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		removeRouteSetRoute = (routeId: string, index: number) => {
			let unsetObject = {}
			const newRoutes = this.props.studio.routeSets[routeId].routes.slice()
			newRoutes.splice(index, 1)
			unsetObject['routeSets.' + routeId + '.routes'] = newRoutes
			Studios.update(this.props.studio._id, {
				$set: unsetObject,
			})
		}
		removeRouteSet = (routeId: string) => {
			let unsetObject = {}
			unsetObject['routeSets.' + routeId] = ''
			Studios.update(this.props.studio._id, {
				$unset: unsetObject,
			})
		}
		addNewRouteInSet = (routeId: string) => {
			let newRouteKeyName = 'newRouteSet'
			let iter: number = 0
			while ((this.props.studio.routeSets || {})[newRouteKeyName + iter]) {
				iter++
			}

			let newRoute: RouteMapping = {
				mappedLayer: '',
				outputMappedLayer: '',
				remapping: {},
			}
			let setObject = {}
			setObject['routeSets.' + routeId + '.routes'] = newRoute

			Studios.update(this.props.studio._id, {
				$push: setObject,
			})
		}
		addNewRouteSet = () => {
			// find free key name
			let newRouteKeyName = 'newRouteSet'
			let iter: number = 0
			while ((this.props.studio.routeSets || {})[newRouteKeyName + iter]) {
				iter++
			}

			let newRoute: StudioRouteSet = {
				name: 'New Route Set',
				active: false,
				routes: [],
				behavior: StudioRouteBehavior.TOGGLE,
			}
			let setObject: Partial<DBStudio> = {}
			setObject['routeSets.' + newRouteKeyName + iter] = newRoute

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		addNewExclusivityGroup = () => {
			let newEGroupKeyName = 'exclusivityGroup'
			let iter: number = 0
			while ((this.props.studio.routeSetExclusivityGroups || {})[newEGroupKeyName + iter]) {
				iter++
			}

			let newGroup: StudioRouteSetExclusivityGroup = {
				name: 'New Exclusivity Group',
			}
			let setObject: Partial<DBStudio> = {}
			setObject['routeSetExclusivityGroups.' + newEGroupKeyName + iter] = newGroup

			Studios.update(this.props.studio._id, {
				$set: setObject,
			})
		}
		updateRouteSetId = (edit: EditAttributeBase, newValue: string) => {
			let oldRouteId = edit.props.overrideDisplayValue
			let newRouteId = newValue + ''
			let route = this.props.studio.routeSets[oldRouteId]

			if (this.props.studio.routeSets[newRouteId]) {
				throw new Meteor.Error(400, 'Route Set "' + newRouteId + '" already exists')
			}

			let mSet = {}
			let mUnset = {}
			mSet['routeSets.' + newRouteId] = route
			mUnset['routeSets.' + oldRouteId] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditItem(oldRouteId)
			this.editItem(newRouteId)
		}
		updateExclusivityGroupId = (edit: EditAttributeBase, newValue: string) => {
			let oldRouteId = edit.props.overrideDisplayValue
			let newRouteId = newValue + ''
			let route = this.props.studio.routeSetExclusivityGroups[oldRouteId]

			if (this.props.studio.routeSetExclusivityGroups[newRouteId]) {
				throw new Meteor.Error(400, 'Exclusivity Group "' + newRouteId + '" already exists')
			}

			let mSet = {}
			let mUnset = {}
			mSet['routeSetExclusivityGroups.' + newRouteId] = route
			mUnset['routeSetExclusivityGroups.' + oldRouteId] = 1

			if (edit.props.collection) {
				edit.props.collection.update(this.props.studio._id, {
					$set: mSet,
					$unset: mUnset,
				})
			}

			this.finishEditItem(oldRouteId)
			this.editItem(newRouteId)
		}
		updateRouteSetActive = (routeSetId: string, value: boolean) => {
			const { t } = this.props
			doUserAction(t, 'StudioSettings', UserAction.SWITCH_ROUTE_SET, (e) =>
				MeteorCall.userAction.switchRouteSet(e, this.props.studio._id, routeSetId, value)
			)
		}

		renderRoutes(routeSet: StudioRouteSet, routeSetId: string) {
			const { t } = this.props

			return (
				<React.Fragment>
					<h4 className="mod mhs">{t('Routes')}</h4>
					{routeSet.routes.length === 0 ? (
						<p className="text-s dimmed mhs">{t('There are no routes set up yet')}</p>
					) : null}
					{routeSet.routes.map((route, index) => {
						const deviceTypeFromMappedLayer: TSR.DeviceType | undefined = route.mappedLayer
							? this.props.studio.mappings[route.mappedLayer]?.device
							: undefined
						const routeDeviceType: TSR.DeviceType | undefined = route.mappedLayer
							? deviceTypeFromMappedLayer
							: route.deviceType
						return (
							<div className="route-sets-editor mod pan mas" key={index}>
								<button
									className="action-btn right mod man pas"
									onClick={(e) => this.confirmRemoveRoute(routeSetId, route, index)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
								<div>
									<div className="mod mvs mhs">
										<label className="field">
											{t('Original Layer')}
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.mappedLayer`}
												obj={this.props.studio}
												type="dropdowntext"
												options={Object.keys(this.props.studio.mappings)}
												label={t('None')}
												collection={Studios}
												className="input text-input input-l"></EditAttribute>
										</label>
									</div>
									<div className="mod mvs mhs">
										<label className="field">
											{t('New Layer')}
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.outputMappedLayer`}
												obj={this.props.studio}
												type="text"
												collection={Studios}
												className="input text-input input-l"></EditAttribute>
										</label>
									</div>
									<div className="mod mvs mhs">
										{t('Device Type')}
										{route.mappedLayer ? (
											deviceTypeFromMappedLayer ? (
												<span className="mls">{TSR.DeviceType[deviceTypeFromMappedLayer]}</span>
											) : (
												<span className="mls dimmed">{t('Source Layer not found')}</span>
											)
										) : (
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`routeSets.${routeSetId}.routes.${index}.deviceType`}
												obj={this.props.studio}
												type="dropdown"
												options={TSR.DeviceType}
												optionsAreNumbers={true}
												collection={Studios}
												className="input text-input input-l"></EditAttribute>
										)}
									</div>
									{routeDeviceType && route.remapping !== undefined && (
										<>
											<div className="mod mvs mhs">
												<label className="field">
													{t('Device ID')}
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
														obj={this.props.studio}
														type="checkbox"
														collection={Studios}
														className="mod mvn mhs"
														mutateDisplayValue={(v) => (v === undefined ? false : true)}
														mutateUpdateValue={(v) => undefined}
													/>
													<EditAttribute
														modifiedClassName="bghl"
														attribute={`routeSets.${routeSetId}.routes.${index}.remapping.deviceId`}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"></EditAttribute>
												</label>
											</div>
											<DeviceMappingSettings
												mapping={
													{
														device: routeDeviceType,
														...route.remapping,
													} as BlueprintMapping
												}
												studio={this.props.studio}
												attribute={`routeSets.${routeSetId}.routes.${index}.remapping`}
												showOptional={true}
											/>
										</>
									)}
								</div>
							</div>
						)
					})}
				</React.Fragment>
			)
		}

		renderExclusivityGroups() {
			const { t } = this.props

			if (Object.keys(this.props.studio.routeSetExclusivityGroups).length === 0) {
				return (
					<tr>
						<td className="mhn dimmed">{t('There are no exclusivity groups set up.')}</td>
					</tr>
				)
			}

			return _.map(
				this.props.studio.routeSetExclusivityGroups,
				(exclusivityGroup: StudioRouteSetExclusivityGroup, exclusivityGroupId: string) => {
					return (
						<React.Fragment key={exclusivityGroupId}>
							<tr
								className={ClassNames({
									hl: this.isItemEdited(exclusivityGroupId),
								})}>
								<th className="settings-studio-device__name c3">{exclusivityGroupId}</th>
								<td className="settings-studio-device__id c5">{exclusivityGroup.name}</td>
								<td className="settings-studio-device__id c3">
									{
										_.filter(
											this.props.studio.routeSets,
											(routeSet, id) => routeSet.exclusivityGroup === exclusivityGroupId
										).length
									}
								</td>

								<td className="settings-studio-device__actions table-item-actions c3">
									<button className="action-btn" onClick={(e) => this.editItem(exclusivityGroupId)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									<button
										className="action-btn"
										onClick={(e) => this.confirmRemoveEGroup(exclusivityGroupId, exclusivityGroup)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
							{this.isItemEdited(exclusivityGroupId) && (
								<tr className="expando-details hl">
									<td colSpan={6}>
										<div>
											<div className="mod mvs mhs">
												<label className="field">
													{t('Exclusivity Group ID')}
													<EditAttribute
														modifiedClassName="bghl"
														attribute={'routeSetExclusivityGroups'}
														overrideDisplayValue={exclusivityGroupId}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														updateFunction={this.updateExclusivityGroupId}
														className="input text-input input-l"></EditAttribute>
												</label>
											</div>
											<div className="mod mvs mhs">
												<label className="field">
													{t('Exclusivity Group Name')}
													<EditAttribute
														modifiedClassName="bghl"
														attribute={'routeSetExclusivityGroups.' + exclusivityGroupId + '.name'}
														obj={this.props.studio}
														type="text"
														collection={Studios}
														className="input text-input input-l"></EditAttribute>
													<span className="text-s dimmed">{t('Display name of the Exclusivity Group')}</span>
												</label>
											</div>
										</div>
										<div className="mod alright">
											<button className="btn btn-primary" onClick={(e) => this.finishEditItem(exclusivityGroupId)}>
												<FontAwesomeIcon icon={faCheck} />
											</button>
										</div>
									</td>
								</tr>
							)}
						</React.Fragment>
					)
				}
			)
		}

		renderRouteSets() {
			const { t } = this.props

			const DEFAULT_ACTIVE_OPTIONS = {
				[t('Active')]: true,
				[t('Not Active')]: false,
				[t('Not defined')]: undefined,
			}

			if (Object.keys(this.props.studio.routeSets).length === 0) {
				return (
					<tr>
						<td className="mhn dimmed">{t('There are no Route Sets set up.')}</td>
					</tr>
				)
			}

			return _.map(this.props.studio.routeSets, (routeSet: StudioRouteSet, routeId: string) => {
				return (
					<React.Fragment key={routeId}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(routeId),
							})}>
							<th className="settings-studio-device__name c2">{routeId}</th>
							<td className="settings-studio-device__id c3">{routeSet.name}</td>
							<td className="settings-studio-device__id c4">{routeSet.exclusivityGroup}</td>
							<td className="settings-studio-device__id c2">{routeSet.routes.length}</td>
							<td className="settings-studio-device__id c2">
								{routeSet.active ? <span className="pill">{t('Active')}</span> : null}
							</td>

							<td className="settings-studio-device__actions table-item-actions c3">
								<button className="action-btn" onClick={(e) => this.editItem(routeId)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={(e) => this.confirmRemove(routeId)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(routeId) && (
							<tr className="expando-details hl">
								<td colSpan={6}>
									<div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Route Set ID')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'routeSets'}
													overrideDisplayValue={routeId}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													updateFunction={this.updateRouteSetId}
													className="input text-input input-l"></EditAttribute>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.active`}
													obj={this.props.studio}
													type="checkbox"
													collection={Studios}
													updateFunction={(_ctx, value) => this.updateRouteSetActive(routeId, value)}
													disabled={routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY && routeSet.active}
													className=""></EditAttribute>
												{t('Active')}
												<span className="mlm text-s dimmed">{t('Is this Route Set currently active')}</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Default State')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.defaultActive`}
													obj={this.props.studio}
													type="dropdown"
													collection={Studios}
													options={DEFAULT_ACTIVE_OPTIONS}
													className="input text-input input-l"></EditAttribute>
												<span className="mlm text-s dimmed">{t('The default state of this Route Set')}</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Route Set Name')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.name`}
													obj={this.props.studio}
													type="text"
													collection={Studios}
													className="input text-input input-l"></EditAttribute>
												<span className="text-s dimmed">{t('Display name of the Route Set')}</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Exclusivity group')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.exclusivityGroup`}
													obj={this.props.studio}
													type="checkbox"
													collection={Studios}
													className="mod mas"
													mutateDisplayValue={(v) => (v === undefined ? false : true)}
													mutateUpdateValue={(v) => undefined}
												/>
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.exclusivityGroup`}
													obj={this.props.studio}
													type="dropdown"
													options={Object.keys(this.props.studio.routeSetExclusivityGroups)}
													mutateDisplayValue={(v) => (v === undefined ? 'None' : v)}
													collection={Studios}
													className="input text-input input-l"></EditAttribute>
												<span className="text-s dimmed">
													{t('If set, only one Route Set will be active per exclusivity group')}
												</span>
											</label>
										</div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Behavior')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={`routeSets.${routeId}.behavior`}
													obj={this.props.studio}
													type="dropdown"
													options={StudioRouteBehavior}
													optionsAreNumbers={true}
													collection={Studios}
													className="input text-input input-l"></EditAttribute>
												<span className="text-s dimmed">
													{t('The way this Route Set should behave towards the user')}
												</span>
											</label>
										</div>
									</div>
									{this.renderRoutes(routeSet, routeId)}
									<div className="mod">
										<button className="btn btn-primary right" onClick={(e) => this.finishEditItem(routeId)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
										<button className="btn btn-secondary" onClick={(e) => this.addNewRouteInSet(routeId)}>
											<FontAwesomeIcon icon={faPlus} />
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
					<h2 className="mhn mbs">{t('Route Sets')}</h2>
					<p className="mhn mvs text-s dimmed">
						{t(
							'Controls for exposed Route Sets will be displayed to the producer within the Rundown View in the Switchboard.'
						)}
					</p>
					<h3 className="mhn">{t('Exclusivity Groups')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>{this.renderExclusivityGroups()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={(e) => this.addNewExclusivityGroup()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
					<h3 className="mhn">{t('Route Sets')}</h3>
					<table className="expando settings-studio-mappings-table">
						<tbody>{this.renderRouteSets()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={(e) => this.addNewRouteSet()}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</div>
			)
		}
	}
)

interface IStudioSettingsProps {
	match: {
		params: {
			studioId: StudioId
		}
	}
}
interface IStudioSettingsState {}
interface IStudioSettingsTrackedProps {
	studio?: Studio
	studioDevices: Array<PeripheralDevice>
	availableShowStyleVariants: Array<{
		name: string
		value: ShowStyleVariantId
		showStyleVariant: ShowStyleVariant
	}>
	availableShowStyleBases: Array<{
		name: string
		value: ShowStyleBaseId
		showStyleBase: ShowStyleBase
	}>
	availableDevices: Array<PeripheralDevice>
	blueprintConfigManifest: ConfigManifestEntry[]
}

interface IStudioBaselineStatusProps {
	studio: Studio
}
interface IStudioBaselineStatusState {
	needsUpdate: boolean
}

class StudioBaselineStatus extends MeteorReactComponent<
	Translated<IStudioBaselineStatusProps>,
	IStudioBaselineStatusState
> {
	private updateInterval: number | undefined = undefined

	constructor(props: Translated<IStudioBaselineStatusProps>) {
		super(props)

		this.state = {
			needsUpdate: false,
		}
	}

	componentDidMount() {
		const updatePeriod = 30000 // every 30s
		this.updateInterval = Meteor.setInterval(() => this.updateStatus(), updatePeriod)
		this.updateStatus()
	}

	componentWillUnmount() {
		if (this.updateInterval) {
			Meteor.clearInterval(this.updateInterval)
			this.updateInterval = undefined
		}
	}

	updateStatus(props?: Translated<IStudioBaselineStatusProps>) {
		const studio = props ? props.studio : this.props.studio

		MeteorCall.playout
			.shouldUpdateStudioBaseline(studio._id)
			.then((result) => {
				if (this.updateInterval) this.setState({ needsUpdate: !!result })
			})
			.catch((err) => {
				console.error('Failed to update studio baseline status', err)
				if (this.updateInterval) this.setState({ needsUpdate: false })
			})
	}

	reloadBaseline() {
		MeteorCall.playout
			.updateStudioBaseline(this.props.studio._id)
			.then((result) => {
				if (this.updateInterval) this.setState({ needsUpdate: !!result })
			})
			.catch((err) => {
				console.error('Failed to update studio baseline', err)
				if (this.updateInterval) this.setState({ needsUpdate: false })
			})
	}

	render() {
		const { t } = this.props
		const { needsUpdate } = this.state

		return (
			<div>
				<p className="mhn">
					{t('Studio Baseline needs update: ')}&nbsp;
					{needsUpdate ? (
						<Tooltip
							overlay={t('Baseline needs reload, this studio may not work until reloaded')}
							visible={getHelpMode()}
							placement="right">
							<span>{t('Yes')}</span>
						</Tooltip>
					) : (
						t('No')
					)}
					{needsUpdate ? (
						<span className="error-notice inline">
							{t('Reload Baseline')} <FontAwesomeIcon icon={faExclamationTriangle} />
						</span>
					) : null}
				</p>
				<p className="mhn">
					<button className="btn btn-primary" onClick={(e) => this.reloadBaseline()}>
						{t('Reload Baseline')}
					</button>
				</p>
			</div>
		)
	}
}

export default translateWithTracker<IStudioSettingsProps, IStudioSettingsState, IStudioSettingsTrackedProps>(
	(props: IStudioSettingsProps, state) => {
		const studio = Studios.findOne(props.match.params.studioId)
		const blueprint = studio
			? Blueprints.findOne({
					_id: studio.blueprintId,
					blueprintType: BlueprintManifestType.STUDIO,
			  })
			: undefined

		return {
			studio: studio,
			studioDevices: PeripheralDevices.find({
				studioId: props.match.params.studioId,
			}).fetch(),
			availableShowStyleVariants: ShowStyleVariants.find(
				studio
					? {
							showStyleBaseId: {
								$in: studio.supportedShowStyleBase || [],
							},
					  }
					: {}
			)
				.fetch()
				.map((variant) => {
					const baseStyle = ShowStyleBases.findOne(variant.showStyleBaseId)
					return {
						name: `${(baseStyle || { name: '' }).name}: ${variant.name} (${variant._id})`,
						value: variant._id,
						showStyleVariant: variant,
					}
				}),
			availableShowStyleBases: ShowStyleBases.find()
				.fetch()
				.map((showStyle) => {
					return {
						name: `${showStyle.name}`,
						value: showStyle._id,
						showStyleBase: showStyle,
					}
				}),
			availableDevices: PeripheralDevices.find(
				{
					studioId: {
						$not: {
							$eq: props.match.params.studioId,
						},
					},
					parentDeviceId: {
						$exists: false,
					},
				},
				{
					sort: {
						lastConnected: -1,
					},
				}
			).fetch(),
			blueprintConfigManifest: blueprint ? blueprint.studioConfigManifest || [] : [],
		}
	}
)(
	class StudioSettings extends MeteorReactComponent<
		Translated<IStudioSettingsProps & IStudioSettingsTrackedProps>,
		IStudioSettingsState
	> {
		getBlueprintOptions() {
			const { t } = this.props

			let options: { name: string; value: BlueprintId | null }[] = [
				{
					name: t('None'),
					value: protectString(''),
				},
			]

			options.push(
				..._.map(Blueprints.find({ blueprintType: BlueprintManifestType.STUDIO }).fetch(), (blueprint) => {
					return {
						name: blueprint.name ? blueprint.name + ` (${blueprint._id})` : unprotectString(blueprint._id),
						value: blueprint._id,
					}
				})
			)

			return options
		}

		renderShowStyleEditButtons() {
			const { t } = this.props
			let buttons: JSX.Element[] = []
			if (this.props.studio) {
				this.props.studio.supportedShowStyleBase.map((style) => {
					let base = this.props.availableShowStyleBases.find((base) => base.showStyleBase._id === style)
					if (base) {
						buttons.push(
							<SettingsNavigation
								key={'settings-nevigation-' + base.showStyleBase.name}
								attribute="name"
								obj={base.showStyleBase}
								type="showstyle"></SettingsNavigation>
						)
					}
				})
			}
			return buttons
		}

		getLayerMappingsFlat() {
			const mappings = {}
			if (this.props.studio) {
				mappings[this.props.studio.name] = this.props.studio.mappings
			}
			return mappings
		}

		renderEditForm() {
			const { t } = this.props

			return this.props.studio ? (
				<div className="studio-edit mod mhl mvn">
					<div>
						<h2 className="mhn mtn">{t('Generic Properties')}</h2>
						<label className="field">
							{t('Studio Name')}
							{!this.props.studio.name ? (
								<div className="error-notice inline">
									{t('No name set')} <FontAwesomeIcon icon={faExclamationTriangle} />
								</div>
							) : null}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="name"
									obj={this.props.studio}
									type="text"
									collection={Studios}
									className="mdinput"></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
						<label className="field">
							{t('Blueprint')}
							{!this.props.studio.blueprintId ? (
								<div className="error-notice inline">
									{t('Blueprint not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
								</div>
							) : null}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="blueprintId"
									obj={this.props.studio}
									type="dropdown"
									options={this.getBlueprintOptions()}
									mutateDisplayValue={(v) => v || ''}
									mutateUpdateValue={(v) => (v === '' ? undefined : v)}
									collection={Studios}
									className="mdinput"></EditAttribute>
								<SettingsNavigation
									attribute="blueprintId"
									obj={this.props.studio}
									type="blueprint"></SettingsNavigation>
								<span className="mdfx"></span>
							</div>
						</label>
						<div className="field">
							{t('Select Compatible Show Styles')}
							{!this.props.studio.supportedShowStyleBase.length ? (
								<div className="error-notice inline">
									{t('Show style not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
								</div>
							) : null}
							<div className="mdi">
								<EditAttribute
									attribute="supportedShowStyleBase"
									obj={this.props.studio}
									options={this.props.availableShowStyleBases}
									label={t('Click to show available Show Styles')}
									type="multiselect"
									collection={Studios}></EditAttribute>
								{this.renderShowStyleEditButtons()}
								<SettingsNavigation type="newshowstyle" />
							</div>
						</div>
						<div className="mod mtn mbm mhn">
							<label className="field">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.enablePlayFromAnywhere"
									obj={this.props.studio}
									type="checkbox"
									collection={Studios}></EditAttribute>
								{t('Enable Play from Anywhere™')}
							</label>
						</div>
						<label className="field">
							{t('Media Preview URL')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.mediaPreviewsUrl"
									obj={this.props.studio}
									type="text"
									collection={Studios}
									className="mdinput"></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
						<label className="field">
							{t('Sofie Host URL')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.sofieUrl"
									obj={this.props.studio}
									type="text"
									collection={Studios}
									className="mdinput"></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
						<label className="field">
							{t('Slack Webhook URLs')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.slackEvaluationUrls"
									obj={this.props.studio}
									type="text"
									collection={Studios}
									className="mdinput"></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
						<label className="field">
							{t('Supported Media Formats')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.supportedMediaFormats"
									obj={this.props.studio}
									type="text"
									collection={Studios}
									className="mdinput"></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
						<label className="field">
							{t('Supported Audio Formats')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.supportedAudioStreams"
									obj={this.props.studio}
									type="text"
									collection={Studios}
									className="mdinput"></EditAttribute>
								<span className="mdfx"></span>
							</div>
						</label>
						<div className="mod mtn mbm mhn">
							<label className="field">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.forceSettingNowTime"
									obj={this.props.studio}
									type="checkbox"
									collection={Studios}></EditAttribute>
								{t('Force the Multi-gateway-mode')}
							</label>
						</div>
						<div className="mod mtn mbm mhn">
							{t('Multi-gateway-mode delay time')}
							<label className="field">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="settings.nowSafeLatency"
									obj={this.props.studio}
									type="int"
									collection={Studios}
									className="mdinput"></EditAttribute>
							</label>
						</div>
					</div>
					<div className="row">
						<div className="col c12 r1-c12">
							<StudioBaselineStatus
								studio={this.props.studio}
								t={t}
								i18n={this.props.i18n}
								tReady={this.props.tReady}
							/>
						</div>
					</div>
					<div className="row">
						<div className="col c12 r1-c12">
							<StudioDevices
								studio={this.props.studio}
								studioDevices={this.props.studioDevices}
								availableDevices={this.props.availableDevices}
							/>
						</div>
					</div>
					<div className="row">
						<div className="col c12 r1-c12">
							<ConfigManifestSettings
								t={this.props.t}
								i18n={this.props.i18n}
								tReady={this.props.tReady}
								manifest={this.props.blueprintConfigManifest}
								object={this.props.studio}
								layerMappings={this.getLayerMappingsFlat()}
								collection={Studios}
								configPath={'blueprintConfig'}
							/>
						</div>
					</div>
					<div className="row">
						<div className="col c12 r1-c12">
							<StudioMappings studio={this.props.studio} />
						</div>
					</div>
					<div className="row">
						<div className="col c12 r1-c12">
							<StudioRoutings studio={this.props.studio} />
						</div>
					</div>
				</div>
			) : (
				<Spinner />
			)
		}

		render() {
			if (this.props.studio) {
				return this.renderEditForm()
			} else {
				return <Spinner />
			}
		}
	}
)

export function setProperty(studio: Studio, property: string, value: any) {
	let m = {}
	if (value !== undefined) {
		m[property] = value
		Studios.update(studio._id, { $set: m })
	} else {
		m[property] = 0
		Studios.update(studio._id, { $unset: m })
	}
}

export function findHighestRank(array: Array<{ _rank: number }>): { _rank: number } | null {
	if (!array) return null
	let max: { _rank: number } | null = null

	array.forEach((value, index) => {
		if (max === null || max._rank < value._rank) {
			max = value
		}
	})

	return max
}
