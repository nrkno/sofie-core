import React, { useCallback, useMemo, useState } from 'react'
import ClassNames from 'classnames'
import {
	faPencilAlt,
	faTrash,
	faCheck,
	faExclamationTriangle,
	faPlus,
	faRefresh,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IOutputLayer } from '@sofie-automation/blueprints-integration'
import { clone, getRandomString, literal, objectPathSet } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../../lib/EditAttribute'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { findHighestRank } from '../StudioSettings'
import {
	applyAndValidateOverrides,
	ObjectOverrideDeleteOp,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SetNonNullable } from 'type-fest'
import { CheckboxControlWithOverrideForObject } from '../../../lib/Components/Checkbox'

interface IOutputSettingsProps {
	showStyleBase: ShowStyleBase
}

interface ComputedOutputLayer {
	id: string
	computed: IOutputLayer | undefined
	defaults: IOutputLayer | undefined
	overrideOps: SomeObjectOverrideOp[]
}

function filterOpsForPrefix(
	allOps: SomeObjectOverrideOp[],
	prefix: string
): { opsForId: SomeObjectOverrideOp[]; otherOps: SomeObjectOverrideOp[] } {
	const res: { opsForId: SomeObjectOverrideOp[]; otherOps: SomeObjectOverrideOp[] } = { opsForId: [], otherOps: [] }

	for (const op of allOps) {
		if (op.path === prefix || op.path.startsWith(`${prefix}.`)) {
			res.opsForId.push(op)
		} else {
			res.otherOps.push(op)
		}
	}

	return res
}

