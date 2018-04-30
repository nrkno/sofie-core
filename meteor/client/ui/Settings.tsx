import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IPropsHeader extends InjectedTranslateProps {

}
export class Settings extends React.Component<IPropsHeader> {
	render () {
		const { t } = this.props

		return (
			<div>
				<header className='mvl'>
					<h1>{t('System Settings')}</h1>
				</header>
				<div className='mod mvl'>
					<h2>Section 1</h2>
				</div>
			</div>
		)
	}
}

export default translate()(withTracker(() => {
	return {}
})(Settings))
