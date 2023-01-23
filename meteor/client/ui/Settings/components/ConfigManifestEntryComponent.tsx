import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import {
	ConfigManifestEntry as BlueprintConfigManifestEntry,
	ConfigManifestEntryType,
} from '@sofie-automation/blueprints-integration'
import { MongoCollection } from '../../../../lib/collections/lib'

const renderEditAttribute = (
	collection: MongoCollection<any>,
	configField: BlueprintConfigManifestEntry,
	obj: object,
	prefix?: string
) => {
	const attribute = prefix + configField.id
	const opts = {
		modifiedClassName: 'bghl',
		attribute,
		obj,
		collection,
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
				options={configField.options || []}
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
	configField: BlueprintConfigManifestEntry
	obj: object
	prefix?: string
	collection?: MongoCollection<any>
	className?: string
}

/** @deprecated */
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
					{configField.hint && hasDefaultVal(configField) && <span className="text-s dimmed"> - </span>}
					{hasDefaultVal(configField) && (
						<span className="text-s dimmed">
							{t("Defaults to '{{defaultVal}}' if left empty", { defaultVal: configField.defaultVal })}
						</span>
					)}
				</label>
			</div>
		</div>
	)
}

function hasDefaultVal(
	configField: ConfigManifestEntry | BlueprintConfigManifestEntry
): configField is ConfigManifestEntry {
	if (configField['defaultVal']) {
		return true
	}

	return false
}
