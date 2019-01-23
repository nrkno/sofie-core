import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { translate } from 'react-i18next'
import { Random } from 'meteor/random'
import { literal } from '../../lib/lib'
import { ModalDialog, doModalDialog } from '../lib/ModalDialog'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import {
	Route,
	NavLink,
	Switch,
	Redirect
} from 'react-router-dom'

import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { PeripheralDevice, PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ErrorBoundary } from '../lib/ErrorBoundary'

import StudioSettings from './Settings/StudioSettings'
import DeviceSettings from './Settings/DeviceSettings'
import ShowStyleSettings from './Settings/ShowStyleBaseSettings'
import SnapshotsView from './Settings/SnapshotsView'
import BlueprintSettings from './Settings/BlueprintSettings'
import SystemMessages from './Settings/SystemMessages'

import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { MigrationView } from './Settings/Migration'
import { ShowStyleBases, ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import { ShowStylesAPI } from '../../lib/api/showStyles'
import { callMethod } from '../lib/clientAPI'
import { BlueprintAPI } from '../../lib/api/blueprint'
import { PubSub, meteorSubscribe } from '../../lib/api/pubsub'

class WelcomeToSettings extends React.Component {
	render () {
		return (<div></div>)
	}
}

interface ISettingsMenuProps {
	match?: any
}
interface ISettingsMenuState {
}
interface ISettingsMenuTrackedProps {
	studioInstallations: Array<StudioInstallation>
	showStyleBases: Array<ShowStyleBase>
	blueprints: Array<Blueprint>
	peripheralDevices: Array<PeripheralDevice>
}
const SettingsMenu = translateWithTracker<ISettingsMenuProps, ISettingsMenuState, ISettingsMenuTrackedProps >(() => {
	meteorSubscribe(PubSub.studioInstallations, {})
	meteorSubscribe(PubSub.showStyleBases, {})
	meteorSubscribe(PubSub.showStyleVariants, {})
	meteorSubscribe(PubSub.blueprints, {})
	meteorSubscribe(PubSub.peripheralDevices, {})

	return {
		studioInstallations: StudioInstallations.find({}).fetch(),
		showStyleBases: ShowStyleBases.find({}).fetch(),
		peripheralDevices: PeripheralDevices.find({}, {
			sort: {
				lastConnected: -1
			}}).fetch(),
		blueprints: Blueprints.find({}).fetch(),
	}
})(class SettingsMenu extends MeteorReactComponent<Translated<ISettingsMenuProps & ISettingsMenuTrackedProps>, ISettingsMenuState> {
	constructor (props: Translated<ISettingsMenuProps & ISettingsMenuTrackedProps>) {
		super(props)
		this.state = {
		}
	}

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
				return t('MOS Gateway')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Play-out Gateway')
			case PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER:
				return t('Media Manager')
			case PeripheralDeviceAPI.DeviceType.OTHER:
				return ''
			default:
				return t('Unknown Device')
		}
	}

	onAddShowStyleBase () {
		callMethod('Menu', ShowStylesAPI.methods.insertShowStyleBase)
	}
	onAddBlueprint () {
		let t = this.props.t
		callMethod('Menu', BlueprintAPI.methods.insertBlueprint)
	}

	onDeleteShowStyleBase (item: ShowStyleBase) {
		const { t } = this.props
		doModalDialog({
			title: t('Delete this show style?'),
			message: [
				<p>{t('Are you sure you want to delete the show style "{{showStyleId}}"?', { showStyleId: item && item.name })}</p>
			],
			onAccept: () => {
				callMethod('ModalDialog', ShowStylesAPI.methods.removeShowStyleBase, item._id)
			}
		})
	}
	onDeleteBlueprint (blueprint: Blueprint) {
		const { t } = this.props
		doModalDialog({
			title: t('Delete this blueprint?'),
			message: [
				<p>{t('Are you sure you want to delete the blueprint "{{blueprintId}}"?', { blueprintId: blueprint && blueprint.name })}</p>
			],
			onAccept: () => {
				callMethod('ModalDialog', BlueprintAPI.methods.removeBlueprint, blueprint._id)
			}
		})
	}
	onDeleteDevice (device: PeripheralDevice) {
		const { t } = this.props
		doModalDialog({
			title: t('Remove this device?'),
			message: [
				<p>{t('Are you sure you want to remove the device "{{deviceName}}" and all of it\'s sub-devices?', { deviceName: device && device.name })}</p>
			],
			onAccept: () => {
				callMethod('ModalDialog', 'temporaryRemovePeripheralDevice', device._id)
			}
		})
	}
	render () {
		const { t } = this.props

		return (
			<div className='tight-xs htight-xs text-s'>
				<h2 className='mhs'>{t('Studios')}</h2>
				<hr className='vsubtle man' />
				{
					this.props.studioInstallations.map((studio) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={studio._id} to={'/settings/studio/' + studio._id}>
								<h3>{studio.name || t('Unnamed studio')}</h3>
							</NavLink>,
							<hr className='vsubtle man' key={studio._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>
					<button className='action-btn right' onClick={(e) => this.onAddShowStyleBase()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Show styles')}
				</h2>
				<hr className='vsubtle man' />
				{
					this.props.showStyleBases.map((showStyleBase) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={showStyleBase._id} to={'/settings/showStyleBase/' + showStyleBase._id}>
								<div className='selectable clickable'>
									<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteShowStyleBase(showStyleBase) }}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
									<h3>{showStyleBase.name || t('Unnamed show style')}</h3>
									{ showStyleBase.sourceLayers && showStyleBase.outputLayers &&
										<p>
											{t('Source layers')}: {showStyleBase.sourceLayers.length.toString()} {t('Output channels')}: {showStyleBase.outputLayers.length.toString()}
										</p>
									}
								</div>
							</NavLink>,
							<hr className='vsubtle man' key={showStyleBase._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>
					<button className='action-btn right' onClick={(e) => this.onAddBlueprint()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Blueprints')}
				</h2>
				<hr className='vsubtle man' />
				{
					this.props.blueprints.map((blueprint) => {
						return (
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={blueprint._id} to={'/settings/blueprint/' + blueprint._id}>
								<div className='selectable clickable'>
									<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteBlueprint(blueprint) }}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
									<h3>{blueprint.name || t('Unnamed blueprint')}</h3>
									<p>{t('Version')} {blueprint.blueprintVersion}</p>
								</div>
								<hr className='vsubtle man' />
							</NavLink>
						)
					})
				}
				<h2 className='mhs'>{t('Devices')}</h2>
				<hr className='vsubtle man' />
				{
					this.props.peripheralDevices
					.filter((device) => {
						return device.type !== PeripheralDeviceAPI.DeviceType.OTHER
					})
					.map((item) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={item._id} to={'/settings/peripheralDevice/' + item._id}>
								<button className='action-btn right' onClick={(e) => { e.preventDefault(); e.stopPropagation(); this.onDeleteDevice(item) }}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
								<h3>{item.name}</h3>
								<p>
									{item.connected ? t('Connected') : t('Disconnected')}, {t('Status')}: {this.statusCodeString(item.status.statusCode)}
								</p>
							</NavLink>,
							<hr className='vsubtle man' key={item._id + '-hr'} />
						]
					})
				}
				<h2 className='mhs'>{t('Tools')}</h2>
				<hr className='vsubtle man' />
				<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' to='/settings/tools/messages'>
					<h3>{t('System messages')}</h3>
				</NavLink>
				<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' to='/settings/tools/migration'>
					<h3>{t('Upgrade database')}</h3>
				</NavLink>
				<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' to='/settings/tools/snapshots'>
					<h3>{t('Manage Snapshots')}</h3>
				</NavLink>
			</div>
		)
	}
})
interface ISettingsProps {
	match?: any
}
class Settings extends MeteorReactComponent<Translated<ISettingsProps>> {
	componentWillMount () {
		// Subscribe to data:
		this.subscribe('peripheralDevices', {})
		this.subscribe('studioInstallations', {})
		this.subscribe('showStyleBases', {})
		this.subscribe('showStyleVariants', {})
		this.subscribe('blueprints', {})
	}
	render () {
		const { t } = this.props

		return (
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('System Settings')}</h1>
				</header>
				<div className='mod mvl mhs'>
					<div className='row'>
						<div className='col c12 rm-c3 settings-menu'>
							<ErrorBoundary>
								<SettingsMenu match={this.props.match} />
							</ErrorBoundary>
						</div>
						<div className='col c12 rm-c9 settings-dialog'>
							<ErrorBoundary>
								<Switch>
									<Route path='/settings' exact component={WelcomeToSettings} />
									<Route path='/settings/studio/:studioId' component={StudioSettings} />
									<Route path='/settings/showStyleBase/:showStyleBaseId' component={ShowStyleSettings} />
									<Route path='/settings/peripheralDevice/:deviceId' component={DeviceSettings} />
									<Route path='/settings/blueprint/:blueprintId' component={BlueprintSettings} />
									<Route path='/settings/tools/snapshots' component={SnapshotsView} />
									<Route path='/settings/tools/migration' component={MigrationView} />
									<Route path='/settings/tools/messages' component={SystemMessages} />
									<Redirect to='/settings' />
								</Switch>
							</ErrorBoundary>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Settings)
