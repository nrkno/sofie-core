import ClassNames from 'classnames'
import React, { useCallback, useMemo, useRef } from 'react'
import Tooltip from 'rc-tooltip'
import { MappingsExt } from '../../../../lib/collections/Studios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ConfigManifestEntry, IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { objectPathGet, literal } from '../../../../lib/lib'
import { getHelpMode } from '../../../lib/localStorage'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { useToggleExpandHelper } from '../util/ToggleExpandedHelper'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import {
	filterOverrideOpsForPrefix,
	useOverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
} from '../util/OverrideOpHelper'
import { AddItemModalRef, AddItemModal } from './AddItemModal'
import { SourceLayerDropdownOption } from './resolveColumns'
import { BlueprintConfigManifestDeletedRow, BlueprintConfigManifestRow, WrappedOverridableExt } from './ConfigItemRow'
import { doModalDialog } from '../../../lib/ModalDialog'

export { SourceLayerDropdownOption }

interface IConfigManifestSettingsProps {
	/** An 'id' of this config manifest, eg the studioId it is in refernce to */
	configManifestId: string

	manifest: ConfigManifestEntry[]

	/** Object used as a fallback for obtaining options for ConfigManifestEntrySelectFromColumn */
	alternateConfig: IBlueprintConfig | undefined

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: Array<SourceLayerDropdownOption>

	subPanel?: boolean

	configObject: ObjectWithOverrides<IBlueprintConfig>
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void
	pushOverride: (newOp: SomeObjectOverrideOp) => void
}

/**
 * Compile a sorted array of all the items currently in the ObjectWithOverrides, and those that have been deleted
 * @param manifest The config manifest describing all possible items
 * @param rawConfig The ObjectWithOverrides to look at
 * @returns Sorted items, with sorted deleted items at the end
 */
function getAllCurrentAndDeletedItemsFromOverrides(
	manifest: ConfigManifestEntry[],
	rawConfig: ReadonlyDeep<ObjectWithOverrides<IBlueprintConfig>>
): Array<WrappedOverridableItem<any> & WrappedOverridableExt> {
	const resolvedObject = applyAndValidateOverrides(rawConfig).obj

	// Convert the items into an array
	const validItems: Array<WrappedOverridableItemNormal<any> & WrappedOverridableExt> = []
	for (const entry of manifest) {
		const value = objectPathGet(resolvedObject, entry.id)
		// Only include the ones with values or if they are 'required'
		if (value === undefined && !entry.required) continue

		validItems.push(
			literal<WrappedOverridableItemNormal<any> & WrappedOverridableExt>({
				type: 'normal',
				id: entry.id,
				computed: value,
				defaults: objectPathGet(rawConfig.defaults, entry.id),
				overrideOps: filterOverrideOpsForPrefix(rawConfig.overrides, entry.id).opsForPrefix,
				manifest: entry,
			})
		)
	}

	const removedOutputLayers: Array<WrappedOverridableItemDeleted<any> & WrappedOverridableExt> = []

	// Find the items which have been deleted with an override
	const computedOutputLayerIds = new Set(validItems.map((l) => l.id))
	for (const entry of manifest) {
		const value = objectPathGet(rawConfig.defaults, entry.id)
		if (!computedOutputLayerIds.has(entry.id) && value !== undefined) {
			removedOutputLayers.push(
				literal<WrappedOverridableItemDeleted<any> & WrappedOverridableExt>({
					type: 'deleted',
					id: entry.id,
					computed: undefined,
					defaults: value,
					overrideOps: filterOverrideOpsForPrefix(rawConfig.overrides, entry.id).opsForPrefix,
					manifest: entry,
				})
			)
		}
	}

	return [...validItems, ...removedOutputLayers]
}

export function BlueprintConfigManifestSettings({
	configManifestId,
	manifest,
	alternateConfig,
	layerMappings,
	sourceLayers,
	subPanel,

	configObject,
	saveOverrides,
	pushOverride,
}: IConfigManifestSettingsProps) {
	const { t } = useTranslation()

	const addRef = useRef<AddItemModalRef>(null)

	const addItem = useCallback(() => {
		if (addRef.current) {
			addRef.current.show()
		}
	}, [])

	const doCreate = useCallback(
		(id: string, value: any) => {
			pushOverride(
				literal<ObjectOverrideSetOp>({
					op: 'set',
					path: id,
					value,
				})
			)
		},
		[pushOverride]
	)

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const resolvedConfig = useMemo(() => applyAndValidateOverrides(configObject).obj, [configObject])

	const sortedManifestItems = useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(manifest, configObject),
		[configObject, manifest]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, configObject)

	const showDelete = useCallback(
		(item: ConfigManifestEntry) => {
			doModalDialog({
				title: t('Delete this item?'),
				yes: t('Delete'),
				no: t('Cancel'),
				onAccept: () => {
					overrideHelper.deleteItem(item.id)
				},
				message: (
					<>
						<p>
							{t('Are you sure you want to delete this config item "{{configId}}"?', {
								configId: item.name ?? '??',
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</>
				),
			})
		},
		[overrideHelper]
	)

	return (
		<div className="scroll-x">
			<AddItemModal ref={addRef} manifest={manifest} config={resolvedConfig} doCreate={doCreate} />

			{subPanel ? (
				<h3 className="mhn">{t('Blueprint Configuration')}</h3>
			) : (
				<h2 className="mhn">{t('Blueprint Configuration')}</h2>
			)}

			<table className="table expando settings-studio-custom-config-table">
				<tbody>
					{sortedManifestItems.map((item) => {
						if (item.type === 'deleted') {
							return (
								<BlueprintConfigManifestDeletedRow
									key={item.id}
									manifestEntry={item.manifest}
									defaultValue={item.defaults}
									doUndelete={overrideHelper.resetItem}
									doCreate={doCreate}
									subPanel={!!subPanel}
								/>
							)
						} else {
							return (
								<BlueprintConfigManifestRow
									configManifestId={configManifestId}
									key={item.id}
									wrappedItem={item}
									overrideHelper={overrideHelper}
									value={item.computed}
									showDelete={showDelete}
									doCreate={doCreate}
									fullConfig={resolvedConfig} // This will react everytime the config is changed..
									alternateConfig={alternateConfig}
									layerMappings={layerMappings}
									sourceLayers={sourceLayers}
									subPanel={!!subPanel}
									isExpanded={isExpanded(item.id)}
									toggleExpanded={toggleExpanded}
								/>
							)
						}
					})}
				</tbody>
			</table>

			<div className="mod mhs">
				<button
					className={ClassNames('btn btn-primary', {
						'btn-tight': subPanel,
					})}
					onClick={addItem}
				>
					<Tooltip
						overlay={t('More settings specific to this studio can be found here')}
						visible={getHelpMode()}
						placement="right"
					>
						<FontAwesomeIcon icon={faPlus} />
					</Tooltip>
				</button>
			</div>
		</div>
	)
}
