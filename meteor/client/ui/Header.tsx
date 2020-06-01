import * as React from 'react'
import { InjectedTranslateProps } from 'react-i18next'

import { NavLink } from 'react-router-dom'
import { NotificationCenterPanelToggle, NotificationCenterPanel } from '../lib/notifications/NotificationCenterPanel'
import { NotificationCenter } from '../lib/notifications/notifications'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { SupportPopUpToggle, SupportPopUp } from './SupportPopUp'
import * as VelocityReact from 'velocity-react'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { CoreSystem } from '../../lib/collections/CoreSystem'

interface IPropsHeader {
	allowConfigure?: boolean
	allowTesting?: boolean
	allowDeveloper?: boolean
}

interface ITrackedPropsHeader {
	name: string
}

interface IStateHeader {
	showNotifications: boolean
	showSupportPanel: boolean
}

class Header extends MeteorReactComponent<Translated<IPropsHeader & ITrackedPropsHeader>, IStateHeader> {
	constructor(props: IPropsHeader & InjectedTranslateProps) {
		super(props)

		this.state = {
			showNotifications: false,
			showSupportPanel: false,
		}
	}

	onToggleNotifications = (e: React.MouseEvent<HTMLButtonElement>) => {
		NotificationCenter.isOpen = !this.state.showNotifications

		this.setState({
			showNotifications: !this.state.showNotifications,
		})
	}

	onToggleSupportPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
		this.setState({
			showSupportPanel: !this.state.showSupportPanel,
		})
	}

	render() {
		const { t } = this.props

		return (
			<React.Fragment>
				<ErrorBoundary>
					<VelocityReact.VelocityTransitionGroup
						enter={{
							animation: {
								translateX: ['0%', '100%'],
							},
							easing: 'ease-out',
							duration: 300,
						}}
						leave={{
							animation: {
								translateX: ['100%', '0%'],
							},
							easing: 'ease-in',
							duration: 500,
						}}>
						{this.state.showNotifications && <NotificationCenterPanel limitCount={15} />}
					</VelocityReact.VelocityTransitionGroup>
					<VelocityReact.VelocityTransitionGroup
						enter={{
							animation: {
								translateX: ['0%', '100%'],
							},
							easing: 'ease-out',
							duration: 300,
						}}
						leave={{
							animation: {
								translateX: ['100%', '0%'],
							},
							easing: 'ease-in',
							duration: 500,
						}}>
						{this.state.showSupportPanel && <SupportPopUp />}
					</VelocityReact.VelocityTransitionGroup>
				</ErrorBoundary>
				<ErrorBoundary>
					<div className="status-bar">
						<NotificationCenterPanelToggle onClick={this.onToggleNotifications} isOpen={this.state.showNotifications} />
						<SupportPopUpToggle onClick={this.onToggleSupportPanel} isOpen={this.state.showSupportPanel} />
					</div>
				</ErrorBoundary>
				<div className="header dark">
					<div className="gutter frow va-middle ha-between phm">
						<div className="fcol">
							<div className="frow">
								<div className="badge">
									<div className="media-elem mrs sofie-logo" />
									<div className="bd mls">
										<span className="logo-text">Sofie {this.props.name ? ' - ' + this.props.name : null}</span>
									</div>
								</div>
							</div>
						</div>
						<div className="fcol">
							<div className="frow ha-right">
								<nav className="links mod">
									{/* <NavLink to='/' activeClassName='active'>{t('Home')}</NavLink> */}
									<NavLink to="/" activeClassName="active">
										{t('Rundowns')}
									</NavLink>
									{this.props.allowTesting && (
										<NavLink to="/testTools" activeClassName="active">
											{t('Test Tools')}
										</NavLink>
									)}
									<NavLink to="/status" activeClassName="active">
										{t('Status')}
									</NavLink>
									{this.props.allowConfigure && (
										<NavLink to="/settings" activeClassName="active">
											{t('Settings')}
										</NavLink>
									)}
								</nav>
							</div>
						</div>
					</div>
				</div>
			</React.Fragment>
		)
	}
}

export default translateWithTracker((props: IPropsHeader & InjectedTranslateProps) => {
	const coreSystem = CoreSystem.findOne()
	let name: string | undefined = undefined

	if (coreSystem) {
		name = coreSystem.name
	}

	return {
		name,
	}
})(Header)
