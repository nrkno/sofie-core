import { faSync, faCheck, faPencilAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	ConfigItemValue,
	ConfigManifestEntry,
	ConfigManifestEntryType,
	IBlueprintConfig,
} from '@sofie-automation/blueprints-integration'
import React, { useCallback } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import ClassNames from 'classnames'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { WrappedOverridableItemNormal, OverrideOpHelper } from '../util/OverrideOpHelper'
import { SourceLayerDropdownOption } from './resolveColumns'
import { getInputControl } from './InputControl'
import { BlueprintConfigManifestTable } from './ConfigItemTable'

export interface WrappedOverridableExt {
	manifest: ConfigManifestEntry
}

export interface BlueprintConfigManifestRowProps {
	configManifestId: string
	value: any

	wrappedItem: WrappedOverridableItemNormal<any> & WrappedOverridableExt
	overrideHelper: OverrideOpHelper

	showReset: (item: ConfigManifestEntry) => void

	fullConfig: IBlueprintConfig
	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined
	layerMappings: { [studioId: string]: MappingsExt } | undefined
	sourceLayers: Array<SourceLayerDropdownOption> | undefined

	subPanel: boolean

	isExpanded: boolean
	toggleExpanded: (id: string, force?: boolean) => void
}
export function BlueprintConfigManifestRow({
	configManifestId,
	value,
	wrappedItem,
	overrideHelper,
	showReset,
	fullConfig,
	alternateConfig,
	layerMappings,
	sourceLayers,
	subPanel,
	isExpanded,
	toggleExpanded,
}: BlueprintConfigManifestRowProps) {
	const { t } = useTranslation()

	const manifestEntry = wrappedItem.manifest

	const doShowReset = useCallback(() => showReset(manifestEntry), [manifestEntry, showReset])
	const doToggleExpanded = useCallback(() => toggleExpanded(manifestEntry.id), [manifestEntry.id, toggleExpanded])

	const handleUpdate = useCallback(
		(value: any) => {
			overrideHelper.replaceItem(wrappedItem.id, value)
		},
		[overrideHelper, wrappedItem.id]
	)

	let component: React.ReactElement | undefined = undefined
	// TODO - the undefined params
	switch (manifestEntry.type) {
		case ConfigManifestEntryType.TABLE:
			component = (
				<BlueprintConfigManifestTable
					configManifestId={configManifestId}
					manifest={manifestEntry}
					wrappedItem={wrappedItem}
					layerMappings={layerMappings}
					sourceLayers={sourceLayers}
					fullConfig={fullConfig}
					alternateConfig={alternateConfig}
					subPanel={subPanel}
					overrideHelper={overrideHelper}
				/>
			)
			break
		case ConfigManifestEntryType.SELECT:
		case ConfigManifestEntryType.LAYER_MAPPINGS:
		case ConfigManifestEntryType.SOURCE_LAYERS:
			component = (
				<div className="field">
					{t('Value')}
					{getInputControl(
						manifestEntry,
						wrappedItem.computed,
						handleUpdate,
						layerMappings,
						sourceLayers,
						fullConfig,
						alternateConfig
					)}
				</div>
			)
			break
		default:
			component = (
				<label className="field">
					{t('Value')}
					{getInputControl(
						manifestEntry,
						wrappedItem.computed,
						handleUpdate,
						layerMappings,
						sourceLayers,
						fullConfig,
						alternateConfig
					)}
				</label>
			)
			break
	}

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-custom-config-table__name c2">{manifestEntry.name}</th>
				<td className="settings-studio-custom-config-table__value c3">{renderConfigValue(t, manifestEntry, value)}</td>
				<td className="settings-studio-custom-config-table__actions table-item-actions c3">
					{wrappedItem.overrideOps.length > 0 && (
						<button className="action-btn" onClick={doShowReset}>
							<FontAwesomeIcon icon={faSync} />
						</button>
					)}
					<button className="action-btn" onClick={doToggleExpanded}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
				</td>
			</tr>
			{isExpanded && value !== undefined && (
				<tr className="expando-details hl">
					<td colSpan={4}>
						<div>
							<div className="mod mvs mhs">
								<label className="field">{manifestEntry.description}</label>
							</div>
							<div className="mod mvs mhs">{component}</div>
						</div>
						<div className="mod alright">
							<button className={ClassNames('btn btn-primary')} onClick={doToggleExpanded}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}

function renderConfigValue(t: TFunction, item: ConfigManifestEntry, value: ConfigItemValue | undefined) {
	const rawValueArr = value as any[]
	const valueStr = value?.toString?.() ?? ''

	switch (item.type) {
		case ConfigManifestEntryType.BOOLEAN:
			return value ? t('true') : t('false')
		case ConfigManifestEntryType.TABLE:
			return t('{{count}} rows', { count: (rawValueArr || []).length })
		case ConfigManifestEntryType.SELECT:
		case ConfigManifestEntryType.LAYER_MAPPINGS:
		case ConfigManifestEntryType.SOURCE_LAYERS:
			return Array.isArray(value) ? (
				<ul className="table-values-list">
					{(value as string[]).map((val) => (
						<li key={val}>{val}</li>
					))}
				</ul>
			) : (
				valueStr
			)
		case ConfigManifestEntryType.INT:
			return typeof value === 'number' && item.zeroBased ? (value + 1).toString() : valueStr
		default:
			return valueStr
	}
}
