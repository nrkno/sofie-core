import * as React from 'react'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { ConfigManifestEntry, ConfigManifestEntryType } from '../../../../lib/api/deviceConfig'


export interface IConfigManifestEntryComponentProps {
	configField: ConfigManifestEntry
	obj?: any
	prefix?: string
	hideLabel?: boolean
}
export const ConfigManifestEntryComponent = translate()(class ConfigManifestEntryComponent extends React.Component<Translated<IConfigManifestEntryComponentProps>, {}> {

	renderEditAttribute (configField: ConfigManifestEntry, obj?: any, prefix?: string) {
		let attribute = prefix + configField.id

		if (configField.type === ConfigManifestEntryType.FLOAT || configField.type === ConfigManifestEntryType.INT) {
			return <EditAttribute modifiedClassName='bghl' attribute={attribute} obj={obj || this.props.device} type={configField.type} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
		} else if (configField.type === ConfigManifestEntryType.STRING) {
			return <EditAttribute modifiedClassName='bghl' attribute={attribute} obj={obj || this.props.device} type='text' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
		} else if (configField.type === ConfigManifestEntryType.BOOLEAN) {
			return <EditAttribute modifiedClassName='bghl' attribute={attribute} obj={obj || this.props.device} type='checkbox' collection={PeripheralDevices} className=''></EditAttribute>
		} else if (configField.type === ConfigManifestEntryType.ENUM) {
			return <EditAttribute modifiedClassName='bghl' attribute={attribute} obj={obj || this.props.device} type='dropdown' options={configField.values} collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
		} else if (configField.type === ConfigManifestEntryType.OBJECT) {
			return <EditAttribute modifiedClassName='bghl' attribute={attribute} mutateDisplayValue={v => JSON.stringify(v, undefined, 2)} mutateUpdateValue={v => JSON.parse(v)} obj={obj || this.props.device} type='multiline' collection={PeripheralDevices} className='input text-input input-l'></EditAttribute>
		}
	}

	renderConfigField (configField: ConfigManifestEntry, obj?: any, prefix?: string) {
		const { t } = this.props

		return (<div className='mod mvs mhs'>
			<label className='field'>
				{t(configField.name)}
				{this.renderEditAttribute(configField, obj, prefix)}
			</label>
		</div>)
	}

	render () {
		const { configField, obj, prefix } = this.props

		return (<div>
			{this.renderConfigField(configField, obj, prefix)}
		</div>)
	}
})
