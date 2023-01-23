import ClassNames from 'classnames'
import React, { useCallback, useMemo } from 'react'
import Tooltip from 'rc-tooltip'
import {
	Studio,
	Studios,
	MappingExt,
	getActiveRoutes,
	ResultingMappingRoutes,
} from '../../../../lib/collections/Studios'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { LookaheadMode, TSR } from '@sofie-automation/blueprints-integration'
import { LOOKAHEAD_DEFAULT_SEARCH_DISTANCE } from '@sofie-automation/shared-lib/dist/core/constants'
import { useToggleExpandHelper } from '../util/ToggleExpandedHelper'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	OverrideOpHelper,
	useOverrideOpHelper,
	WrappedOverridableItemNormal,
} from '../util/OverrideOpHelper'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { literal, objectPathGet } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { IntInputControl } from '../../../lib/Components/IntInput'
import {
	DropdownInputControl,
	DropdownInputOption,
	getDropdownInputOptions,
} from '../../../lib/Components/DropdownInput'
import {
	LabelAndOverrides,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
} from '../../../lib/Components/LabelAndOverrides'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SchemaFormWithOverrides } from '../../../lib/forms/schemaFormWithOverrides'
import {
	getSchemaSummaryFields,
	SchemaSummaryField,
	translateStringIfHasNamespaces,
} from '../../../lib/forms/schemaFormUtil'

export interface MappingsSettingsManifest {
	displayName: string
	mappingsSchema?: Record<string, JSONSchema>
}
export type MappingsSettingsManifests = Record<string | number, MappingsSettingsManifest>

interface IStudioMappingsProps {
	studio: Studio
	manifest: MappingsSettingsManifests | undefined
	translationNamespaces: string[]
}

export function StudioMappings({ manifest, translationNamespaces, studio }: IStudioMappingsProps) {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const manifestNames = useMemo(() => {
		return Object.fromEntries(
			Object.entries(manifest || {}).map(([id, val]) => [
				id,
				translateStringIfHasNamespaces(val.displayName, translationNamespaces),
			])
		)
	}, [manifest, translationNamespaces])

	const addNewLayer = useCallback(() => {
		const resolvedMappings = applyAndValidateOverrides(studio.mappingsWithOverrides).obj

		// find free key name
		const newLayerKeyName = 'newLayer'
		let iter = 0
		while (resolvedMappings[newLayerKeyName + iter.toString()]) {
			iter++
		}

		const newId = newLayerKeyName + iter.toString()
		const newMapping = literal<MappingExt>({
			device: TSR.DeviceType.CASPARCG,
			deviceId: protectString('newDeviceId'),
			lookahead: LookaheadMode.NONE,
			options: {},
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newMapping,
		})

		Studios.update(studio._id, {
			$push: {
				'mappingsWithOverrides.overrides': addOp,
			},
		})

		setImmediate(() => {
			toggleExpanded(newId, true)
		})
	}, [studio._id, studio.mappingsWithOverrides])

	const activeRoutes = useMemo(() => getActiveRoutes(studio.routeSets), [studio.routeSets])

	const sortedMappings = useMemo(
		() => getAllCurrentAndDeletedItemsFromOverrides(studio.mappingsWithOverrides, (a, b) => a[0].localeCompare(b[0])),
		[studio.mappingsWithOverrides]
	)

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'mappingsWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.mappingsWithOverrides)

	return (
		<div>
			<h2 className="mhn">{t('Layer Mappings')}</h2>
			{!manifest ? (
				<span>{t('Add a playout device to the studio in order to edit the layer mappings')}</span>
			) : (
				<React.Fragment>
					<table className="expando settings-studio-mappings-table">
						<tbody>
							{sortedMappings.map((item) =>
								item.type === 'deleted' ? (
									<MappingDeletedEntry
										key={item.id}
										activeRoutes={activeRoutes}
										layerId={item.id}
										manifest={manifest[item.defaults.device]}
										manifestNames={manifestNames}
										translationNamespaces={translationNamespaces}
										mapping={item.defaults}
										doUndelete={overrideHelper.resetItem}
									/>
								) : (
									<StudioMappingsEntry
										key={item.id}
										item={item}
										activeRoutes={activeRoutes}
										toggleExpanded={toggleExpanded}
										isExpanded={isExpanded(item.id)}
										manifest={manifest[item.computed.device]}
										manifestNames={manifestNames}
										translationNamespaces={translationNamespaces}
										overrideHelper={overrideHelper}
									/>
								)
							)}
						</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={addNewLayer}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</React.Fragment>
			)}
		</div>
	)
}

