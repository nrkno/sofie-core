import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import { translate, InjectedTranslateProps } from 'react-i18next'
import * as CoreIcon from '@nrk/core-icons/jsx'

import { RundownAPI } from '../../../lib/api/rundown'

import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { Spinner } from '../../lib/Spinner'

import {
	BrowserRouter as Router,
	Route,
	Link,
	NavLink,
	Switch,
	Redirect,
	match
} from 'react-router-dom'

import { StudioInstallation, StudioInstallations, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'

interface IPropsHeader {
	studioInstallation: StudioInstallation
}

interface IStudioOutputSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: IOutputLayer | undefined
	editedOutputs: Array<string>
}

class StudioOutputSettings extends React.Component<IPropsHeader & InjectedTranslateProps, IStudioOutputSettingsState> {
	constructor (props) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined,
			editedOutputs: []
		}
	}

	isItemEdited = (item: IOutputLayer) => {
		return this.state.editedOutputs.indexOf(item._id) >= 0;
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
		console.log(this.state.deleteConfirmItem)

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
						<td className='settings-studio-output-table__id c5'>
							{item._id}
						</td>
						<td className='settings-studio-output-table__isPGM c3'>
							<div className={ClassNames('switch', 'switch-tight', {
								'switch-active': item.isPGM
							})}>PGM</div>
						</td>
						<td className='settings-studio-output-table__actions table-item-actions c2'>
							<button className='action-btn' onClick={(e) => this.editItem(item)}>
								Edit
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								Delete
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
									<button className={ClassNames('btn btn-primary')} onClick={(e) => this.finishEditItem(item)}>{t('Done')}</button>
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
			</div>
		)
	}
}

interface IStudioSourcesSettingsState {
	showDeleteConfirm: boolean
	deleteConfirmItem: ISourceLayer | undefined
}

class StudioSourcesSettings extends React.Component<IPropsHeader & InjectedTranslateProps, IStudioSourcesSettingsState> {
	constructor (props) {
		super(props)

		this.state = {
			showDeleteConfirm: false,
			deleteConfirmItem: undefined
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
			default:
				return t('Unknown source') + ' (' + type.toString() + ')'
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
		console.log(this.state.deleteConfirmItem)

		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}

	renderInputSources () {
		const { t } = this.props
		return (
			this.props.studioInstallation.sourceLayers.sort((a, b) => {
				return a._rank - b._rank
			}).map((item) => {
				return (
					<tr key={item._id}>
						<th className='settings-studio-source-table__name c2'>
							{item.name}
						</th>
						<td className='settings-studio-source-table__id c5'>
							{item._id}
						</td>
						<td className='settings-studio-source-table__type c3'>
							{this.sourceLayerString(item.type)}
						</td>
						<td className='settings-studio-source-table__actions table-item-actions c2'>
							<button className='action-btn'>
								Edit
							</button>
							<button className='action-btn' onClick={(e) => this.confirmDelete(item)}>
								Delete
							</button>
						</td>
					</tr>
				)
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
			</div>
		)
	}
}

class StudioSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {
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
							<StudioSourcesSettings {...this.props} />
						</div>
						<div className='col c12 rl-c6'>
							<StudioOutputSettings {...this.props} />
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
