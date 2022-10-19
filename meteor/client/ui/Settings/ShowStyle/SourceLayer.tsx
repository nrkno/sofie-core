import React, { useCallback, useState } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { assertNever, literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { TFunction, useTranslation } from 'react-i18next'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../../lib/EditAttribute'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { findHighestRank } from '../StudioSettings'

function sourceLayerString(t: TFunction<'translation', undefined>, type: SourceLayerType) {
	switch (type) {
		case SourceLayerType.CAMERA:
			return t('Camera')
		case SourceLayerType.GRAPHICS:
			return t('Graphics')
		case SourceLayerType.LIVE_SPEAK:
			return t('Live Speak')
		case SourceLayerType.LOWER_THIRD:
			return t('Lower Third')
		// case SourceLayerType.MIC:
		// 	return t('Studio Microphone')
		case SourceLayerType.REMOTE:
			return t('Remote Source')
		case SourceLayerType.SCRIPT:
			return t('Generic Script')
		case SourceLayerType.SPLITS:
			return t('Split Screen')
		case SourceLayerType.VT:
			return t('Clips')
		case SourceLayerType.UNKNOWN:
			return t('Unknown Layer')
		case SourceLayerType.AUDIO:
			return t('Audio Mixing')
		case SourceLayerType.TRANSITION:
			return t('Transition')
		// case SourceLayerType.LIGHTS:
		// 	return t('Lights')
		case SourceLayerType.LOCAL:
			return t('Local')
		default:
			assertNever(type)
			return SourceLayerType[type]
	}
}

interface IStudioSourcesSettingsProps {
	showStyleBase: ShowStyleBase
}

export function SourceLayerSettings({ showStyleBase }: IStudioSourcesSettingsProps) {
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

	const onAddSource = useCallback(() => {
		const maxRank = findHighestRank(Object.values(showStyleBase.sourceLayersWithOverrides.defaults))

		const newSource = literal<ISourceLayer>({
			_id: `${showStyleBase._id}-${getRandomString(5)}`,
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New Source'),
			type: SourceLayerType.UNKNOWN,
		})

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				sourceLayers: newSource,
			},
		})
	}, [])

	const sortedSourceLayers = Object.values(showStyleBase.sourceLayersWithOverrides.defaults)
		.filter((l): l is ISourceLayer => !!l)
		.sort((a, b) => a._rank - b._rank)

	return (
		<div>
			<h2 className="mhn">
				<Tooltip
					overlay={t('Add some source layers (e.g. Graphics) for your data to appear in rundowns')}
					visible={getHelpMode() && !sortedSourceLayers.length}
					placement="bottom"
				>
					<span>{t('Source Layers')}</span>
				</Tooltip>
			</h2>
			{!sortedSourceLayers.length ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No source layers set')}
				</div>
			) : null}
			<table className="expando settings-studio-source-table">
				<tbody>
					{sortedSourceLayers.map((item) => (
						<SourceLayerEntry
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
				<button className="btn btn-primary" onClick={onAddSource}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}

interface EntryProps {
	showStyleBase: ShowStyleBase
	item: ISourceLayer
	isExpanded: boolean
	toggleExpanded: (itemId: string) => void
}
function SourceLayerEntry({ showStyleBase, item, isExpanded, toggleExpanded }: EntryProps) {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(item._id), [toggleExpanded, item._id])

	const confirmDelete = useCallback(() => {
		doModalDialog({
			title: t('Delete this item?'),
			no: t('Cancel'),
			yes: t('Delete'),
			onAccept: () => {
				if (showStyleBase?._id) {
					ShowStyleBases.update(showStyleBase._id, {
						$pull: {
							sourceLayers: {
								_id: item._id,
							},
						},
					})
				}
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to delete source layer "{{sourceLayerId}}"?', {
							sourceLayerId: item && item.name,
						})}
					</p>
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
				<th className="settings-studio-source-table__name c2">{item.name}</th>
				<td className="settings-studio-source-table__id c4">{item._id}</td>
				<td className="settings-studio-source-table__type c3">
					{sourceLayerString(t, Number.parseInt(item.type.toString(), 10) as SourceLayerType)}
				</td>
				<td className="settings-studio-source-table__actions table-item-actions c3">
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
									{t('Source Name')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.name`}
										obj={showStyleBase}
										type="text"
										collection={ShowStyleBases}
										className="input text-input input-l"
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Source Abbreviation')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.abbreviation`}
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
										attribute={`sourceLayersWithOverrides.defaults.${item._id}._id`}
										obj={showStyleBase}
										type="text"
										collection={ShowStyleBases}
										className="input text-input input-l"
									></EditAttribute>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Source Type')}
									<div className="select focusable">
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`sourceLayersWithOverrides.defaults.${item._id}.type`}
											obj={showStyleBase}
											type="dropdown"
											options={SourceLayerType}
											optionsAreNumbers
											collection={ShowStyleBases}
											className="focusable-main input-l"
										></EditAttribute>
									</div>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.isRemoteInput`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Is a Live Remote Input')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.isGuestInput`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Is a Guest Input')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.isHidden`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Is hidden')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Display Rank')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}._rank`}
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
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.onPresenterScreen`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t("Display on Presenter's Screen")}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.onListViewColumn`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Display in a column in List View')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.onListViewAdLibColumn`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Display AdLibs in a column in List View')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.isClearable`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Pieces on this layer can be cleared')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.isSticky`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Pieces on this layer are sticky')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.stickyOriginalOnly`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('Only Pieces present in rundown are sticky')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.allowDisable`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									/>
									{t('Allow disabling of Pieces')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.isQueueable`}
										obj={showStyleBase}
										type="checkbox"
										collection={ShowStyleBases}
										className=""
									></EditAttribute>
									{t('AdLibs on this layer can be queued')}
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Exclusivity group')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`sourceLayersWithOverrides.defaults.${item._id}.exclusiveGroup`}
										obj={showStyleBase}
										type="text"
										collection={ShowStyleBases}
										className="input text-input input-l"
									></EditAttribute>
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
