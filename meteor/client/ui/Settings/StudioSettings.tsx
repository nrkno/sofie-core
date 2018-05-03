import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import { translate, InjectedTranslateProps } from 'react-i18next'

import { EditAttribute } from '../../lib/editAttribute'

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
class StudioSettings extends React.Component<IPropsHeader & InjectedTranslateProps> {
	renderEditForm () {
		const { t } = this.props

		return (
				<div className='studio-edit mod mhl mvs'>
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
						</div>
					</label>
				</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.studioInstallation) {
			return this.renderEditForm()
		} else {
			return <div>Loading...</div>
		}
	}
}

export default translate()(withTracker((props, state) => {
	return {
		studioInstallation: StudioInstallations.findOne(props.match.params.studioId)
	}
})(StudioSettings))
