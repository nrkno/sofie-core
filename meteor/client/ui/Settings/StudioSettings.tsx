import * as ClassNames from 'classnames'
import * as React from 'react'
import { InjectedTranslateProps, translate } from 'react-i18next'
import * as _ from 'underscore'
import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer, ISourceLayer, StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

interface IPropsHeader {
	studioInstallation: StudioInstallation
}

interface IChildStudioInterfaceProps {
	onDeleteSource?: (item: ISourceLayer) => void
	onDeleteOutput?: (item: IOutputLayer) => void
	onAddSource?: () => void
	onAddOutput?: () => void
}

interface IStudioOutputSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: IOutputLayer | undefined
	editedOutputs: Array<string>
}

class StudioOutputSettings extends React.Component<IChildStudioInterfaceProps & IPropsHeader & InjectedTranslateProps, IStudioOutputSettingsState> {
	constructor (props) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedOutputs: []
		}
	}

	isItemEdited = (item: IOutputLayer) => {
		return this.state.editedOutputs.indexOf(item._id) >= 0
	}

	finishEditItem = (item: IOutputLayer) => {
		let index = this.state.editedOutputs.indexOf(item._id)
		if (index >= 0) {
			this.state.editedOutputs.splice(index, 1)
			this.setState({
				editedOutputs: this.state.editedOutputs
			})
		}
	}

	editItem = (item: IOutputLayer) => {
		if (this.state.editedOutputs.indexOf(item._id) < 0) {
			this.state.editedOutputs.push(item._id)
			this.setState({
				editedOutputs: this.state.editedOutputs
			})
		}
	}

	confirmDelete = (item: IOutputLayer) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmItem: item
		})
	}

	handleConfirmDeleteCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	handleConfirmDeleteAccept = (e) => {
		if (this.props.onDeleteOutput && typeof this.props.onDeleteOutput === 'function' && this.state.deleteConfirmItem) {
			this.props.onDeleteOutput(this.state.deleteConfirmItem)
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderOutputs () {
		const { t } = this.props
		return (
			this.props.studioInstallation.outputLayers.sort((a, b) => {
				return a._rank - b._rank
			}).map((item, index) => {
				return [
					<tr key={item._id} className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-output-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-output-table__id c4'>
							{item._id}
						</td>
						<td className='settings-studio-output-table__isPGM c3'>
							<div className={ClassNames('switch', 'switch-tight', {
								'switch-active': item.isPGM
							})}>PGM</div>
						</td>
						<td className='settings-studio-output-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>,
					this.isItemEdited(item) ?
						<tr className='expando-details hl' key={item._id + '-details'}>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Channel name')}
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'outputLayers.' + index + '.name'}
													obj={this.props.studioInstallation}
													type='text'
													collection={StudioInstallations}
													className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Internal ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'outputLayers.' + index + '._id'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is PGM output')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'outputLayers.' + index + '.isPGM'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
										</label>
									</div>
								</div>
								<div className='mod alright'>
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(item)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
					:
						null
				]
			})
		)
	}

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t(`Are you sure you want to delete output channel ${this.state.deleteConfirmItem && this.state.deleteConfirmItem.name}?`)}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				<h3>{t('Output channels')}</h3>
				<table className='expando settings-studio-output-table'>
					<tbody>
						{this.renderOutputs()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.props.onAddOutput}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}

interface IStudioSourcesSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: ISourceLayer | undefined
	editedSources: Array<string>
}

