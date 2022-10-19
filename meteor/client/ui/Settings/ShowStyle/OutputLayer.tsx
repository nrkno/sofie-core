import React, { useCallback, useMemo, useState } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IOutputLayer } from '@sofie-automation/blueprints-integration'
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../../lib/EditAttribute'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { findHighestRank } from '../StudioSettings'

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

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				outputLayers: newOutput,
			},
		})
	}, [])

	const sortedOutputLayers = Object.values(showStyleBase.outputLayersWithOverrides.defaults)
		.filter((l): l is IOutputLayer => !!l)
		.sort((a, b) => a._rank - b._rank)

	const isPGMChannelSet = useMemo(() => {
		return !!Object.values(showStyleBase.outputLayersWithOverrides.defaults).find((layer) => layer && layer.isPGM)
	}, [showStyleBase.outputLayersWithOverrides])

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
					{sortedOutputLayers.map((item) => (
						<OutputLayerEntry
							key={item._id}
							showStyleBase={showStyleBase}
							item={item}
							isExpanded={!!expandedItemIds[item._id]}
							toggleExpanded={toggleExpanded}
						/>
					))}
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

interface EntryProps {
	showStyleBase: ShowStyleBase
	item: IOutputLayer
	isExpanded: boolean
	toggleExpanded: (itemId: string) => void
}
function OutputLayerEntry({ showStyleBase, item, isExpanded, toggleExpanded }: EntryProps) {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(item._id), [toggleExpanded, item._id])

	const confirmDelete = useCallback(() => {
		doModalDialog({
			title: t('Delete this output?'),
			no: t('Cancel'),
			yes: t('Delete'),
			onAccept: () => {
				if (showStyleBase?._id) {
					ShowStyleBases.update(showStyleBase._id, {
						$pull: {
							outputLayers: {
								_id: item._id,
							},
						},
					})
				}
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to delete output layer "{{outputId}}"?', { outputId: item?.name })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}, [t, item._id, item.name, showStyleBase?._id])

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
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`outputLayersWithOverrides.defaults.${item._id}.isPGM`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Is PGM Output')}
								</label>
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
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`outputLayersWithOverrides.defaults.${item._id}.isDefaultCollapsed`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Is collapsed by default')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`outputLayersWithOverrides.defaults.${item._id}.isFlattened`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Is flattened')}
								</label>
							</div>
						</div>
						<div className="mod alright">
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
