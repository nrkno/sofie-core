import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { I18nextProvider, translate, InjectedTranslateProps, InjectedI18nProps } from 'react-i18next'
import { InjectedTranslateI18nProps } from './App'

import { Link, NavLink } from 'react-router-dom'

interface IPropsHeader extends InjectedTranslateI18nProps {

}

class Header extends React.Component<IPropsHeader> {
	render () {
		const { t, i18n } = this.props

		return (
			<div className='header row'>
				<div className='col c6 dark'>
					<div className='badge mod'>
						<div className='media-elem mrs sofie-logo' />
						<div className='bd mls'><span className='logo-text'>Sofie</span></div>
					</div>
				</div>
				<div className='col c6 dark'>
					<nav className='links mod'>
						<NavLink to='/' activeClassName='active'>{t('Home')}</NavLink>
						<NavLink to='/runningOrders' activeClassName='active'>{t('Running Orders')}</NavLink>
						<NavLink to='/nymansPlayground' activeClassName='active'>{t('Nyman\'s Playground')}</NavLink>
						<NavLink to='/status' activeClassName='active'>{t('Status')}</NavLink>
						<NavLink to='/settings' activeClassName='active'>{t('Settings')}</NavLink>
					</nav>
				</div>
			</div>
		)
	}
}

export default translate()(Header)