export function OutputLayerSettings({ showStyleBase }: IOutputSettingsProps) {
	const { t } = useTranslation()

	const [expandedItemIds, setExpandedItemIds] = useState({})
	const toggleExpanded = useCallback((itemId: string) => {
		setExpandedItemIds((oldExpanded) => {
			// This will leak entries as layers are added and removed, but not fast enough to be a problem
			return {
				...oldExpanded,
				[itemId]: !oldExpanded[itemId],
			}
		})
	}, [])

	const onAddOutput = useCallback(() => {
		const maxRank = findHighestRank(Object.values(showStyleBase.outputLayersWithOverrides.defaults))

		const newOutput = literal<IOutputLayer>({
			_id: `${showStyleBase._id}-${getRandomString(5)}`,
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New Output'),
			isPGM: false,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newOutput._id,
			value: newOutput,
		})

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				'outputLayersWithOverrides.overrides': addOp,
			},
		})
	}, [])

	const resolvedOutputLayers = useMemo(
		() => applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj,
		[showStyleBase.outputLayersWithOverrides]
	)

	const sortedOutputLayers = useMemo(() => {
		const sortedOutputLayers = Object.values(resolvedOutputLayers)
			.filter((l): l is IOutputLayer => !!l)
			.sort((a, b) => a._rank - b._rank)
			.map((l) =>
				literal<ComputedOutputLayer>({
					id: l._id,
					computed: l,
					defaults: showStyleBase.outputLayersWithOverrides.defaults[l._id],
					overrideOps: filterOpsForPrefix(showStyleBase.outputLayersWithOverrides.overrides, l._id).opsForId,
				})
			)

		const removedOutputLayers: SetNonNullable<ComputedOutputLayer, 'defaults'>[] = []

		const computedOutputLayerIds = new Set(sortedOutputLayers.map((l) => l.id))
		for (const [id, output] of Object.entries(showStyleBase.outputLayersWithOverrides.defaults)) {
			if (!computedOutputLayerIds.has(id) && output) {
				removedOutputLayers.push(
					literal<SetNonNullable<ComputedOutputLayer, 'defaults'>>({
						id: id,
						computed: undefined,
						defaults: output,
						overrideOps: filterOpsForPrefix(showStyleBase.outputLayersWithOverrides.overrides, id).opsForId,
					})
				)
			}
		}

		removedOutputLayers.sort((a, b) => a.defaults._rank - b.defaults._rank)

		return [...sortedOutputLayers, ...removedOutputLayers]
	}, [resolvedOutputLayers, showStyleBase.outputLayersWithOverrides])

	const isPGMChannelSet = useMemo(() => {
		return !!Object.values(resolvedOutputLayers).find((layer) => layer && layer.isPGM)
	}, [resolvedOutputLayers])

	const clearItemOverride = useCallback((itemId: string, subPath: string) => {
		console.log(`reset ${itemId}.${subPath}`)

		const opPath = `${itemId}.${subPath}`

		const newOps = showStyleBase.outputLayersWithOverrides.overrides.filter((op) => op.path !== opPath)

		ShowStyleBases.update(showStyleBase._id, {
			$set: {
				'outputLayersWithOverrides.overrides': newOps,
			},
		})
	}, [])
	const setItemValue = useCallback(
		(itemId: string, subPath: string | null, value: any) => {
			console.log(`set ${itemId}.${subPath} = ${value}`)

			// Handle deletion
			if (!subPath && value === undefined) {
				const newOps = filterOpsForPrefix(showStyleBase.outputLayersWithOverrides.overrides, itemId).otherOps
				if (showStyleBase.outputLayersWithOverrides.defaults[itemId]) {
					// If it was from the defaults, we need to mark it deleted
					newOps.push(
						literal<ObjectOverrideDeleteOp>({
							op: 'delete',
							path: itemId,
						})
					)
				}

				ShowStyleBases.update(showStyleBase._id, {
					$set: {
						'outputLayersWithOverrides.overrides': newOps,
					},
				})
			} else if (subPath === '_id') {
				// Change id

				const { otherOps: newOps, opsForId } = filterOpsForPrefix(
					showStyleBase.outputLayersWithOverrides.overrides,
					itemId
				)

				if (
					!value ||
					newOps.find((op) => op.path === value) ||
					showStyleBase.outputLayersWithOverrides.defaults[value]
				) {
					throw new Error('Id is invalid or already in use')
				}

				if (showStyleBase.outputLayersWithOverrides.defaults[itemId]) {
					// Future: should we be able to handle this?
					throw new Error("Can't change id of object with defaults")
				} else {
					// Change the id prefix of the ops
					for (const op of opsForId) {
						const newPath = `${value}${op.path.substring(itemId.length)}`

						const newOp = {
							...op,
							path: newPath,
						}
						newOps.push(newOp)

						if (newOp.path === value && newOp.op === 'set') {
							newOp.value._id = value
						}
					}

					ShowStyleBases.update(showStyleBase._id, {
						$set: {
							'outputLayersWithOverrides.overrides': newOps,
						},
					})
				}
			} else if (subPath) {
				// Set a property
				const { otherOps: newOps, opsForId } = filterOpsForPrefix(
					showStyleBase.outputLayersWithOverrides.overrides,
					itemId
				)

				// Future: handle subPath being deeper
				if (subPath.indexOf('.') !== -1) throw new Error('Deep subPath not yet implemented')

				const setRootOp = opsForId.find((op) => op.path === itemId)
				if (setRootOp && setRootOp.op === 'set') {
					// This is as its base an override, so modify that instead
					const newOp = clone(setRootOp)

					objectPathSet(newOp.value, subPath, value)

					newOps.push(newOp)
				} else {
					const newOp = literal<ObjectOverrideSetOp>({
						op: 'set',
						path: `${itemId}.${subPath}`,
						value: value,
					})

					// Preserve any other overrides
					for (const op of opsForId) {
						if (op.path !== newOp.path) {
							newOps.push(op)
						}
					}
					// Add the new override
					newOps.push(newOp)
				}

				ShowStyleBases.update(showStyleBase._id, {
					$set: {
						'outputLayersWithOverrides.overrides': newOps,
					},
				})
			}
		},
		[showStyleBase.outputLayersWithOverrides, showStyleBase._id]
	)

	// Reset an item back to defaults
	const resetItem = useCallback(
		(itemId: string) => {
			console.log('reset', itemId)

			const newOps = filterOpsForPrefix(showStyleBase.outputLayersWithOverrides.overrides, itemId).otherOps

			ShowStyleBases.update(showStyleBase._id, {
				$set: {
					'outputLayersWithOverrides.overrides': newOps,
				},
			})
		},
		[showStyleBase.outputLayersWithOverrides.overrides, showStyleBase._id]
	)

	return (
		<div>
			<h2 className="mhn">
				<Tooltip
					overlay={t('Output channels are required for your studio to work')}
					visible={getHelpMode() && !sortedOutputLayers.length}
					placement="top"
				>
					<span>{t('Output channels')}</span>
				</Tooltip>
			</h2>
			{!sortedOutputLayers.length ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No output channels set')}
				</div>
			) : null}
			{!isPGMChannelSet ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No PGM output')}
				</div>
			) : null}
			<table className="expando settings-studio-output-table">
				<tbody>
					{sortedOutputLayers.map((item) =>
						item.computed ? (
							<OutputLayerEntry
								key={item.id}
								showStyleBase={showStyleBase}
								item={item.computed}
								defaultItem={item.defaults}
								isExpanded={!!expandedItemIds[item.id]}
								itemOps={item.overrideOps}
								toggleExpanded={toggleExpanded}
								setItemValue={setItemValue}
								clearItemOverride={clearItemOverride}
								resetItem={resetItem}
							/>
						) : (
							item.defaults && <OutputLayerDeletedEntry key={item.id} item={item.defaults} doUndelete={resetItem} />
						)
					)}
				</tbody>
			</table>
			<div className="mod mhs">
				<button className="btn btn-primary" onClick={onAddOutput}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}

