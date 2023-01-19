import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ConfigManifestEntry, ConfigManifestEntryType } from '@sofie-automation/corelib/dist/deviceConfig'
import { ConfigManifestEntry as BlueprintConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { MongoCollection } from '../../../../lib/collections/lib'

export const renderEditAttribute = (
	collection: MongoCollection<any>,
	configField: ConfigManifestEntry | BlueprintConfigManifestEntry,
	obj: object,
	prefix?: string
) => {
	const attribute = prefix + configField.id
	const opts = {
		modifiedClassName: 'bghl',
		attribute,
		obj,
		collection,
		label: (configField as ConfigManifestEntry).placeholder || '',
	}

	if (configField.type === ConfigManifestEntryType.FLOAT) {
		return <EditAttribute {...opts} type="float" className="input text-input input-l"></EditAttribute>
	} else if (configField.type === ConfigManifestEntryType.INT) {
		return (
			<EditAttribute
				{...opts}
				type={'int'}
				className="input text-input input-l"
				mutateDisplayValue={(v) => (configField.zeroBased ? v + 1 : v)}
				mutateUpdateValue={(v) => (configField.zeroBased ? v - 1 : v)}
			></EditAttribute>
		)
	} else if (configField.type === ConfigManifestEntryType.STRING) {
		return <EditAttribute {...opts} type="text" className="input text-input input-l"></EditAttribute>
	} else if (configField.type === ConfigManifestEntryType.BOOLEAN) {
		return <EditAttribute {...opts} type="checkbox" className="input input-l"></EditAttribute>
	} else if (configField.type === ConfigManifestEntryType.ENUM) {
		return (
			<EditAttribute
				{...opts}
				type="dropdown"
				options={(configField as ConfigManifestEntry).values || []}
				className="input text-input input-l"
			></EditAttribute>
		)
	} else if (configField.type === ConfigManifestEntryType.OBJECT) {
		return (
			<EditAttribute
				{...opts}
				mutateDisplayValue={(v) => JSON.stringify(v, undefined, 2)}
				mutateUpdateValue={(v) => JSON.parse(v)}
				type="multiline"
				className="input text-input input-l"
			></EditAttribute>
		)
	} else if (configField.type === ConfigManifestEntryType.MULTILINE_STRING) {
		return (
			<EditAttribute
				{...opts}
				modifiedClassName="bghl"
				type="multiline"
				className="input text-input input-l"
				mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join('\n'))}
				mutateUpdateValue={(v) =>
					v === undefined || v.length === 0 ? undefined : v.split('\n').map((i) => i.trimStart())
				}
			/>
		)
		// TODO: Handle these?
		// } else if (configField.type === ConfigManifestEntryType.TABLE) {
		// 	// not handled here, handled by GenericDeviceSettingsComponent
		// } else {
		// 	assertNever(configField.type)
	}
}

export interface IConfigManifestEntryComponentProps {
	configField: ConfigManifestEntry | BlueprintConfigManifestEntry
	obj: object
	prefix?: string
	collection?: MongoCollection<any>
	className?: string
}

export function ConfigManifestEntryComponent({
	configField,
	obj,
	prefix,
	collection,
	className,
}: IConfigManifestEntryComponentProps) {
	const { t } = useTranslation() // TODO - should this use a namespace?

	return (
		<div>
			<div className={className ?? 'mod mvs mhs'}>
				<label className="field">
					{t(configField.name)}
					{renderEditAttribute(collection || PeripheralDevices, configField, obj, prefix)}
					{configField.hint && <span className="text-s dimmed">{t(configField.hint)}</span>}
				</label>
			</div>
		</div>
	)
}