class StudioSourcesSettings extends React.Component<IChildStudioInterfaceProps & IPropsHeader & InjectedTranslateProps, IStudioSourcesSettingsState> {
	constructor (props) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedSources: []
		}
	}

	isItemEdited = (item: ISourceLayer) => {
		return this.state.editedSources.indexOf(item._id) >= 0
	}

	finishEditItem = (item: ISourceLayer) => {
		let index = this.state.editedSources.indexOf(item._id)
		if (index >= 0) {
			this.state.editedSources.splice(index, 1)
			this.setState({
				editedSources: this.state.editedSources
			})
		}
	}

	editItem = (item: ISourceLayer) => {
		if (this.state.editedSources.indexOf(item._id) < 0) {
			this.state.editedSources.push(item._id)
			this.setState({
				editedSources: this.state.editedSources
			})
		}
	}

	sourceLayerString (type: RundownAPI.SourceLayerType) {
		const { t } = this.props
		switch (type) {
			case RundownAPI.SourceLayerType.CAMERA:
				return t('Camera')
			case RundownAPI.SourceLayerType.GRAPHICS:
				return t('Graphics')
			case RundownAPI.SourceLayerType.LIVE_SPEAK:
				return t('LiveSpeak')
			case RundownAPI.SourceLayerType.LOWER_THIRD:
				return t('Lower Third')
			case RundownAPI.SourceLayerType.MIC:
				return t('Studio Microphone')
			case RundownAPI.SourceLayerType.REMOTE:
				return t('Remote source')
			case RundownAPI.SourceLayerType.SCRIPT:
				return t('Generic script')
			case RundownAPI.SourceLayerType.SPLITS:
				return t('Split screen')
			case RundownAPI.SourceLayerType.VT:
				return t('Clips')
			case RundownAPI.SourceLayerType.METADATA:
				return t('Metadata')
			case RundownAPI.SourceLayerType.CAMERA_MOVEMENT:
				return t('Camera Movement')
			case RundownAPI.SourceLayerType.UNKNOWN:
				return t('Unknown layer')
			case RundownAPI.SourceLayerType.AUDIO:
				return t('Audio Mixing')
			default:
				return RundownAPI.SourceLayerType[type]
		}
	}

	confirmDelete = (item: ISourceLayer) => {
		this.setState({
			showDeleteConfirm: true,
			deleteConfirmItem: item
		})
	}

	handleConfirmDeleteCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	handleConfirmDeleteAccept = (e) => {
		if (this.props.onDeleteSource && typeof this.props.onDeleteSource === 'function' && this.state.deleteConfirmItem) {
			this.props.onDeleteSource(this.state.deleteConfirmItem)
		}

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderInputSources () {
		const { t } = this.props

		let sourceLayerTypeOptions = _.keys(RundownAPI.SourceLayerType).filter((item) => {
			if (!Number.isNaN(Number.parseFloat(item))) {
				return true
			} else {
				return false
			}
		}).map((item) => {
			return ({
				name: this.sourceLayerString(Number.parseInt(item) as RundownAPI.SourceLayerType),
				value: Number.parseInt(item)
			})
		})

		return (
			this.props.studioInstallation.sourceLayers.sort((a, b) => {
				return a._rank - b._rank
			}).map((item, index) => {
				return [
					<tr key={item._id} className={ClassNames({
						'hl': this.isItemEdited(item)
					})}>
						<th className='settings-studio-source-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-source-table__id c4'>
							{item._id}
						</td>
						<td className='settings-studio-source-table__type c3'>
							{this.sourceLayerString(Number.parseInt(item.type.toString()) as RundownAPI.SourceLayerType)}
						</td>
						<td className='settings-studio-source-table__actions table-item-actions c3'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								<FontAwesomeIcon icon={faPencilAlt} />
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								<FontAwesomeIcon icon={faTrash} />
							</button>
						</td>
					</tr>,
					this.isItemEdited(item) ?
						<tr className='expando-details hl' key={item._id + '-details'}>
							<td colSpan={4}>
								<div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Source name')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.name'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Internal ID')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '._id'}
												obj={this.props.studioInstallation}
												type='text'
												collection={StudioInstallations}
												className='input text-input input-l'></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Source type')}
											<div className='select focusable'>
												<EditAttribute
													modifiedClassName='bghl'
													attribute={'sourceLayers.' + index + '.type'}
													obj={this.props.studioInstallation}
													type='dropdown'
													options={sourceLayerTypeOptions}
													optionsAreNumbers
													collection={StudioInstallations}
													className='focusable-main input-l'></EditAttribute>
											</div>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is unlimited')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.unlimited'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is on clean PGM')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.onPGMClean'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
										</label>
									</div>
									<div className='mod mvs mhs'>
										<label className='field'>
											{t('Is a live remote input')}
											<EditAttribute
												modifiedClassName='bghl'
												attribute={'sourceLayers.' + index + '.isRemoteInput'}
												obj={this.props.studioInstallation}
												type='checkbox'
												collection={StudioInstallations}
												className=''></EditAttribute>
										</label>
									</div>
								</div>
								<div className='mod alright'>
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(item)}>
										<FontAwesomeIcon icon={faCheck} />
									</button>
								</div>
							</td>
						</tr>
						:
						null
				]
			})
		)
	}

	render () {
		const { t } = this.props
		return (
			<div>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t(`Are you sure you want to delete source layer ${this.state.deleteConfirmItem && this.state.deleteConfirmItem.name}?`)}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				<h3>{t('Source layers')}</h3>
				<table className='expando settings-studio-source-table'>
					<tbody>
						{this.renderInputSources()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.props.onAddSource}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</div>
		)
	}
}

class StudioSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {

	onDeleteSource = (item: ISourceLayer) => {
		if (this.props.studioInstallation) {
			StudioInstallations.update(this.props.studioInstallation._id, {
				$pull: {
					sourceLayers: {
						_id: item._id
					}
				}
			})
		}
	}

	onDeleteOutput = (item: IOutputLayer) => {
		if (this.props.studioInstallation) {
			StudioInstallations.update(this.props.studioInstallation._id, {
				$pull: {
					outputLayers: {
						_id: item._id
					}
				}
			})
		}
	}

	findHighestRank (array: Array<{_rank: number}>): {_rank: number} | null {
		let max: {_rank: number} | null = null

		array.forEach((value, index) => {
			if (max == null || max._rank < value._rank) {
				max = value
			}
		})

		return max
	}

	onAddSource = () => {
		const maxRank = this.findHighestRank(this.props.studioInstallation.sourceLayers)
		const { t } = this.props

		const newSource = literal<ISourceLayer>({
			_id: this.props.studioInstallation._id + '-' + Random.id(5),
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New source'),
			type: RundownAPI.SourceLayerType.UNKNOWN,
			unlimited: false,
			onPGMClean: true
		})

		StudioInstallations.update(this.props.studioInstallation._id, {
			$push: {
				sourceLayers: newSource
			}
		})
	}

	onAddOutput = () => {
		const maxRank = this.findHighestRank(this.props.studioInstallation.outputLayers)
		const { t } = this.props

		const newOutput = literal<IOutputLayer>({
			_id: this.props.studioInstallation._id + '-' + Random.id(5),
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New output'),
			isPGM: false
		})

		StudioInstallations.update(this.props.studioInstallation._id, {
			$push: {
				outputLayers: newOutput
			}
		})
	}

	renderEditForm () {
		const { t } = this.props

		return (
				<div className='studio-edit mod mhl mvs'>
					<div>
						<h3>{t('Generic properties')}</h3>
						<label className='field'>
							{t('Studio name')}
							<div className='mdi'>
								<EditAttribute
									modifiedClassName='bghl'
									attribute='name'
									obj={this.props.studioInstallation}
									type='text'
									collection={StudioInstallations}
									className='mdinput'></EditAttribute>
								<span className='mdfx'></span>
							</div>
						</label>
					</div>

					<div className='row'>
						<div className='col c12 rl-c6'>
							<StudioSourcesSettings {...this.props} onDeleteSource={this.onDeleteSource} onAddSource={this.onAddSource} />
						</div>
						<div className='col c12 rl-c6'>
							<StudioOutputSettings {...this.props} onDeleteOutput={this.onDeleteOutput} onAddOutput={this.onAddOutput} />
						</div>
					</div>
				</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.studioInstallation) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
}

export default translate()(withTracker((props, state) => {
	return {
		studioInstallation: StudioInstallations.findOne(props.match.params.studioId)
	}
})(StudioSettings))
