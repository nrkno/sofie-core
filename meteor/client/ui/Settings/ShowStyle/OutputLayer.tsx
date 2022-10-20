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
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { findHighestRank } from '../StudioSettings'
import { ObjectOverrideSetOp, SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { CheckboxControlWithOverrideForObject } from '../../../lib/Components/Checkbox'
import { useOverrideOpHelper, getAllCurrentAndDeletedItemsFromOverrides } from '../util/OverrideOpHelper'
import { ReadonlyDeep } from 'type-fest'
import { TextInputControlWithOverrideForObject } from '../../../lib/Components/TextInput'
import { IntInputControlWithOverrideForObject } from '../../../lib/Components/IntInput'

interface IOutputSettingsProps {
	showStyleBase: ShowStyleBase
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

	const sortedOutputLayers = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(showStyleBase.outputLayersWithOverrides, (a, b) => a._rank - b._rank),
		[showStyleBase.outputLayersWithOverrides]
	)

	const isPGMChannelSet = useMemo(() => {
		return !!sortedOutputLayers.find((layer) => layer.computed && layer.computed.isPGM)
	}, [sortedOutputLayers])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			ShowStyleBases.update(showStyleBase._id, {
				$set: {
					'outputLayersWithOverrides.overrides': newOps,
				},
			})
		},
		[showStyleBase._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, showStyleBase.outputLayersWithOverrides)

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
								setItemValue={overrideHelper.setItemValue}
								clearItemOverride={overrideHelper.clearItemOverrides}
								resetItem={overrideHelper.resetItem}
							/>
						) : (
							item.defaults && (
								<OutputLayerDeletedEntry key={item.id} item={item.defaults} doUndelete={overrideHelper.resetItem} />
							)
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
	itemOps: ReadonlyDeep<SomeObjectOverrideOp[]>
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
								<TextInputControlWithOverrideForObject
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									label={t('Channel Name')}
									item={item}
									defaultItem={defaultItem}
									itemKey={'name'}
									itemOps={itemOps}
									opPrefix={item._id}
									setValue={setItemValue}
									clearOverride={clearItemOverride}
								/>
							</div>
							<div className="mod mvs mhs">
								<TextInputControlWithOverrideForObject
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									label={t('Internal ID')}
									item={item}
									defaultItem={defaultItem}
									itemKey={'_id'}
									itemOps={itemOps}
									opPrefix={item._id}
									// TODO this should probably work differently
									setValue={setItemValue}
									clearOverride={clearItemOverride}
									disabled={!!defaultItem}
								/>
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
								<IntInputControlWithOverrideForObject
									modifiedClassName="bghl"
									classNames="input text-input input-l"
									label={t('Display Rank')}
									item={item}
									defaultItem={defaultItem}
									itemKey={'_rank'}
									itemOps={itemOps}
									opPrefix={item._id}
									setValue={setItemValue}
									clearOverride={clearItemOverride}
								/>
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
