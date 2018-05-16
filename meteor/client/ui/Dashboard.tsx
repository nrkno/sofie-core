import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IPropsHeader extends InjectedTranslateProps {

}
class Dashboard extends React.Component<IPropsHeader> {
	render () {
		const { t } = this.props

		return (
			<div>
				<div className='mvs'>
					<h1>{t('Welcome to Sofie')}</h1>
				</div>
			</div>
		)
	}
}

export default translate()(Dashboard)
