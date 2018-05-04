import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import { translate, InjectedTranslateProps } from 'react-i18next'

import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'

import {
	BrowserRouter as Router,
	Route,
	Link,
	NavLink,
	Switch,
	Redirect
} from 'react-router-dom'

import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { ShowStyle, ShowStyles } from '../../lib/collections/ShowStyles'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'

import StudioSettings from './Settings/StudioSettings'

interface IPropsMenuHeader {
	studioInstallations: Array<StudioInstallation>
	showStyles: Array<ShowStyle>
	peripheralDevices: Array<PeripheralDevice>
	match?: any
}
const SettingsMenu = translate()(withTracker(() => {
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})
	let subPeripheralDevices = Meteor.subscribe('peripheralDevices', {})

	return {
		studioInstallations: StudioInstallations.find({}).fetch(),
		showStyles: ShowStyles.find({}).fetch(),
		peripheralDevices: PeripheralDevices.find({}).fetch()
	}
})(class extends React.Component<IPropsMenuHeader & InjectedTranslateProps> {
	statusCodeString (statusCode: PeripheralDeviceAPI.StatusCode) {
		let t = this.props.t

		switch (statusCode) {
			case PeripheralDeviceAPI.StatusCode.UNKNOWN:
				return t('Unknown')
			case PeripheralDeviceAPI.StatusCode.GOOD:
				return t('Good')
			case PeripheralDeviceAPI.StatusCode.WARNING_MINOR:
				return t('Minor Warning')
			case PeripheralDeviceAPI.StatusCode.WARNING_MAJOR:
				return t('Warning')
			case PeripheralDeviceAPI.StatusCode.BAD:
				return t('Bad')
			case PeripheralDeviceAPI.StatusCode.FATAL:
				return t('Fatal')
		}
	}

	connectedString (connected: boolean) {
		let t = this.props.t

		if (connected) {
			return t('Connected')
		} else {
			return t('Disconnected')
		}
	}

	deviceTypeString (type: PeripheralDeviceAPI.DeviceType) {
		let t = this.props.t

		switch (type) {
			case PeripheralDeviceAPI.DeviceType.MOSDEVICE:
				return t('MOS Device')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Playout Device')
			default:
				return t('Unknown Device')
		}
	}

	render () {
		const { t } = this.props

		return (
			<div className='tight-xs htight-xs text-s'>
				<h2 className='mhs'>Studios</h2>
				<hr className='vsubtle man' />
				{
					this.props.studioInstallations.map((item) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={item._id} to={'/settings/studio/' + item._id}>
								<h3>{item.name}</h3>
								<p>
									{t('Source layers')}: {item.sourceLayers.length.toString()} {t('Output channels')}: {item.outputLayers.length.toString()}
								</p>
							</NavLink>,
							<hr className='vsubtle man' key={item._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>Show Styles</h2>
				<hr className='vsubtle man' />
				{
					this.props.showStyles.map((item) => {
						return (
							<div className='settings-menu__settings-menu-item' key={item._id}>
								<div className='selectable clickable'>
									<h3>{item.name}</h3>
								</div>
								<hr className='vsubtle man' />
							</div>
						)
					})
				}
				<h2 className='mhs'>Devices</h2>
				<hr className='vsubtle man' />
				{
					this.props.peripheralDevices.map((item) => {
						return (
							<div className='settings-menu__settings-menu-item' key={item._id}>
								<div className='selectable clickable'>
									<h3>{item.name}</h3>
									<p>
										{t('Status')}: {this.statusCodeString(item.status.statusCode)} {t('Type')}: {this.deviceTypeString(item.type)}
									</p>
								</div>
								<hr className='vsubtle man' />
							</div>
						)
					})
				}
			</div>
		)
	}
}))

class Settings extends React.Component<InjectedTranslateProps> {
	render () {
		const { t } = this.props
		console.log(this.props)

		return (
			<div>
				<header className='mvs'>
					<h1>{t('System Settings')}</h1>
				</header>
				<div className='mod mvl mhs'>
					<div className='row'>
						<div className='col c12 rm-c3 settings-menu'>
							<SettingsMenu match={this.props.match} />
						</div>
						<div className='col c12 rm-c9 settings-dialog'>
							<Switch>
								<Route path='/settings/studio/:studioId' component={StudioSettings} />
								<Route path='/settings/showStyle/:showStyleId' component={Settings} />
								<Route path='/settings/peripheralDevice/:peripheralId' component={Settings} />
							</Switch>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Settings)
