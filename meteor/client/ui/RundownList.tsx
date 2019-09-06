import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as _ from 'underscore'
import { Translated, translateWithTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Link } from 'react-router-dom'
const Tooltip = require('rc-tooltip')
import timer from 'react-timer-hoc'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import Moment from 'react-moment'
import { RundownUtils } from '../lib/rundown'
import { getCurrentTime } from '../../lib/lib'
import { MomentFromNow } from '../lib/Moment'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faSync from '@fortawesome/fontawesome-free-solid/faSync'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { ModalDialog, doModalDialog } from '../lib/ModalDialog'
import { SystemStatusAPI, StatusResponse } from '../../lib/api/systemStatus'
import { ManualPlayout } from './manualPlayout'
import { getDeveloperMode, getAdminMode } from '../lib/localStorage'
import { doUserAction } from '../lib/userAction'
import { UserActionAPI } from '../../lib/api/userActions'
import { getCoreSystem, ICoreSystem, GENESIS_SYSTEM_VERSION } from '../../lib/collections/CoreSystem'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications'
import { Studios } from '../../lib/collections/Studios'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { PubSub } from '../../lib/api/pubsub'

const PackageInfo = require('../../package.json')

interface IRundownListItemProps {
	key: string,
	rundown: RundownUI
}

interface IRundownListItemStats {
}

export class RundownListItem extends React.Component<Translated<IRundownListItemProps>, IRundownListItemStats> {
	constructor (props) {
		super(props)
	}

	getRundownLink (rundownId) {
		// double encoding so that "/" are handled correctly
		return '/rundown/' + encodeURIComponent(encodeURIComponent(rundownId))
	}
	getStudioLink (studioId) {
		// double encoding so that "/" are handled correctly
		return '/settings/studio/' + encodeURIComponent(encodeURIComponent(studioId))
	}
	getshowStyleBaseLink (showStyleBaseId) {
		// double encoding so that "/" are handled correctly
		return '/settings/showStyleBase/' + encodeURIComponent(encodeURIComponent(showStyleBaseId))
	}

	confirmDelete (rundown: Rundown) {
		const { t } = this.props

		doModalDialog({
			title: t('Delete this Item?'),
			yes: t('Delete'),
			no: t('Cancel'),
			onAccept: (e) => {
				doUserAction(t, e, UserActionAPI.methods.removeRundown, [rundown._id])
			},
			message: (
				t('Are you sure you want to delete the "{{name}}" rundown?', { name: rundown.name }) + '\n' +
				t('Please note: This action is irreversible!')
			)
		})
	}

	confirmReSyncRO (rundown: Rundown) {
		const { t } = this.props
		doModalDialog({
			title: t('Re-Sync this rundown?'),
			yes: t('Re-Sync'),
			no: t('Cancel'),
			onAccept: (e) => {
				doUserAction(t, e, UserActionAPI.methods.resyncRundown, [rundown._id])
			},
			message: (
				t('Are you sure you want to re-sync the "{{name}}" rundown with MOS script?', { name: rundown.name }) + '\n' +
				t('Please note: This action is irreversible!')
			)
		})
	}

