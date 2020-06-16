import * as React from 'react'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { ConfigManifestEntry, ConfigManifestEntryType } from '../../../../lib/api/deviceConfig'

export interface IConfigManifestEntryComponentProps {
	configField: ConfigManifestEntry
	obj: object
	prefix?: string
	hideLabel?: boolean
}
export const ConfigManifestEntryComponent = translate()(
	class ConfigManifestEntryComponent extends React.Component<Translated<IConfigManifestEntryComponentProps>, {}> {
		renderEditAttribute(configField: ConfigManifestEntry, obj: object, prefix?: string) {
			let attribute = prefix + configField.id
			const opts = {
				modifiedClassName: 'bghl',
				attribute,
				obj,
				collection: PeripheralDevices,
				label: configField.placeholder,
			}

			if (configField.type === ConfigManifestEntryType.FLOAT || configField.type === ConfigManifestEntryType.INT) {
				return <EditAttribute {...opts} type={configField.type} className="input text-input input-l"></EditAttribute>
			} else if (configField.type === ConfigManifestEntryType.STRING) {
				return <EditAttribute {...opts} type="text" className="input text-input input-l"></EditAttribute>
			} else if (configField.type === ConfigManifestEntryType.BOOLEAN) {
				return <EditAttribute {...opts} type="checkbox" className="input input-l"></EditAttribute>
			} else if (configField.type === ConfigManifestEntryType.ENUM) {
				return (
					<EditAttribute
						{...opts}
						type="dropdown"
						options={configField.values}
						className="input text-input input-l"></EditAttribute>
				)
			} else if (configField.type === ConfigManifestEntryType.OBJECT) {
				return (
					<EditAttribute
						{...opts}
						mutateDisplayValue={(v) => JSON.stringify(v, undefined, 2)}
						mutateUpdateValue={(v) => JSON.parse(v)}
						type="multiline"
						className="input text-input input-l"></EditAttribute>
				)
			}
		}

		renderConfigField(configField: ConfigManifestEntry, obj: object, prefix?: string) {
			const { t } = this.props

			return (
				<div className="mod mvs mhs">
					<label className="field">
						{t(configField.name)}
						{this.renderEditAttribute(configField, obj, prefix)}
					</label>
				</div>
			)
		}

		render() {
			const { configField, obj, prefix } = this.props

			return <div>{this.renderConfigField(configField, obj, prefix)}</div>
		}
	}
)
