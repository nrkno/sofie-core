import ClassNames from 'classnames'
import React, { useCallback, useMemo } from 'react'
import * as _ from 'underscore'
import Tooltip from 'rc-tooltip'
import { Studio, MappingExt, getActiveRoutes, ResultingMappingRoutes } from '../../../../lib/collections/Studios'
import { EditAttribute } from '../../../lib/EditAttribute'
import { doModalDialog } from '../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { LookaheadMode, TSR } from '@sofie-automation/blueprints-integration'
import {
	ConfigManifestEntryType,
	MappingManifestEntry,
	MappingsManifest,
} from '@sofie-automation/corelib/dist/deviceConfig'
import { LOOKAHEAD_DEFAULT_SEARCH_DISTANCE } from '@sofie-automation/shared-lib/dist/core/constants'
import { MongoCollection } from '../../../../lib/collections/lib'
import { ManifestEntryWithOverrides, renderEditAttribute } from '../components/ConfigManifestEntryComponent'
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
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { TextInputControl } from '../../../lib/Components/TextInput'
import { IntInputControl } from '../../../lib/Components/IntInput'
import { DropdownInputControl, getDropdownInputOptions } from '../../../lib/Components/DropdownInput'
import {
	LabelAndOverrides,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
} from '../../../lib/Components/LabelAndOverrides'
import { Studios } from '../../../collections'

interface IStudioMappingsProps {
	studio: Studio
	manifest: MappingsManifest | undefined
}

export function StudioMappings({ manifest, studio }: IStudioMappingsProps): JSX.Element {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

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
	manifest: MappingManifestEntry[] | undefined
	mapping: MappingExt
	layerId: string
	doUndelete: (itemId: string) => void
}
function MappingDeletedEntry({ activeRoutes, manifest, mapping, layerId, doUndelete }: DeletedEntryProps) {
	const { t } = useTranslation()

	const doUndeleteItem = useCallback(() => doUndelete(layerId), [doUndelete, layerId])

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
			<td className="settings-studio-device__id c2 deleted">{TSR.DeviceType[mapping.device]}</td>
			<td className="settings-studio-device__id c2 deleted">{mapping.deviceId}</td>
			<td className="settings-studio-device__id c4 deleted">
				<MappingSummary manifest={manifest} mapping={mapping} />
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
	manifest: MappingManifestEntry[] | undefined

	toggleExpanded: (layerId: string, force?: boolean) => void
	isExpanded: boolean

	item: WrappedOverridableItemNormal<MappingExt>
	overrideHelper: OverrideOpHelper
}

function StudioMappingsEntry({
	activeRoutes,
	manifest,
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
	const confirmReset = useCallback(() => {
		doModalDialog({
			title: t('Reset this mapping?'),
			yes: t('Reset'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper.resetItem(item.id)
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to reset all overrides for the mapping for layer "{{mappingId}}"?', {
							mappingId: item.id,
						})}
					</p>
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
				<td className="settings-studio-device__id c2">{TSR.DeviceType[item.computed.device]}</td>
				<td className="settings-studio-device__id c2">{item.computed.deviceId}</td>
				<td className="settings-studio-device__id c4">
					<MappingSummary manifest={manifest} mapping={item.computed} />
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					{!item.defaults && (
						<button className="action-btn" disabled>
							<FontAwesomeIcon icon={faSync} title={t('Mapping cannot be reset as it has no default values')} />
						</button>
					)}
					{item.defaults && item.overrideOps.length > 0 && (
						<button className="action-btn" onClick={confirmReset} title={t('Reset mapping to default values')}>
							<FontAwesomeIcon icon={faSync} />
						</button>
					)}
					<button className="action-btn" onClick={toggleEditItem} title={t('Edit mapping')}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmDelete} title={t('Delete mapping')}>
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
									options={getDropdownInputOptions(TSR.DeviceType)}
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
							{manifest &&
								manifest.map((m) => (
									<div className="mod mvs mhs" key={m.id}>
										<ManifestEntryWithOverrides configField={m as any} item={item} overrideHelper={overrideHelper} />
									</div>
								))}
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
	manifest: MappingManifestEntry[] | undefined
	mapping: MappingExt
}
function MappingSummary({ manifest, mapping }: MappingSummaryProps) {
	if (manifest) {
		return (
			<span>
				{manifest
					.filter((entry) => entry.includeInSummary)
					.map((entry) => {
						const summary = entry.name + ': '

						let mappingValue = entry.values && entry.values[mapping[entry.id]]
						if (!mappingValue) {
							mappingValue = mapping[entry.id]
						}

						if (entry.type === ConfigManifestEntryType.INT && entry.zeroBased && _.isNumber(mappingValue)) {
							mappingValue += 1
						}

						return summary + mappingValue
					})
					.join(' - ')}
			</span>
		)
	} else {
		return <span>-</span>
	}
}

function renderOptionalInput(attribute: string, obj: any, collection: MongoCollection<any>) {
	return (
		<EditAttribute
			modifiedClassName="bghl"
			attribute={attribute}
			obj={obj}
			type="checkbox"
			collection={collection}
			className="mod mvn mhs"
			mutateDisplayValue={(v) => (v === undefined ? false : true)}
			mutateUpdateValue={() => undefined}
		/>
	)
}

interface IDeviceMappingSettingsProps {
	studio: Studio
	attribute: string
	showOptional?: boolean
	manifest: MappingManifestEntry[] | undefined
}

export function DeviceMappingSettings({
	attribute,
	showOptional,
	manifest,
	studio,
}: IDeviceMappingSettingsProps): JSX.Element | null {
	if (manifest) {
		return (
			<React.Fragment>
				{manifest.map((m) => (
					<div className="mod mvs mhs" key={m.id}>
						<label className="field">
							{m.name}
							{showOptional && renderOptionalInput(attribute + '.' + m.id, studio, Studios)}

							{renderEditAttribute(Studios, m as any, studio, attribute + '.')}
							{m.hint && <span className="text-s dimmed">{m.hint}</span>}
						</label>
					</div>
				))}
			</React.Fragment>
		)
	}

	return null
}
