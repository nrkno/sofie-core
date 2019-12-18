import * as ClassNames from 'classnames'
import * as React from 'react'
import * as _ from 'underscore'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { translate } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { MosDeviceSettings, MosDeviceSettingsDevice } from '../../../../lib/collections/PeripheralDeviceSettings/mosDevice'
import { EditAttribute, EditAttributeBase } from '../../../lib/EditAttribute'
import { ModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { Meteor } from 'meteor/meteor'
import { DeviceItem } from '../../Status/SystemStatus'
import { IPlayoutDeviceSettingsComponentProps } from './IHttpSendDeviceSettingsComponentProps'
import { ConfigManifestEntry, ConfigManifestEntryType, TableConfigManifestEntry, SubDeviceConfigManifestEntry } from '../../../../lib/api/deviceConfig'
import { ConfigManifestEntryComponent } from './ConfigManifestEntryComponent'
import { ConfigManifestOAuthFlowComponent } from './ConfigManifestOAuthFlow'

interface IMosDeviceSettingsComponentState {
	deleteConfirmItemPath: string | undefined
	showDeleteConfirm: boolean
	editedObjects: Array<string>
}
export const GenericDeviceSettingsComponent = translate()(class GenericDeviceSettingsComponent extends React.Component<Translated<IPlayoutDeviceSettingsComponentProps>, IMosDeviceSettingsComponentState> {
	constructor (props: Translated<IPlayoutDeviceSettingsComponentProps>) {
		super(props)
		this.state = {
			deleteConfirmItemPath: undefined,
			showDeleteConfirm: false,
			editedObjects: []
		}
	}

	isItemEdited = (path: string) => {
		return this.state.editedObjects.indexOf(path) >= 0
	}

	isDeviceEdited = (deviceId: string) => {
		return this.isItemEdited('settings.devices.' + deviceId)
	}

	finishEditItem = (path: string) => {
		let index = this.state.editedObjects.indexOf(path)
		if (index >= 0) {
			this.state.editedObjects.splice(index, 1)
			this.setState({
				editedObjects: this.state.editedObjects
			})
		}
	}

	finishEditDevice = (deviceId: string) => {
		this.finishEditItem('settings.devices.' + deviceId)
	}

	editItem = (deviceId: string) => {
		if (this.state.editedObjects.indexOf(deviceId) < 0) {
			this.state.editedObjects.push(deviceId)
			this.setState({
				editedObjects: this.state.editedObjects
			})
		} else {
			this.finishEditItem(deviceId)
		}
	}

	editDevice = (deviceId: string) => {
		this.editItem('settings.devices.' + deviceId)
	} 

	handleConfirmRemoveCancel = (e) => {
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmItemPath: undefined
		})
	}

	handleConfirmRemoveAccept = (e) => {
		this.state.deleteConfirmItemPath && this.removeItem(this.state.deleteConfirmItemPath)
		this.setState({
			showDeleteConfirm: false,
			deleteConfirmItemPath: undefined
		})
	}

	confirmRemoveDevice (deviceId: string) {
		this.confirmRemove('settings.devices.' + deviceId)
	}

	confirmRemove = (path: string) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmItemPath: path
		})
	}

	removeItem = (itemPath: string) => {
		let unsetObject = {}
		unsetObject[itemPath] = ''
		PeripheralDevices.update(this.props.device._id, {
			$unset: unsetObject
		})

		// clean up if array
		const path = itemPath.split('.')
		const id = path.pop()
		if (!isNaN(Number(id))) {
			PeripheralDevices.update(this.props.device._id, {
				$pull: {
					[path.join('.')] : null
				}
			})
		}
	}

	addNewItem = (itemConfig: TableConfigManifestEntry, path: string) => {
		// create obj for db from defaults
		let setObject = {}
		const defaults = {}
		const createDefault = (path: Array<string>, val: boolean | number | string, obj: any) => {
			const prop = path.shift()!
			if (path.length > 0) {
				obj[prop] = {}
				createDefault(path, val, obj[prop])
			} else {
				obj[prop] = val
			}
		}
		for (const prop of itemConfig.config[itemConfig.defaultType]) {
			if (prop.defaultVal) {
				createDefault(prop.id.split('.'), prop.defaultVal, defaults)
			}
		}

		if (itemConfig.isSubDevices && Object.keys(itemConfig.config).length > 1) { // adding subdevice with type
			defaults['type'] = Object.keys(itemConfig.config).indexOf(itemConfig.defaultType)
		}

		if (!itemConfig.isSubDevices) {
			const device = PeripheralDevices.findOne(this.props.device._id)!
			const objectRootPath = (path.split('.')).slice(0, -1)
			const objectRoot = _.property(objectRootPath as any)(device)
			if (objectRoot === undefined) {
				// create the array, as this is the first element inside
				setObject[objectRootPath.join('.')] = [
					defaults
				]
			} else {
				// just set/add the element
				setObject[path] = defaults
			}
		} else {
			setObject[path] = defaults
		}

		// set db
		PeripheralDevices.update(this.props.device._id, {
			$set: setObject
		})
	}

	removeDevice = (deviceId: string) => {
		this.removeItem('settings.devices.' + deviceId)
	}

	addNewDevice = (subDeviceConfig: TableConfigManifestEntry) => {
		let settings = this.props.device.settings as MosDeviceSettings || {}
		// find free key name
		let newDeviceId = subDeviceConfig.subDeviceDefaultName || 'subDevice'
		let iter = 0
		while ((settings.devices || {})[newDeviceId + iter.toString()]) {
			iter++
		}
		this.addNewItem(subDeviceConfig, 'settings.devices.' + newDeviceId + iter.toString())
	}

	updateDeviceId = (edit: EditAttributeBase, newValue: string) => {
		let settings = this.props.device.settings as MosDeviceSettings
		let oldDeviceId = edit.props.overrideDisplayValue
		let newDeviceId = newValue + ''
		let device = settings.devices[oldDeviceId]
		if (settings[newDeviceId]) {
			throw new Meteor.Error(400, 'Device "' + newDeviceId + '" already exists')
		}
		let mSet = {}
		let mUnset = {}
		mSet['settings.devices.' + newDeviceId] = device
		mUnset['settings.devices.' + oldDeviceId] = 1
		if (edit.props.collection) {
			edit.props.collection.update(this.props.device._id, {
				$set: mSet,
				$unset: mUnset
			})
		} else {
			throw new Meteor.Error(500, 'EditAttribute.props.collection is not set (it should be)!')
		}

		this.finishEditDevice(oldDeviceId)
		this.editItem(newDeviceId)
	}

	renderDeviceSummary (configManifest: TableConfigManifestEntry, deviceId: string, obj: any, isEdited: (deviceId: string) => boolean) {
		const els: Array<JSX.Element> = []
		const configSummaryFields = this.getConfigSummaryFields(configManifest)

		// Always show device ID
		els.push(<th className='settings-studio-device__name c2' key='ID'>
			{deviceId}
		</th>)

		_.each(configSummaryFields, (config, field) => {
			// @ts-ignore underscore typings are incorrect
			const fn  = _.property(field.split('.'))
			let val = fn(obj)

			if (field === (configManifest.typeField || 'type') && configManifest.deviceTypesMapping) {
				val = configManifest.deviceTypesMapping[val]
			}

			// if (config.columnEditable) {
			// 	els.push(<td className='settings-studio-device__primary_id'>
			// 		{this.renderEditAttribute(config, obj)}
			// 	</td>)
			// }

			els.push(<td className='settings-studio-device__primary_id c4' key={field}>
				{val === undefined ? '' : val}
			</td>)
		})

		// Add edit / remove buttons
		els.push(
			<td className='settings-studio-device__actions table-item-actions c1' key='action'>
				<button className='action-btn' onClick={(e) => this.editDevice(deviceId)}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className='action-btn' onClick={(e) => this.confirmRemoveDevice(deviceId)}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>)

		return (<tr className={ClassNames({
			'hl': isEdited(deviceId)
		})}>
			{els}
		</tr>)
	}

	renderDevices (configManifest: TableConfigManifestEntry, obj?: any, prefix?: string) {
		const { t } = this.props
		const deviceTypes = Object.keys(configManifest.config)
		// @ts-ignore underscore typings are incorrect
		const devices = _.property((prefix + configManifest.id).split('.'))(obj)

		if (deviceTypes.length === 1) {
			const config = configManifest.config[configManifest.defaultType || 'default']
			const propNames = config.map(o => o.columnName).map(name => name ? (<th key={name}>{name}</th>) : undefined)
			propNames.push(<th key='action'>&nbsp;</th>)
	
			return (<React.Fragment>
				<tr className='hl'>
					{propNames}
				</tr>
				{_.map(devices, (device: any, deviceId: string) => {
					return <React.Fragment key={deviceId}>
						{this.renderDeviceSummary(configManifest, deviceId, device, this.isDeviceEdited)}
						{this.isDeviceEdited(deviceId) &&
							<tr className='expando-details hl' key={deviceId + '-details'}>
								<td colSpan={6}>
									<div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Device ID')}
												<EditAttribute modifiedClassName='bghl' attribute={prefix + configManifest.id} overrideDisplayValue={deviceId} obj={this.props.device} type='text' collection={PeripheralDevices} updateFunction={this.updateDeviceId} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										{this.renderConfigFields(config, this.props.device, prefix + configManifest.id + '.' + deviceId + '.')}
									</div>
									<div className='mod alright'>
										<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditDevice(deviceId)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>}
					</React.Fragment>
				})}
			</React.Fragment>)
		} else {
			const propNames = [ <th key='ID'>ID</th>, ..._.map(this.getConfigSummaryFields(configManifest), f => <th key={f.columnName}>{f.columnName}</th>) ]
			propNames.push(<th key='action'>&nbsp;</th>)

			const deviceTypesObj = {}
			for (let i in deviceTypes) {
				deviceTypesObj[deviceTypes[i]] = deviceTypes[i]
			}

			return (<React.Fragment>
				<tr className='hl'>
					{propNames}
				</tr>
				{_.map(devices, (device: any, deviceId: string) => {
					const configField = configManifest.config[configManifest.deviceTypesMapping ? configManifest.deviceTypesMapping[device[configManifest.typeField || 'type']] : device[configManifest.typeField || 'type']]
					return <React.Fragment key={deviceId}>
						{this.renderDeviceSummary(configManifest, deviceId, device, this.isDeviceEdited)}
						{this.isDeviceEdited(deviceId) &&
							<tr className='expando-details hl' key={deviceId + '-details'}>
								<td colSpan={6}>
									<div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Device ID')}
												<EditAttribute modifiedClassName='bghl' attribute={prefix + configManifest.id} overrideDisplayValue={deviceId} obj={this.props.device} type='text' collection={PeripheralDevices} updateFunction={this.updateDeviceId} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										<div className='mod mvs mhs'>
											<label className='field'>
												{t('Device Type')}
												<EditAttribute modifiedClassName='bghl' attribute={prefix + configManifest.id + '.' + deviceId + '.type'} obj={this.props.device} type='dropdown' options={configManifest.deviceTypesMapping || deviceTypes} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
											</label>
										</div>
										{this.renderConfigFields(configField, this.props.device, prefix + configManifest.id + '.' + deviceId + '.')}
									</div>
									<div className='mod alright'>
										<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditDevice(deviceId)}>
											<FontAwesomeIcon icon={faCheck} />
										</button>
									</div>
								</td>
							</tr>}
					</React.Fragment>
				})}
			</React.Fragment>)
		}
	}

	renderSubdeviceConfig (configField: TableConfigManifestEntry, obj?: any, prefix?: string) {
		const { t } = this.props

		return (<React.Fragment key={configField.id}>
			<h2 className='mhn'>{t(configField.name)}</h2>
			<table className='expando settings-studio-device-table'>
				<tbody>
					{this.renderDevices(configField, obj, prefix)}
				</tbody>
			</table>

			<div className='mod mhs'>
				<button className='btn btn-primary' onClick={(e) => this.addNewDevice(configField)}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</React.Fragment>)
	}

	getConfigSummaryFields (configManifest: TableConfigManifestEntry) {
		const fieldNames: { [field: string]: SubDeviceConfigManifestEntry } = {}

		_.each(configManifest.config, (c) => {
			for (const field of c) {
				if (field.columnName) {
					fieldNames[field.id] = field
				}
			}
		})

		if (configManifest.config && Object.keys(configManifest.config).length > 1) {
			fieldNames[configManifest.typeField || 'type'] = {
				id: 'type',
				name: 'Type',
				columnName: 'Type',
				type: ConfigManifestEntryType.STRING
			}
		}

		return fieldNames
	}

	renderConfigTableSummary (configManifest: TableConfigManifestEntry, obj: any, path: string, isEdited: (deviceId: string) => boolean) {
		const els: Array<JSX.Element> = []
		const configSummaryFields = this.getConfigSummaryFields(configManifest)

		_.each(configSummaryFields, (_config, field) => {
			// @ts-ignore underscore typings are incorrect
			const fn  = _.property(field.split('.'))
			const val = fn(obj)


			els.push(<td className='settings-studio-device__primary_id c4' key={field}>
				{val === undefined ? <>&nbsp;</> : val}
			</td>)
		})

		// Add edit / remove buttons
		els.push(
			<td className='settings-studio-device__actions table-item-actions c1' key='action'>
				<button className='action-btn' onClick={(e) => this.editItem(path)}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className='action-btn' onClick={(e) => this.confirmRemove(path)}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>)

		return (<tr className={ClassNames({
			'hl': isEdited(path)
		})}>
			{els}
		</tr>)
	}

	/**
	 * @todo add handler for new entry
	 * 
	 * @param configField 
	 * @param obj 
	 * @param prefix 
	 */
	renderConfigTable (configField: TableConfigManifestEntry, obj?: any, prefix?: string) {
		const { t } = this.props
		// @ts-ignore
		const tableContent = _.property(prefix.substr(0, prefix.length - 1).split('.'))(obj)
		const configTypes = Object.keys(configField.config)

		if (configTypes.length === 1) {
			const config = configField.config[configField.defaultType]
			const propNames = config.map(o => o.columnName).map(name => name ? (<th key={name}>{name}</th>) : undefined)
			propNames.push(<th key='actions'>&nbsp;</th>)
	
			return (<React.Fragment key={configField.id}>
				<h2 className='mhn'>{t(configField.name)}</h2>
				<table className='expando settings-config-table table'>
					<thead>
						<tr className='hl'>
							{propNames}
						</tr>
					</thead>
					<tbody>
						{_.map(tableContent, (tableEntry: any, i) => {
						return <React.Fragment key={i}>
							{this.renderConfigTableSummary(configField, tableEntry, prefix + '' + i, this.isItemEdited)}
							{this.isItemEdited(prefix + '' + i) &&
								<tr className='expando-details hl' key={tableEntry.id + '-details'}>
									<td colSpan={5}>
										<div>
											<div>
												{this.renderConfigFields(config, this.props.device, prefix + '' + i + '.')}
											</div>
										</div>
										<div className='mod alright'>
											<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(prefix + '' + i)}>
												<FontAwesomeIcon icon={faCheck} />
											</button>
										</div>
									</td>
								</tr>}
							</React.Fragment>})}
					</tbody>
				</table>
	
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.addNewItem(configField, prefix + ((tableContent || []).length || 0))}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</React.Fragment>)
		} else {
			const propNames = [ ..._.map(this.getConfigSummaryFields(configField), f => <th key={f.columnName}>{f.columnName}</th>) ]
			propNames.push(<th key='actions'>&nbsp;</th>)

			const configTypesObj = {}
			for (let i in configTypes) {
				configTypesObj[configTypes[i]] = configTypes[i]
			}

			return (<React.Fragment key={configField.id}>
				<h2 className='mhn'>{t(configField.name)}</h2>
				<table className='expando settings-config-table table'>
					<thead>
						<tr className='hl'>
							{propNames}
						</tr>
					</thead>
					<tbody>
						{_.map(tableContent, (tableEntry: any, i) => {
							const tableConfigField = configField.config[configField.deviceTypesMapping ? configField.deviceTypesMapping[tableEntry[configField.typeField || 'type']] : tableEntry[configField.typeField || 'type']]
							
							return <React.Fragment key={i}>
								{this.renderConfigTableSummary(configField, tableEntry, prefix + '' + i, this.isItemEdited)}
								{this.isItemEdited(prefix + '' + i) &&
									<tr className='expando-details hl' key={i + '-details'}>
										<td colSpan={6}>
											<div>
												<div className='mod mvs mhs'>
													<label className='field'>
														{t('Type')}
														<EditAttribute modifiedClassName='bghl' attribute={prefix + i + '.' + (configField.defaultType || 'type')} obj={this.props.device} type='dropdown' options={configTypes} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
													</label>
												</div>
												{this.renderConfigFields(tableConfigField, this.props.device, prefix + '' + i + '.')}
											</div>
											<div className='mod alright'>
												<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(prefix + '' + i)}>
													<FontAwesomeIcon icon={faCheck} />
												</button>
											</div>
										</td>
									</tr>}
							</React.Fragment>
						})}
					</tbody>
				</table>

				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={(e) => this.addNewItem(configField, prefix + ((tableContent || []).length || 0))}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</React.Fragment>)
		}
	}

	renderConfigFields (configManifest: ConfigManifestEntry[], obj?: any, prefix?: string) {
		const fields: Array<any> = []

		for (const configField of configManifest) {
			if (configField.type === ConfigManifestEntryType.TABLE) {
				if ((configField as TableConfigManifestEntry).isSubDevices) {
					fields.push(this.renderSubdeviceConfig(configField as TableConfigManifestEntry, obj, prefix))
				} else {
					fields.push(this.renderConfigTable(configField as TableConfigManifestEntry, obj, prefix + configField.id + '.'))
				}
			} else {
				fields.push(<ConfigManifestEntryComponent key={configField.id} configField={configField} obj={obj} prefix={prefix}></ConfigManifestEntryComponent>)
			}
		}

		return (<div>
			{fields}
		</div>)
	}

	render () {
		const { t, subDevices, device } = this.props

		return (<div>
			{this.props.device.configManifest.deviceOAuthFlow && <ConfigManifestOAuthFlowComponent device={device}></ConfigManifestOAuthFlowComponent> }

			{this.renderConfigFields(this.props.device.configManifest.deviceConfig, device, 'settings.')}

			<ModalDialog title={t('Remove this item?')} acceptText={t('Remove')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmRemoveAccept(e)} onSecondary={(e) => this.handleConfirmRemoveCancel(e)}>
				<p>{t('Are you sure you want to remove {{type}} "{{deviceId}}"?',
					{ 
						deviceId: (this.state.deleteConfirmItemPath && this.state.deleteConfirmItemPath.split('.').pop()),
						type: (
							this.state.deleteConfirmItemPath &&
							this.state.deleteConfirmItemPath.match(/device/i) &&
							!this.state.deleteConfirmItemPath.match(/\.(\d)+$/i)
						) ? 'device' : 'item'
					})}</p>
			</ModalDialog>

			{(subDevices && subDevices.length > 0) &&
				(<React.Fragment>
					<h2 className='mhn'>{t('Attached Subdevices')}</h2>
					{subDevices.map((item) => <DeviceItem key={item._id} device={item} showRemoveButtons={true} />)}
				</React.Fragment>)}
		</div>)
	}
})
