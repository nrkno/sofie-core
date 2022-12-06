import React from 'react'
import {
	BasicConfigManifestEntry,
	IBlueprintConfig,
	ConfigManifestEntryType,
} from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { CheckboxControl } from '../../../lib/Components/Checkbox'
import { DropdownInputOption, DropdownInputControl } from '../../../lib/Components/DropdownInput'
import { FloatInputControl } from '../../../lib/Components/FloatInput'
import { IntInputControl } from '../../../lib/Components/IntInput'
import { JsonTextInputControl, tryParseJson } from '../../../lib/Components/JsonTextInput'
import { MultiLineTextInputControl } from '../../../lib/Components/MultiLineTextInput'
import { MultiSelectInputControl } from '../../../lib/Components/MultiSelectInput'
import { TextInputControl } from '../../../lib/Components/TextInput'
import {
	ResolvedBasicConfigManifestEntry,
	SourceLayerDropdownOption,
	filterSourceLayers,
	filterLayerMappings,
	getTableColumnValues,
} from './resolveColumns'

export function getInputControl(
	manifest: BasicConfigManifestEntry | ResolvedBasicConfigManifestEntry,
	value: any,
	handleUpdate: (value: any) => void,
	layerMappings: { [studioId: string]: MappingsExt } | undefined,
	sourceLayers: Array<SourceLayerDropdownOption> | undefined,
	fullConfig: IBlueprintConfig | undefined,
	alternateConfig: IBlueprintConfig | undefined
) {
	const commonProps = {
		modifiedClassName: 'bghl',
		value: value,
		handleUpdate: handleUpdate,
	}

	switch (manifest.type) {
		case ConfigManifestEntryType.STRING:
			return <TextInputControl classNames="input text-input input-l" {...commonProps} />
		case ConfigManifestEntryType.MULTILINE_STRING:
			return <MultiLineTextInputControl classNames="input text-input input-l" {...commonProps} />
		case ConfigManifestEntryType.INT:
			return <IntInputControl classNames="input text-input input-m" {...commonProps} zeroBased={manifest.zeroBased} />
		case ConfigManifestEntryType.FLOAT:
			return <FloatInputControl classNames="input text-input input-m" {...commonProps} />
		case ConfigManifestEntryType.BOOLEAN:
			return <CheckboxControl classNames="input" {...commonProps} />
		case ConfigManifestEntryType.ENUM: {
			const options: DropdownInputOption<string>[] = manifest.options.map((opt, i) => ({ name: opt, value: opt, i }))
			return <DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
		}
		case ConfigManifestEntryType.JSON:
			return (
				<JsonTextInputControl
					classNames="input text-input input-l"
					modifiedClassName="bghl"
					invalidClassName="warn"
					value={tryParseJson(value)?.parsed ?? value}
					handleUpdate={(valueObj) => handleUpdate(JSON.stringify(valueObj, undefined, 2))}
				/>
			)

		case ConfigManifestEntryType.SELECT: {
			const options: DropdownInputOption<string>[] = manifest.options.map((opt, i) => ({ name: opt, value: opt, i }))
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		case ConfigManifestEntryType.SOURCE_LAYERS: {
			const options = 'options' in manifest ? manifest.options : filterSourceLayers(manifest, sourceLayers ?? [])
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		case ConfigManifestEntryType.LAYER_MAPPINGS: {
			const options = 'options' in manifest ? manifest.options : filterLayerMappings(manifest, layerMappings ?? {})
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		case ConfigManifestEntryType.SELECT_FROM_COLUMN: {
			const options =
				'options' in manifest ? manifest.options : getTableColumnValues(manifest, fullConfig || {}, alternateConfig)
			return manifest.multiple ? (
				<MultiSelectInputControl classNames="input text-input dropdown input-l" {...commonProps} options={options} />
			) : (
				<DropdownInputControl classNames="input text-input input-l" {...commonProps} options={options} />
			)
		}
		default:
			assertNever(manifest)
			return undefined
	}
}
