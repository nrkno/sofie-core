import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { translate, InjectedTranslateProps } from 'react-i18next'

import * as ClassNames from 'classnames'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { AdLibPanel } from './AdLibPanel'

interface IPropsHeader {

}

enum InspectorPanelTabs {
	ADLIB = 'adlib'
}

interface IStateHeader {
	expanded: boolean
	selectedTab: InspectorPanelTabs
}

export const InspectorDrawer = translate()(class extends React.Component<IPropsHeader & InjectedTranslateProps, IStateHeader> {
	constructor (props) {
		super(props)

		this.state = {
			expanded: false,
			selectedTab: InspectorPanelTabs.ADLIB
		}
	}

	getStyle () {
		return this.state.expanded ?
		{
			'top': '50vh',
			'transition': '0.5s top ease-out'
		}
		:
		{
			'top': undefined,
			'transition': '0.5s top ease-out'
		}
	}

	toggleDrawer () {
		this.setState({
			expanded: !this.state.expanded
		})
	}

	switchTab (tab: InspectorPanelTabs) {
		this.setState({
			selectedTab: tab
		})
	}

	render () {
		const { t } = this.props
		return (
			<div className='running-order-view__inspector-drawer dark' style={this.getStyle()}>
				<div className='running-order-view__inspector-drawer__handle dark' tabIndex={0} onClick={(e) => this.toggleDrawer()}>
					<FontAwesomeIcon icon={faBars} />
				</div>
				<div className='running-order-view__inspector-drawer__tabs'>
					<div className={ClassNames('running-order-view__inspector-drawer__tabs__tab', {
						'selected': this.state.selectedTab === InspectorPanelTabs.ADLIB
					})} onClick={(e) => this.switchTab(InspectorPanelTabs.ADLIB)} tabIndex={0}>{t('AdLib')}</div>
				</div>
				<div className='running-order-view__inspector-drawer__panel super-dark'>
					<AdLibPanel {...this.props}></AdLibPanel>
				</div>
			</div>
		)
	}
})
