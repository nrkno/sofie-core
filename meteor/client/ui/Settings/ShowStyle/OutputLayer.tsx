import React from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IOutputLayer } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { Random } from 'meteor/random'
import Tooltip from 'rc-tooltip'
import { withTranslation } from 'react-i18next'
import { ShowStyleBase, ShowStyleBases } from '../../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../../lib/EditAttribute'
import { getHelpMode } from '../../../lib/localStorage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { findHighestRank } from '../StudioSettings'
import _ from 'underscore'

interface IOutputSettingsProps {
	showStyleBase: ShowStyleBase
}
interface IOutputSettingsState {
	editedOutputs: Array<string>
}

export const OutputLayerSettings = withTranslation()(
	class OutputSettings extends React.Component<Translated<IOutputSettingsProps>, IOutputSettingsState> {
		constructor(props: Translated<IOutputSettingsProps>) {
			super(props)

			this.state = {
				editedOutputs: [],
			}
		}

		isPGMChannelSet() {
			if (!this.props.showStyleBase.outputLayers) return false
			return this.props.showStyleBase.outputLayers.filter((layer) => layer.isPGM).length > 0
		}

		isItemEdited = (item: IOutputLayer) => {
			return this.state.editedOutputs.indexOf(item._id) >= 0
		}

		finishEditItem = (item: IOutputLayer) => {
			const index = this.state.editedOutputs.indexOf(item._id)
			if (index >= 0) {
				this.state.editedOutputs.splice(index, 1)
				this.setState({
					editedOutputs: this.state.editedOutputs,
				})
			}
		}

		editItem = (item: IOutputLayer) => {
			if (this.state.editedOutputs.indexOf(item._id) < 0) {
				this.state.editedOutputs.push(item._id)
				this.setState({
					editedOutputs: this.state.editedOutputs,
				})
			} else {
				this.finishEditItem(item)
			}
		}

		confirmDelete = (output: IOutputLayer) => {
			const { t } = this.props
			doModalDialog({
				title: t('Delete this output?'),
				no: t('Cancel'),
				yes: t('Delete'),
				onAccept: () => {
					this.onDeleteOutput(output)
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to delete source layer "{{outputId}}"?', { outputId: output && output.name })}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		}
		onAddOutput = () => {
			const maxRank = findHighestRank(this.props.showStyleBase.outputLayers)
			const { t } = this.props

			const newOutput = literal<IOutputLayer>({
				_id: this.props.showStyleBase._id + '-' + Random.id(5),
				_rank: maxRank ? maxRank._rank + 10 : 0,
				name: t('New Output'),
				isPGM: false,
			})

			ShowStyleBases.update(this.props.showStyleBase._id, {
				$push: {
					outputLayers: newOutput,
				},
			})
		}
		onDeleteOutput = (item: IOutputLayer) => {
			if (this.props.showStyleBase) {
				ShowStyleBases.update(this.props.showStyleBase._id, {
					$pull: {
						outputLayers: {
							_id: item._id,
						},
					},
				})
			}
		}

		renderOutputs() {
			const { t } = this.props
			return _.map(this.props.showStyleBase.outputLayers, (item, index) => {
				const newItem = _.clone(item) as IOutputLayer & { index: number }
				newItem.index = index
				return newItem
			})
				.sort((a, b) => {
					return a._rank - b._rank
				})
				.map((item) => {
					return [
						<tr
							key={item._id}
							className={ClassNames({
								hl: this.isItemEdited(item),
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
								<button className="action-btn" onClick={() => this.editItem(item)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.confirmDelete(item)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>,
						this.isItemEdited(item) ? (
							<tr className="expando-details hl" key={item._id + '-details'}>
								<td colSpan={4}>
									<div>
										<div className="mod mvs mhs">
											<label className="field">
												{t('Channel Name')}
												<EditAttribute
													modifiedClassName="bghl"
													attribute={'outputLayers.' + item.index + '.name'}
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
													attribute={'outputLayers.' + item.index + '._id'}
													obj={this.props.showStyleBase}
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
													attribute={'outputLayers.' + item.index + '.isPGM'}
													obj={this.props.showStyleBase}
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
													attribute={'outputLayers.' + item.index + '._rank'}
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
													attribute={'outputLayers.' + item.index + '.isDefaultCollapsed'}
													obj={this.props.showStyleBase}
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
													attribute={'outputLayers.' + item.index + '.isFlattened'}
													obj={this.props.showStyleBase}
													type="checkbox"
													collection={ShowStyleBases}
													className=""
												></EditAttribute>
												{t('Is flattened')}
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
						) : null,
					]
				})
		}

		render() {
			const { t } = this.props
			return (
				<div>
					<h2 className="mhn">
						<Tooltip
							overlay={t('Output channels are required for your studio to work')}
							visible={getHelpMode() && !this.props.showStyleBase.outputLayers.length}
							placement="top"
						>
							<span>{t('Output channels')}</span>
						</Tooltip>
					</h2>
					{!this.props.showStyleBase ||
					!this.props.showStyleBase.outputLayers ||
					!this.props.showStyleBase.outputLayers.length ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No output channels set')}
						</div>
					) : null}
					{!this.isPGMChannelSet() ? (
						<div className="error-notice">
							<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No PGM output')}
						</div>
					) : null}
					<table className="expando settings-studio-output-table">
						<tbody>{this.renderOutputs()}</tbody>
					</table>
					<div className="mod mhs">
						<button className="btn btn-primary" onClick={this.onAddOutput}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
					</div>
				</div>
			)
		}
	}
)
