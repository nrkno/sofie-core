import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ConfigManifestEntry, ConfigManifestEntryType } from '@sofie-automation/corelib/dist/deviceConfig'
import { ConfigManifestEntry as BlueprintConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { MongoCollection } from '../../../../lib/collections/lib'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../util/OverrideOpHelper'
import { IntInputControlWithOverrideForObject } from '../../../lib/Components/IntInput'
import { TextInputControlWithOverrideForObject } from '../../../lib/Components/TextInput'
import { CheckboxControlWithOverrideForObject } from '../../../lib/Components/Checkbox'

interface ConfigManifestEntryWithOverridesProps {
	configField: ConfigManifestEntry | BlueprintConfigManifestEntry

	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelper
}
export function ManifestEntryWithOverrides({
	configField,
	item,
	overrideHelper,
}: ConfigManifestEntryWithOverridesProps) {
	const { t } = useTranslation()

	const commonOpts = {
		modifiedClassName: 'bghl',
		label: t(configField.name),
		placeholder: (configField as ConfigManifestEntry).placeholder || '',
		hint: configField.hint ? t(configField.hint) : undefined,

		item: item,
		itemKey: configField.id,
		opPrefix: item.id,
		overrideHelper: overrideHelper,
	}

	// if (configField.type === ConfigManifestEntryType.FLOAT) {
	// 	return <EditAttribute {...opts} type="float" className="input text-input input-l"></EditAttribute>
	// } else
	if (configField.type === ConfigManifestEntryType.INT) {
		return (
			<IntInputControlWithOverrideForObject
				classNames="input text-input input-l"
				zeroBased={configField.zeroBased}
				{...commonOpts}
			/>
		)
	} else if (configField.type === ConfigManifestEntryType.STRING) {
		return <TextInputControlWithOverrideForObject classNames="input text-input input-l" {...commonOpts} />
	} else if (configField.type === ConfigManifestEntryType.BOOLEAN) {
		return <CheckboxControlWithOverrideForObject classNames="input input-l" {...commonOpts} />
		// } else if (configField.type === ConfigManifestEntryType.ENUM) {
		// 	return (
		// 		<EditAttribute
		// 			{...opts}
		// 			type="dropdown"
		// 			options={(configField as ConfigManifestEntry).values || []}
		// 			className="input text-input input-l"
		// 		></EditAttribute>
		// 	)
		// } else if (configField.type === ConfigManifestEntryType.OBJECT) {
		// 	return (
		// 		<EditAttribute
		// 			{...opts}
		// 			mutateDisplayValue={(v) => JSON.stringify(v, undefined, 2)}
		// 			mutateUpdateValue={(v) => JSON.parse(v)}
		// 			type="multiline"
		// 			className="input text-input input-l"
		// 		></EditAttribute>
		// 	)
		// } else if (configField.type === ConfigManifestEntryType.MULTILINE_STRING) {
		// 	return (
		// 		<EditAttribute
		// 			{...opts}
		// 			modifiedClassName="bghl"
		// 			type="multiline"
		// 			className="input text-input input-l"
		// 			mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join('\n'))}
		// 			mutateUpdateValue={(v) =>
		// 				v === undefined || v.length === 0 ? undefined : v.split('\n').map((i) => i.trimStart())
		// 			}
		// 		/>
		// 	)
		// TODO: Handle these?
		// } else if (configField.type === ConfigManifestEntryType.TABLE) {
		// 	// not handled here, handled by GenericDeviceSettingsComponent
		// } else if (configField.type === ConfigManifestEntryType.LABEL) {
		// 	// todo ?
		// } else if (configField.type === ConfigManifestEntryType.LINK) {
		// 	// todo ?
	} else {
		// assertNever(configField.type)
		return <p>{t('Unknown type')}</p>
	}
}

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
		// } else if (configField.type === ConfigManifestEntryType.LABEL) {
		// 	// todo ?
		// } else if (configField.type === ConfigManifestEntryType.LINK) {
		// 	// todo ?
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
