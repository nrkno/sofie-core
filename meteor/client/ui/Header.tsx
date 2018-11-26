import * as React from 'react'
import { Translated } from '../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'

import { NavLink } from 'react-router-dom'

interface IPropsHeader {
	adminMode?: boolean
	testingMode?: boolean
}

class Header extends React.Component<Translated<IPropsHeader>> {
	render () {
		const { t } = this.props

		return (
			<div className='header dark'>
				<div className='gutter frow va-middle ha-between phm'>
					<div className='fcol'>
						<div className='frow'>
							<div className='badge'>
								<div className='media-elem mrs sofie-logo' />
								<div className='bd mls'><span className='logo-text'>Sofie</span></div>
							</div>
						</div>
					</div>
					<div className='fcol'>
						<div className='frow ha-right'>
							<nav className='links mod'>
								{ /* <NavLink to='/' activeClassName='active'>{t('Home')}</NavLink> */ }
								<NavLink to='/?lng=nb' activeClassName='active'>{t('Running Orders')}</NavLink>
								{ this.props.adminMode && <NavLink to='/nymansPlayground' activeClassName='active'>{t('Nyman\'s Playground')}</NavLink> }
								{ this.props.testingMode && <NavLink to='/testTools' activeClassName='active'>{t('Test Tools')}</NavLink> }
								<NavLink to='/status' activeClassName='active'>{t('Status')}</NavLink>
								{ this.props.adminMode && <NavLink to='/settings' activeClassName='active'>{t('Settings')}</NavLink> }
							</nav>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Header)