	render () {
		const { t } = this.props
		return (
			<React.Fragment>
				<tr className='rundown-list-item'>
					<th className='rundown-list-item__name'>
						{this.props.rundown.active ?
							<div className='origo-pulse small right mrs'>
								<div className='pulse-marker'>
									<div className='pulse-rays'></div>
									<div className='pulse-rays delay'></div>
								</div>
							</div>
							: null
						}
						<Link to={this.getRundownLink(this.props.rundown._id)}>{this.props.rundown.name}</Link>
					</th>
					<td className='rundown-list-item__studio'>
						{
							getAdminMode() ?
							<Link to={this.getStudioLink(this.props.rundown.studioId)}>{this.props.rundown.studioName}</Link> :
							this.props.rundown.studioName
						}
					</td>
					<td className='rundown-list-item__showStyle'>
						{
							getAdminMode() ?
							<Link to={this.getshowStyleBaseLink(this.props.rundown.showStyleBaseId)}>{`${this.props.rundown.showStyleBaseName}-${this.props.rundown.showStyleVariantName}`}</Link> :
							`${this.props.rundown.showStyleBaseName}-${this.props.rundown.showStyleVariantName}`
						}
					</td>
					<td className='rundown-list-item__created'>
						<MomentFromNow>{this.props.rundown.created}</MomentFromNow>
					</td>
					<td className='rundown-list-item__airTime'>
						{this.props.rundown.expectedStart &&
							<Moment format='YYYY/MM/DD HH:mm:ss'>{this.props.rundown.expectedStart}</Moment>
						}
					</td>
					<td className='rundown-list-item__duration'>
						{this.props.rundown.expectedDuration &&
							RundownUtils.formatDiffToTimecode(this.props.rundown.expectedDuration, false, false, true, false, true)
						}
					</td>
					<td className='rundown-list-item__status'>
						{this.props.rundown.status}
					</td>
					<td className='rundown-list-item__air-status'>
						{this.props.rundown.airStatus}
					</td>
					<td className='rundown-list-item__actions'>
						{
							this.props.rundown.unsynced || getAdminMode() ?
							<Tooltip overlay={t('Delete')} placement='top'>
								<button className='action-btn' onClick={(e) => this.confirmDelete(this.props.rundown)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</Tooltip> : null
						}
						{
							this.props.rundown.unsynced ?
							<Tooltip overlay={t('Re-sync with MOS')} placement='top'>
								<button className='action-btn' onClick={(e) => this.confirmReSyncRO(this.props.rundown)}>
									<FontAwesomeIcon icon={faSync} />
								</button>
							</Tooltip> : null
						}
					</td>
				</tr>
				{this.props.rundown.startedPlayback && this.props.rundown.expectedDuration && this.props.rundown.active &&
					<tr className='hl expando-addon'>
						<td colSpan={8}>
							<ActiveProgressBar
								rundown={this.props.rundown}
							/>
						</td>
					</tr>
				}
			</React.Fragment>
		)
	}
}
interface RundownUI extends Rundown {
	studioName: string
	showStyleBaseName: string
	showStyleVariantName: string
}
interface IRundownsListProps {
	coreSystem: ICoreSystem
	rundowns: Array<RundownUI>
}

interface IRundownsListState {
	systemStatus?: StatusResponse
}

export const RundownList = translateWithTracker(() => {
	// console.log('PeripheralDevices',PeripheralDevices);
	// console.log('PeripheralDevices.find({}).fetch()',PeripheralDevices.find({}, { sort: { created: -1 } }).fetch());

	const studios = Studios.find().fetch()
	const showStyleBases = ShowStyleBases.find().fetch()
	const showStyleVariants = ShowStyleVariants.find().fetch()

	return {
		coreSystem: getCoreSystem(),
		rundowns: _.map(Rundowns.find({}, { sort: { created: -1 } }).fetch(), (rundown) => {
			const studio = _.find(studios, s => s._id === rundown.studioId)
			const showStyleBase = _.find(showStyleBases, s => s._id === rundown.showStyleBaseId)
			const showStyleVariant = _.find(showStyleVariants, s => s._id === rundown.showStyleVariantId)

			return {
				...rundown,
				studioName: studio && studio.name || 'N/A',
				showStyleBaseName: showStyleBase && showStyleBase.name || 'N/A',
				showStyleVariantName: showStyleVariant && showStyleVariant.name || 'N/A'
			}
		})
	}
})(
class extends MeteorReactComponent<Translated<IRundownsListProps>, IRundownsListState> {
	// private _subscriptions: Array<Meteor.SubscriptionHandle> = []

	constructor (props) {
		super(props)

		this.state = {}
	}

	componentDidMount () {
		const { t } = this.props
		Meteor.call(SystemStatusAPI.getSystemStatus, (err: any, systemStatus: StatusResponse) => {
			if (err) {
				// console.error(err)
				NotificationCenter.push(new Notification('systemStatus_failed', NoticeLevel.CRITICAL, t('Could not get system status. Please consult system administrator.'), 'RundownList'))
				return
			}

			this.setState({
				systemStatus: systemStatus
			})
		})
	}

	renderRundowns (list: RundownUI[]) {
		return list.map((rundown) => (
			<RundownListItem key={rundown._id} rundown={rundown} t={this.props.t} />
		))
	}

	componentWillMount () {
		// Subscribe to data:
		// TODO: make something clever here, to not load ALL the rundowns
		this.subscribe(PubSub.rundowns, {})
		this.subscribe(PubSub.studios, {})

		this.autorun(() => {
			const showStyleBaseIds = _.uniq(_.map(Rundowns.find().fetch(), rundown => rundown.showStyleBaseId))
			const showStyleVariantIds = _.uniq(_.map(Rundowns.find().fetch(), rundown => rundown.showStyleVariantId))

			this.subscribe(PubSub.showStyleBases, {
				_id: { $in: showStyleBaseIds }
			})
			this.subscribe(PubSub.showStyleVariants, {
				_id: { $in: showStyleVariantIds }
			})
		})
	}

	render () {
		const { t } = this.props

		const synced = this.props.rundowns.filter(i => !i.unsynced)
		const unsynced = this.props.rundowns.filter(i => i.unsynced)

		return <React.Fragment>
			{
				(
					this.props.coreSystem &&
					this.props.coreSystem.version === GENESIS_SYSTEM_VERSION &&
					synced.length === 0 &&
					unsynced.length === 0
				) ?
				<div className='mtl gutter has-statusbar'>
					<h1>{t('Getting Started')}</h1>
					<div>
						<ul>
							<li>
								{t('Start with giving this browser configuration permissions by adding this to the URL: ')}&nbsp;
								<a href='?configure=1'>
									?configure=1
								</a>
							</li>
							<li>
								{t('Then, run the migrations script:')}&nbsp;
								<a href='/settings/tools/migration'>
									{t('Migrations')}
								</a>
							</li>
						</ul>
						{t('Documentation is available at')}&nbsp;
						<a href='https://github.com/nrkno/Sofie-TV-automation/'>
							https://github.com/nrkno/Sofie-TV-automation/
						</a>
					</div>
				</div> : null
			}
			<div className='mtl gutter has-statusbar'>
				<header className='mvs'>
					<h1>{t('Rundowns')}</h1>
				</header>
				<div className='mod mvl'>
					<table className='table system-status-table expando expando-tight'>
						<thead>
							<tr className='hl'>
								<th className='c3'>
									{t('Rundown')}
								</th>
								<th className='c2'>
									{t('Studio')}
								</th>
								<th className='c2'>
									{t('Show style')}
								</th>
								<th className='c2'>
									{t('Created')}
								</th>
								<th className='c2'>
									{t('On Air Start Time')}
								</th>
								<th className='c1'>
									{t('Duration')}
								</th>
								<th className='c1'>
									{t('Status')}
								</th>
								<th className='c1'>
									{t('Air Status')}
								</th>
								<th className='c1'>
									&nbsp;
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderRundowns(synced)}
						</tbody>
						{unsynced.length > 0 && <tbody>
							<tr className='hl'>
								<th colSpan={8} className='pvn phn'>
									<h2 className='mtm mbs mhn'>{t('Unsynced from MOS')}</h2>
								</th>
							</tr>
						</tbody>}
						<tbody>
							{this.renderRundowns(unsynced)}
						</tbody>
					</table>
				</div>
			</div>
			<div className='mtl gutter version-info'>
				<p>
					{t('Sofie Automation')} {t('version')}: {PackageInfo.version || 'UNSTABLE'}
				</p>
				<div>
					{
						this.state.systemStatus ?
							<React.Fragment>
								<div>
									{t('status')}: {this.state.systemStatus.status} / {this.state.systemStatus._internal.statusCodeString}
								</div>
								<div>
									{
										this.state.systemStatus._internal.messages.length ?
											<div>
												{t('Status Messages:')}
												<ul>
													{_.map(this.state.systemStatus._internal.messages, (message, i) => {
														return (
															<li key={i}>
																{message}
															</li>
														)
													})}
												</ul>
											</div> :
										null
									}
								</div>
							</React.Fragment>
							: null
					}
				</div>
				{
					getDeveloperMode() ?
					<ManualPlayout></ManualPlayout> : null
				}
			</div>
		</React.Fragment>
	}
}
)

interface IActiveProgressBarProps {
	rundown: Rundown
}

const ActiveProgressBar = timer(1000)(class extends React.Component<IActiveProgressBarProps> {
	render () {
		return (this.props.rundown.startedPlayback && this.props.rundown.expectedDuration ?
			<div className='progress-bar'>
				<div className='pb-indicator' style={{
					'width': Math.min(((getCurrentTime() - this.props.rundown.startedPlayback) / this.props.rundown.expectedDuration) * 100, 100) + '%'
				}} />
			</div> : null
		)
	}
})
