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

import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'

interface IPropsHeader {
	studioInstallation: StudioInstallation
}

class StudioOutputSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {
	renderOutputs () {
		const { t } = this.props
		return (
			this.props.studioInstallation.outputLayers.map((item) => {
				return (
					<tr key={item._id}>
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
							<button className='action-btn'>
								<CoreIcon id='nrk-minus' />
							</button>
							<button className='action-btn'>
								Edit
							</button>
						</td>
					</tr>
				)
			})
		)
	}

	render() {
		const { t } = this.props
		return (
			<div>
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

class StudioSourcesSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {
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

	renderInputSources () {
		const { t } = this.props
		return (
			this.props.studioInstallation.sourceLayers.map((item) => {
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
								<CoreIcon id='nrk-minus' />
							</button>
							<button className='action-btn'>
								Edit
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
						<div className='col c6'>
							<StudioSourcesSettings {...this.props} />
						</div>
						<div className='col c6'>
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
