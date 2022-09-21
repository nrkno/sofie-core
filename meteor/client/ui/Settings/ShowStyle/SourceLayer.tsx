import React from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { assertNever, literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { withTranslation } from 'react-i18next'
import _ from 'underscore'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../../lib/EditAttribute'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { findHighestRank } from '../StudioSettings'

interface IStudioSourcesSettingsProps {
	showStyleBase: ShowStyleBase
}
interface IStudioSourcesSettingsState {
	editedSources: Array<string>
}

export const SourceLayerSettings = withTranslation()(
	class SourceLayerSettings extends React.Component<
		Translated<IStudioSourcesSettingsProps>,
		IStudioSourcesSettingsState
	> {
		constructor(props: Translated<IStudioSourcesSettingsProps>) {
			super(props)

			this.state = {
				editedSources: [],
			}
		}

		isItemEdited = (item: ISourceLayer) => {
			return this.state.editedSources.indexOf(item._id) >= 0
		}

		finishEditItem = (item: ISourceLayer) => {
			const index = this.state.editedSources.indexOf(item._id)
			if (index >= 0) {
				this.state.editedSources.splice(index, 1)
				this.setState({
					editedSources: this.state.editedSources,
				})
			}
		}

		editItem = (item: ISourceLayer) => {
			if (this.state.editedSources.indexOf(item._id) < 0) {
				this.state.editedSources.push(item._id)
				this.setState({
					editedSources: this.state.editedSources,
				})
			} else {
				this.finishEditItem(item)
			}
		}

		sourceLayerString(type: SourceLayerType) {
			const { t } = this.props
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
				case SourceLayerType.METADATA:
					return t('Metadata')
				// case SourceLayerType.CAMERA_MOVEMENT:
				// 	return t('Camera Movement')
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
		onAddSource = () => {
			const maxRank = findHighestRank(this.props.showStyleBase.sourceLayers)
			const { t } = this.props

			const newSource = literal<ISourceLayer>({
				_id: this.props.showStyleBase._id + '-' + getRandomString(5),
				_rank: maxRank ? maxRank._rank + 10 : 0,
				name: t('New Source'),
				type: SourceLayerType.UNKNOWN,
			})

			ShowStyleBases.update(this.props.showStyleBase._id, {
				$push: {
					sourceLayers: newSource,
				},
			})
		}
		onDeleteSource = (item: ISourceLayer) => {
			if (this.props.showStyleBase) {
				ShowStyleBases.update(this.props.showStyleBase._id, {
					$pull: {
						sourceLayers: {
							_id: item._id,
						},
					},
				})
			}
		}
		confirmDelete = (item: ISourceLayer) => {
			const { t } = this.props
			doModalDialog({
				title: t('Delete this item?'),
				no: t('Cancel'),
				yes: t('Delete'),
				onAccept: () => {
					this.onDeleteSource(item)
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
		}
		renderInputSources() {
			const { t } = this.props

			return _.map(this.props.showStyleBase.sourceLayers, (item, index) => {
				const newItem = _.clone(item) as ISourceLayer & { index: number }
				newItem.index = index
				return newItem
			})
				.sort((a, b) => {
					return a._rank - b._rank
				})
				.map((item) => {
					return (
						<React.Fragment key={item._id}>
							<tr
								className={ClassNames({
									hl: this.isItemEdited(item),
								})}
							>
								<th className="settings-studio-source-table__name c2">{item.name}</th>
								<td className="settings-studio-source-table__id c4">{item._id}</td>
								<td className="settings-studio-source-table__type c3">
									{this.sourceLayerString(Number.parseInt(item.type.toString(), 10) as SourceLayerType)}
								</td>
								<td className="settings-studio-source-table__actions table-item-actions c3">
									<button className="action-btn" onClick={() => this.editItem(item)}>
										<FontAwesomeIcon icon={faPencilAlt} />
									</button>
									<button className="action-btn" onClick={() => this.confirmDelete(item)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
								</td>
							</tr>
							{this.isItemEdited(item) && (
								<tr className="expando-details hl">
									<td colSpan={4}>
										<div>
											<div className="mod mvs mhs">
												<label className="field">
													{t('Source Name')}
													<EditAttribute
														modifiedClassName="bghl"
														attribute={'sourceLayers.' + item.index + '.name'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.abbreviation'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '._id'}
														obj={this.props.showStyleBase}
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
															attribute={'sourceLayers.' + item.index + '.type'}
															obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.isRemoteInput'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.isGuestInput'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.isHidden'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '._rank'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.onPresenterScreen'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.onListViewColumn'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.onListViewAdLibColumn'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.isClearable'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.isSticky'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.stickyOriginalOnly'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.allowDisable'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.isQueueable'}
														obj={this.props.showStyleBase}
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
														attribute={'sourceLayers.' + item.index + '.exclusiveGroup'}
														obj={this.props.showStyleBase}
														type="text"
														collection={ShowStyleBases}
														className="input text-input input-l"
													></EditAttribute>
												</label>
											</div>
										</div>
										<div className="mod alright">
											<button className="btn btn-primary" onClick={() => this.finishEditItem(item)}>
												<FontAwesomeIcon icon={faCheck} />
											</button>
										</div>
									</td>
								</tr>
							)}
						</React.Fragment>
					)
				})
		}

		render() {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">
						<Tooltip
							overlay={t('Add some source layers (e.g. Graphics) for your data to appear in rundowns')}
							visible={getHelpMode() && !this.props.showStyleBase.sourceLayers.length}
							placement="bottom"
						>
							<span>{t('Source Layers')}</span>
						</Tooltip>
					</h2>
					{!this.props.showStyleBase ||
					!this.props.showStyleBase.sourceLayers ||
					!this.props.showStyleBase.sourceLayers.length ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No source layers set')}
						</div>
					) : null}
					<table className="expando settings-studio-source-table">
						<tbody>{this.renderInputSources()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={this.onAddSource}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</div>
			)
		}
	}
)
