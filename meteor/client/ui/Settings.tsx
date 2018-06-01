import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { withTracker } from '../lib/ReactMeteorData/react-meteor-data'
import * as ClassNames from 'classnames'
import Moment from 'react-moment'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { Random } from 'meteor/random'
import { literal } from '../../lib/lib'

import { ModalDialog } from '../lib/ModalDialog'

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
import { RuntimeFunction, RuntimeFunctions } from '../../lib/collections/RuntimeFunctions'

import StudioSettings from './Settings/StudioSettings'
import DeviceSettings from './Settings/DeviceSettings'
import LineTemplates from './Settings/LineTemplates'
import ShowStyleSettings from './Settings/ShowStyleSettings'

import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

class WelcomeToSettings extends React.Component {
	render () {
		return (<div></div>)
	}
}

interface IPropsMenuHeader {
	studioInstallations: Array<StudioInstallation>
	showStyles: Array<ShowStyle>
	peripheralDevices: Array<PeripheralDevice>
	lineTemplates: Array<RuntimeFunction>
	match?: any
}
interface IStateMenuHeader {
	deleteConfirmItem: any
	showDeleteLineTemplateConfirm: boolean
	showDeleteShowStyleConfirm: boolean
}
const SettingsMenu = translate()(withTracker(() => {
	let subStudioInstallations = Meteor.subscribe('studioInstallations', {})
	let subShowStyles = Meteor.subscribe('showStyles', {})
	let subPeripheralDevices = Meteor.subscribe('peripheralDevices', {})
	let subRuntimeFunctions = Meteor.subscribe('runtimeFunctions', {})

	return {
		studioInstallations: StudioInstallations.find({}).fetch(),
		showStyles: ShowStyles.find({}).fetch(),
		peripheralDevices: PeripheralDevices.find({}, {sort: {
			lastSeen: -1
		}}).fetch(),
		lineTemplates: RuntimeFunctions.find({}).fetch()
	}
})(class extends React.Component<IPropsMenuHeader & InjectedTranslateProps, IStateMenuHeader> {
	constructor (props) {
		super(props)
		this.state = {
			deleteConfirmItem: undefined,
			showDeleteLineTemplateConfirm: false,
			showDeleteShowStyleConfirm: false
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
				return t('MOS Device')
			case PeripheralDeviceAPI.DeviceType.PLAYOUT:
				return t('Playout Device')
			default:
				return t('Unknown Device')
		}
	}

	onAddLineTemplate () {
		RuntimeFunctions.insert(literal<RuntimeFunction>({
			_id: Random.hexString(5),
			code: ''
		}))
	}

	onAddShowStyle () {
		ShowStyles.insert(literal<ShowStyle>({
			_id: Random.hexString(5),
			name: Random.hexString(5),
			templateMappings: [],
			baselineTemplate: ''
		}))
	}

	onDeleteLineTemplate (item: RuntimeFunction) {
		this.setState({
			deleteConfirmItem: item,
			showDeleteLineTemplateConfirm: true
		})
	}

	onDeleteShowStyle (item: ShowStyle) {
		this.setState({
			deleteConfirmItem: item,
			showDeleteShowStyleConfirm: true
		})
	}

	handleConfirmDeleteLineTemplateAccept = (e) => {
		RuntimeFunctions.remove(this.state.deleteConfirmItem._id)
		this.setState({
			showDeleteLineTemplateConfirm: false
		})
	}

	handleConfirmDeleteLineTemplateCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteLineTemplateConfirm: false
		})
	}

	handleConfirmDeleteShowStyleAccept = (e) => {
		ShowStyles.remove(this.state.deleteConfirmItem._id)
		this.setState({
			showDeleteShowStyleConfirm: false
		})
	}

	handleConfirmDeleteShowStyleCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteShowStyleConfirm: false
		})
	}

	render () {
		const { t } = this.props

		return (
			<div className='tight-xs htight-xs text-s'>
				<h2 className='mhs'>{t('Studios')}</h2>
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
				<h2 className='mhs'>
					<button className='action-btn right' onClick={(e) => this.onAddShowStyle()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Show Styles')}
					</h2>
				<hr className='vsubtle man' />
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteShowStyleConfirm} onAccept={(e) => this.handleConfirmDeleteShowStyleAccept(e)} onSecondary={(e) => this.handleConfirmDeleteShowStyleCancel(e)}>
					<p>{t(`Are you sure you want to delete show style ${this.state.deleteConfirmItem && this.state.deleteConfirmItem.name}?`)}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				{
					this.props.showStyles.map((item) => {
						return (
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={item._id} to={'/settings/showStyle/' + item._id}>
								<div className='selectable clickable'>
									<button className='action-btn right' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onDeleteShowStyle(item)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
									<h3>{item.name}</h3>
								</div>
								<hr className='vsubtle man' />
							</NavLink>
						)
					})
				}
				<h2 className='mhs'>
					<button className='action-btn right' onClick={(e) => this.onAddLineTemplate()}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					{t('Line Templates')}
				</h2>
				<hr className='vsubtle man' />
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteLineTemplateConfirm} onAccept={(e) => this.handleConfirmDeleteLineTemplateAccept(e)} onSecondary={(e) => this.handleConfirmDeleteLineTemplateCancel(e)}>
					<p>{t(`Are you sure you want to delete line template ${this.state.deleteConfirmItem && this.state.deleteConfirmItem._id}?`)}</p>
					<p>{t('This action is irreversible.')}</p>
				</ModalDialog>
				{
					this.props.lineTemplates.map((item) => {
						return (
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={item._id} to={'/settings/lineTemplate/' + item._id}>
								<div className='selectable clickable'>
									<button className='action-btn right' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onDeleteLineTemplate(item)}>
										<FontAwesomeIcon icon={faTrash} />
									</button>
									<h3>{item._id}</h3>
								</div>
								<hr className='vsubtle man' />
							</NavLink>
						)
					})
				}
				<h2 className='mhs'>{t('Devices')}</h2>
				<hr className='vsubtle man' />
				{
					this.props.peripheralDevices.map((item) => {
						return [
							<NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={item._id} to={'/settings/peripheralDevice/' + item._id}>
								<h3>{item.name}</h3>
								<p>
									{item._id}
								</p>
								<p>
									{t('Status')}: {this.statusCodeString(item.status.statusCode)} {t('Type')}: {this.deviceTypeString(item.type)}
								</p>
							</NavLink>,
							<hr className='vsubtle man' key={item._id + '-hr'} />
						]
					})
				}
			</div>
		)
	}
}))

class Settings extends React.Component<InjectedTranslateProps> {
	render () {
		const { t } = this.props

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
								<Route path='/settings' exact component={WelcomeToSettings} />
								<Route path='/settings/studio/:studioId' component={StudioSettings} />
								<Route path='/settings/showStyle/:showStyleId' component={ShowStyleSettings} />
								<Route path='/settings/peripheralDevice/:deviceId' component={DeviceSettings} />
								<Route path='/settings/lineTemplate/:ltId' component={LineTemplates} />
								<Redirect to='/settings' />
							</Switch>
						</div>
					</div>
				</div>
			</div>
		)
	}
}

export default translate()(Settings)
