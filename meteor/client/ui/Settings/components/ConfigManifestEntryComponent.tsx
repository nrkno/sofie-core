import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { EditAttribute } from '../../../lib/EditAttribute'
import { ConfigManifestEntry, ConfigManifestEntryType } from '@sofie-automation/corelib/dist/deviceConfig'
import { ConfigManifestEntry as BlueprintConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import { MongoCollection } from '../../../../lib/collections/lib'
import { OverrideOpHelper, WrappedOverridableItemNormal } from '../util/OverrideOpHelper'
import { IntInputControl } from '../../../lib/Components/IntInput'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { CheckboxControl } from '../../../lib/Components/Checkbox'
import { FloatInputControl } from '../../../lib/Components/FloatInput'
import { DropdownInputControl, getDropdownInputOptions } from '../../../lib/Components/DropdownInput'
import { MultiLineTextInputControl } from '../../../lib/Components/MultiLineTextInput'
import { JsonTextInputControl } from '../../../lib/Components/JsonTextInput'
import {
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
	LabelAndOverridesForMultiLineText,
	LabelAndOverridesProps,
} from '../../../lib/Components/LabelAndOverrides'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDevices } from '../../../collections'

interface ConfigManifestEntryWithOverridesProps {
	configField: ConfigManifestEntry

	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelper
}
export function ManifestEntryWithOverrides({
	configField,
	item,
	overrideHelper,
}: ConfigManifestEntryWithOverridesProps): JSX.Element {
	const { t } = useTranslation()

	const wrapperProps: Omit<LabelAndOverridesProps<any, any>, 'children'> = {
		label: t(configField.name),
		hint: configField.hint ? t(configField.hint) : undefined,

		item: item,
		itemKey: configField.id,
		opPrefix: item.id,
		overrideHelper: overrideHelper,
	}

	if (configField.type === ConfigManifestEntryType.FLOAT) {
		return (
			<LabelAndOverrides {...wrapperProps}>
				{(value, handleUpdate) => (
					<FloatInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={configField.placeholder}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverrides>
		)
	} else if (configField.type === ConfigManifestEntryType.INT) {
		return (
			<LabelAndOverridesForInt {...wrapperProps} zeroBased={configField.zeroBased}>
				{(value, handleUpdate) => (
					<IntInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={configField.placeholder}
						zeroBased={configField.zeroBased}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForInt>
		)
	} else if (configField.type === ConfigManifestEntryType.STRING) {
		return (
			<LabelAndOverrides {...wrapperProps}>
				{(value, handleUpdate) => (
					<TextInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						placeholder={configField.placeholder}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverrides>
		)
	} else if (configField.type === ConfigManifestEntryType.BOOLEAN) {
		return (
			<LabelAndOverridesForCheckbox {...wrapperProps}>
				{(value, handleUpdate) => (
					<CheckboxControl classNames="input input-l" value={!!value} handleUpdate={handleUpdate} />
				)}
			</LabelAndOverridesForCheckbox>
		)
	} else if (configField.type === ConfigManifestEntryType.ENUM) {
		return (
			<LabelAndOverridesForDropdown {...wrapperProps} options={getDropdownInputOptions(configField.values)}>
				{(value, handleUpdate, options) => (
					<DropdownInputControl
						classNames="input text-input input-l"
						options={options}
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForDropdown>
		)
	} else if (configField.type === ConfigManifestEntryType.OBJECT) {
		return (
			<LabelAndOverrides {...wrapperProps}>
				{(value, handleUpdate) => (
					<JsonTextInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverrides>
		)
	} else if (configField.type === ConfigManifestEntryType.MULTILINE_STRING) {
		return (
			<LabelAndOverridesForMultiLineText {...wrapperProps}>
				{(value, handleUpdate) => (
					<MultiLineTextInputControl
						modifiedClassName="bghl"
						classNames="input text-input input-l"
						value={value}
						handleUpdate={handleUpdate}
					/>
				)}
			</LabelAndOverridesForMultiLineText>
		)
	} else if (configField.type === ConfigManifestEntryType.TABLE) {
		// not handled here, handled by GenericDeviceSettingsComponent
		return <p>{t('Unknown table type')}</p>
	} else {
		assertNever(configField)
		return <p>{t('Unknown type')}</p>
	}
}

export const renderEditAttribute = (
	collection: MongoCollection<any>,
	configField: ConfigManifestEntry | BlueprintConfigManifestEntry,
	obj: object,
	prefix?: string
): JSX.Element | undefined => {
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
}: IConfigManifestEntryComponentProps): JSX.Element {
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