interface DeletedEntryProps {
	item: IOutputLayer
	doUndelete: (itemId: string) => void
}
function OutputLayerDeletedEntry({ item, doUndelete }: DeletedEntryProps) {
	const doUndeleteItem = useCallback(() => {
		doUndelete(item._id)
	}, [doUndelete, item._id])
	return (
		<tr>
			<th className="settings-studio-output-table__name c2 deleted">{item.name}</th>
			<td className="settings-studio-output-table__id c4 deleted">{item._id}</td>
			<td className="settings-studio-output-table__isPGM c3">
				<div
					className={ClassNames('switch', 'switch-tight', {
						'switch-active': item.isPGM,
					})}
				>
					PGM
				</div>
			</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faRefresh} />
				</button>
			</td>
		</tr>
	)
}

interface EntryProps {
	showStyleBase: ShowStyleBase
	item: IOutputLayer
	defaultItem: IOutputLayer | undefined
	itemOps: SomeObjectOverrideOp[]
	isExpanded: boolean
	toggleExpanded: (itemId: string) => void
	resetItem: (itemId: string) => void
	setItemValue: (itemId: string, subPath: string | null, value: any) => void
	clearItemOverride: (itemId: string, subPath: string) => void
}
function OutputLayerEntry({
	showStyleBase,
	item,
	isExpanded,
	toggleExpanded,
	resetItem,
	setItemValue,
	clearItemOverride,
	defaultItem,
	itemOps,
}: EntryProps) {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(item._id), [toggleExpanded, item._id])
	const doResetItem = useCallback(() => resetItem(item._id), [resetItem, item._id])

	const confirmDelete = useCallback(() => {
		doModalDialog({
			title: t('Delete this output?'),
			no: t('Cancel'),
			yes: t('Delete'),
			onAccept: () => {
				setItemValue(item._id, null, undefined)
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to delete output layer "{{outputId}}"?', { outputId: item?.name })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}, [t, item._id, item.name, showStyleBase?._id, setItemValue])

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-output-table__name c2">{item.name}</th>
				<td className="settings-studio-output-table__id c4">{item._id}</td>
				<td className="settings-studio-output-table__isPGM c3">
					<div
						className={ClassNames('switch', 'switch-tight', {
							'switch-active': item.isPGM,
						})}
					>
						PGM
					</div>
				</td>
				<td className="settings-studio-output-table__actions table-item-actions c3">
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
					<td colSpan={4}>
						<div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Channel Name')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`outputLayersWithOverrides.defaults.${item._id}.name`}
										obj={showStyleBase}
										type="text"
										collection={ShowStyleBases}
										className="input text-input input-l"
										overrideDisplayValue={item.name}
										updateFunction={(_edit, newValue) => {
											setItemValue(item._id, 'name', newValue)
										}}
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Internal ID')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`outputLayersWithOverrides.defaults.${item._id}._id`}
										obj={showStyleBase}
										type="text"
										collection={ShowStyleBases}
										className="input text-input input-l"
										disabled={!!defaultItem}
										overrideDisplayValue={item._id}
										updateFunction={(_edit, newValue) => {
											setItemValue(item._id, '_id', newValue)
										}}
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<CheckboxControlWithOverrideForObject
									label={t('Is PGM Output')}
									item={item}
									defaultItem={defaultItem}
									itemKey={'isPGM'}
									itemOps={itemOps}
									opPrefix={item._id}
									setValue={setItemValue}
									clearOverride={clearItemOverride}
								/>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Display Rank')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`outputLayersWithOverrides.defaults.${item._id}._rank`}
										obj={showStyleBase}
										type="int"
										collection={ShowStyleBases}
										className="input text-input input-l"
										overrideDisplayValue={item._rank}
										updateFunction={(_edit, newValue) => {
											setItemValue(item._id, '_rank', newValue)
										}}
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<CheckboxControlWithOverrideForObject
									label={t('Is collapsed by default')}
									item={item}
									defaultItem={defaultItem}
									itemKey={'isDefaultCollapsed'}
									itemOps={itemOps}
									opPrefix={item._id}
									setValue={setItemValue}
									clearOverride={clearItemOverride}
								/>
							</div>
							<div className="mod mvs mhs">
								<CheckboxControlWithOverrideForObject
									label={t('Is flattened')}
									item={item}
									defaultItem={defaultItem}
									itemKey={'isFlattened'}
									itemOps={itemOps}
									opPrefix={item._id}
									setValue={setItemValue}
									clearOverride={clearItemOverride}
								/>
							</div>
						</div>
						<div className="mod alright">
							{defaultItem && (
								<button className="btn btn-primary" onClick={doResetItem} title="Reset to defaults">
									<FontAwesomeIcon icon={faRefresh} />
								</button>
							)}
							&nbsp;
							<button className="btn btn-primary" onClick={toggleEditItem}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}