interface DeletedEntryProps {
	activeRoutes: ResultingMappingRoutes
	manifest: MappingsSettingsManifest | undefined
	manifestNames: Record<string | number, string>
	translationNamespaces: string[]

	mapping: MappingExt
	layerId: string
	doUndelete: (itemId: string) => void
}
function MappingDeletedEntry({
	activeRoutes,
	manifest,
	manifestNames,
	translationNamespaces,
	mapping,
	layerId,
	doUndelete,
}: DeletedEntryProps) {
	const { t } = useTranslation()

	const doUndeleteItem = useCallback(() => doUndelete(layerId), [doUndelete, layerId])

	const mappingSchema = manifest?.mappingsSchema?.[mapping.options?.mappingType]
	const mappingSummaryFields = useMemo(
		() => (mappingSchema ? getSchemaSummaryFields(mappingSchema) : []),
		[mappingSchema]
	)

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">
				{mapping.layerName || layerId}
				{activeRoutes.existing[layerId] !== undefined ? (
					<Tooltip
						overlay={t('This layer is now rerouted by an active Route Set: {{routeSets}}', {
							routeSets: activeRoutes.existing[layerId].map((s) => s.outputMappedLayer).join(', '),
							count: activeRoutes.existing[layerId].length,
						})}
						placement="right"
					>
						<span className="notification">{activeRoutes.existing[layerId].length}</span>
					</Tooltip>
				) : null}
			</th>
			<td className="settings-studio-device__id c2 deleted">{manifestNames[mapping.device] ?? mapping.device}</td>
			<td className="settings-studio-device__id c2 deleted">{mapping.deviceId}</td>
			<td className="settings-studio-device__id c4 deleted">
				<MappingSummary translationNamespaces={translationNamespaces} fields={mappingSummaryFields} mapping={mapping} />
			</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface StudioMappingsEntryProps {
	activeRoutes: ResultingMappingRoutes
	manifest: MappingsSettingsManifest | undefined
	manifestNames: Record<string | number, string>
	translationNamespaces: string[]

	toggleExpanded: (layerId: string, force?: boolean) => void
	isExpanded: boolean

	item: WrappedOverridableItemNormal<MappingExt>
	overrideHelper: OverrideOpHelper
}

function StudioMappingsEntry({
	activeRoutes,
	manifest,
	manifestNames,
	translationNamespaces,
	toggleExpanded,
	isExpanded,
	item,
	overrideHelper,
}: StudioMappingsEntryProps) {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(item.id), [toggleExpanded, item.id])
	const confirmDelete = useCallback(() => {
		doModalDialog({
			title: t('Remove this mapping?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper.deleteItem(item.id)
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to remove mapping for layer "{{mappingId}}"?', { mappingId: item.id })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}, [t, item.id, overrideHelper])

	const doChangeItemId = useCallback(
		(newItemId: string) => {
			overrideHelper.changeItemId(item.id, newItemId)
			toggleExpanded(newItemId, true)
		},
		[overrideHelper, toggleExpanded, item.id]
	)

	const deviceTypeOptions = useMemo(() => {
		const raw = Object.entries(manifestNames || {})
		raw.sort((a, b) => a[1].localeCompare(b[1]))

		return raw.map(([id, entry], i) =>
			literal<DropdownInputOption<string | number>>({
				value: id + '',
				name: entry,
				i,
			})
		)
	}, [manifestNames])

	const mappingTypeOptions = useMemo(() => {
		const raw: Array<[string, JSONSchema]> = Object.entries(manifest?.mappingsSchema || {})

		return raw.map(([id, entry], i) =>
			literal<DropdownInputOption<string | number>>({
				value: id + '',
				name: entry?.title ?? id + '',
				i,
			})
		)
	}, [manifest?.mappingsSchema])

	const mappingSchema = manifest?.mappingsSchema?.[item.computed.options?.mappingType]
	const mappingSummaryFields = useMemo(
		() => (mappingSchema ? getSchemaSummaryFields(mappingSchema) : []),
		[mappingSchema]
	)

	const hasMappingTypeChangedFromDefault = !!(
		item.defaults &&
		(item.computed.device !== item.defaults?.device ||
			item.computed.options?.mappingType !== item.defaults.options?.mappingType)
	)
	const mappingSchemaItem = useMemo(() => {
		if (hasMappingTypeChangedFromDefault) {
			return literal<WrappedOverridableItemNormal<MappingExt>>({
				...item,
				// The mappingType has changed, so the 'default' values likely don't match up with this mapping at all.
				// Trick the form into thinking it doesnt have defaults
				defaults: undefined,
			})
		} else {
			// The existing item is good still
			return item
		}
	}, [item, hasMappingTypeChangedFromDefault])

	return (
		<React.Fragment>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c3 notifications-s notifications-text">
					{item.computed.layerName || item.id}
					{activeRoutes.existing[item.id] !== undefined ? (
						<Tooltip
							overlay={t('This layer is now rerouted by an active Route Set: {{routeSets}}', {
								routeSets: activeRoutes.existing[item.id].map((s) => s.outputMappedLayer).join(', '),
								count: activeRoutes.existing[item.id].length,
							})}
							placement="right"
						>
							<span className="notification">{activeRoutes.existing[item.id].length}</span>
						</Tooltip>
					) : null}
				</th>
				<td className="settings-studio-device__id c2">{manifestNames[item.computed.device] ?? item.computed.device}</td>
				<td className="settings-studio-device__id c2">{item.computed.deviceId}</td>
				<td className="settings-studio-device__id c4">
					<MappingSummary
						translationNamespaces={translationNamespaces}
						fields={mappingSummaryFields}
						mapping={item.computed}
					/>
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					<button className="action-btn" onClick={toggleEditItem}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmDelete}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={5}>
						<div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Layer ID')}
									<TextInputControl
										modifiedClassName="bghl"
										classNames="input text-input input-l"
										value={item.id}
										handleUpdate={doChangeItemId}
										disabled={!!item.defaults}
									/>
									<span className="text-s dimmed">{t('ID of the timeline-layer to map to some output')}</span>
								</label>
							</div>
							<div className="mod mvs mhs">
								<LabelAndOverrides
									label={t('Layer Name')}
									hint={t('Human-readable name of the layer')}
									item={item}
									itemKey={'layerName'}
									opPrefix={item.id}
									overrideHelper={overrideHelper}
								>
									{(value, handleUpdate) => (
										<TextInputControl
											modifiedClassName="bghl"
											classNames="input text-input input-l"
											value={value}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverrides>
							</div>
							<div className="mod mvs mhs">
								<LabelAndOverridesForDropdown
									label={t('Device Type')}
									hint={t('The type of device to use for the output')}
									item={item}
									itemKey={'device'}
									opPrefix={item.id}
									overrideHelper={overrideHelper}
									options={deviceTypeOptions}
								>
									{(value, handleUpdate, options) => (
										<DropdownInputControl
											classNames="input text-input input-l"
											options={options}
											value={value + ''}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverridesForDropdown>
							</div>
							<div className="mod mvs mhs">
								<LabelAndOverrides
									label={t('Device ID')}
									hint={t('ID of the device (corresponds to the device ID in the peripheralDevice settings)')}
									item={item}
									itemKey={'deviceId'}
									opPrefix={item.id}
									overrideHelper={overrideHelper}
								>
									{(value, handleUpdate) => (
										<TextInputControl
											modifiedClassName="bghl"
											classNames="input text-input input-l"
											value={value}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverrides>
							</div>
							<div className="mod mvs mhs">
								<LabelAndOverridesForDropdown
									label={t('Lookahead Mode')}
									item={item}
									itemKey={'lookahead'}
									opPrefix={item.id}
									overrideHelper={overrideHelper}
									options={getDropdownInputOptions(LookaheadMode)}
								>
									{(value, handleUpdate, options) => (
										<DropdownInputControl
											classNames="input text-input input-l"
											options={options}
											value={value}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverridesForDropdown>
							</div>
							<div className="mod mvs mhs">
								<LabelAndOverridesForInt
									label={t('Lookahead Target Objects (Undefined = 1)')}
									item={item}
									itemKey={'lookaheadDepth'}
									opPrefix={item.id}
									overrideHelper={overrideHelper}
								>
									{(value, handleUpdate) => (
										<IntInputControl
											modifiedClassName="bghl"
											classNames="input text-input input-l"
											value={value}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverridesForInt>
							</div>
							<div className="mod mvs mhs">
								<LabelAndOverridesForInt
									label={t('Lookahead Maximum Search Distance (Undefined = {{limit}})', {
										limit: LOOKAHEAD_DEFAULT_SEARCH_DISTANCE,
									})}
									item={item}
									itemKey={'lookaheadMaxSearchDistance'}
									opPrefix={item.id}
									overrideHelper={overrideHelper}
								>
									{(value, handleUpdate) => (
										<IntInputControl
											modifiedClassName="bghl"
											classNames="input text-input input-l"
											value={value}
											handleUpdate={handleUpdate}
										/>
									)}
								</LabelAndOverridesForInt>
							</div>
							{mappingTypeOptions.length > 0 && (
								<>
									<div className="mod mvs mhs">
										<LabelAndOverridesForDropdown<any>
											label={t('Mapping Type')}
											hint={t('The type of mapping to use')}
											item={item}
											itemKey={'options.mappingType'}
											opPrefix={item.id}
											overrideHelper={overrideHelper}
											options={mappingTypeOptions}
										>
											{(value, handleUpdate, options) => (
												<DropdownInputControl
													classNames="input text-input input-l"
													options={options}
													value={value + ''}
													handleUpdate={handleUpdate}
												/>
											)}
										</LabelAndOverridesForDropdown>
									</div>
									{mappingSchema ? (
										<SchemaFormWithOverrides
											schema={mappingSchema}
											translationNamespaces={translationNamespaces}
											item={mappingSchemaItem}
											attr="options"
											overrideHelper={overrideHelper}
										/>
									) : (
										<p>{t('No schema has been provided for this mapping')}</p>
									)}
								</>
							)}
						</div>
						<div className="mod alright">
							<button className={ClassNames('btn btn-primary')} onClick={toggleEditItem}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface MappingSummaryProps {
	translationNamespaces: string[]
	fields: SchemaSummaryField[]
	mapping: MappingExt
}
function MappingSummary({ translationNamespaces, fields, mapping }: MappingSummaryProps) {
	if (fields.length > 0) {
		return (
			<span>
				{fields
					.map((entry) => {
						const rawValue = objectPathGet(mapping.options, entry.attr)
						const displayValue = entry.transform ? entry.transform(rawValue) : rawValue

						return `${translateStringIfHasNamespaces(entry.name, translationNamespaces)}: ${displayValue}`
					})
					.join(' - ')}
			</span>
		)
	} else {
		return <span>-</span>
	}
}
