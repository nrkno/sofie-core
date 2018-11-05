import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { RecordedFile, RecordedFiles } from '../../../lib/collections/RecordedFiles'
import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../lib/Moment'
import { eventContextForLog } from '../../lib/eventTargetLogHelper'
import { TestToolsAPI } from '../../../lib/api/testTools'
import { ClientAPI } from '../../../lib/api/client'
import { EditAttribute } from '../../lib/EditAttribute'
import * as objectPath from 'object-path'

interface IRecordingListProps {
	match?: {
		params?: {
			studioId: string
		}
	}
}
interface IRecordingListState {
	filename: string
}
interface IRecordingListTrackedProps {
	studio?: StudioInstallation
	files: RecordedFile[]
}

const RecordingsList = translateWithTracker<IRecordingListProps, IRecordingListState, IRecordingListTrackedProps>((props: IRecordingListProps) => {
	return {
		studio: StudioInstallations.findOne(),
		files: RecordedFiles.find({}, { sort: { startedAt: -1 } }).fetch()
	}
})(class RecordedFilesList extends MeteorReactComponent<Translated<IRecordingListProps & IRecordingListTrackedProps>, IRecordingListState> {

	constructor (props: Translated<IRecordingListProps & IRecordingListTrackedProps>) {
		super(props)

		this.state = {
			filename: ''
		}
	}

	onUpdateValue = (edit: any, newValue: any) => {
		console.log('edit', edit, newValue)
		let attr = edit.props.attribute

		if (attr) {
			let m = {}
			m[attr] = newValue
			this.setState(m)
		}
	}

	renderRunningOrders () {
		return this.props.files.map((file) => (
			<RecordedFilesListItem key={file._id} file={file} />
		))
	}
	componentWillMount () {
		if (this.props.match && this.props.match.params) {
			// Subscribe to data:
			this.subscribe('recordedFiles', {
				studioId: this.props.match.params.studioId
			})
			this.subscribe('studioInstallations', {
				_id: this.props.match.params.studioId
			})
		}
	}

	stopRecording (e) {
		if (this.props.match && this.props.match.params) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), TestToolsAPI.methods.recordStop, this.props.match.params.studioId, (err, res) => {
				if (err || (res && res.error)) {
					console.error(err || res)
					// this.handleActivationError(err || res)
					return
				}
			})
		}
	}
	startRecording (e) {
		if (this.props.match && this.props.match.params) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), TestToolsAPI.methods.recordStart, this.props.match.params.studioId, this.state.filename, (err, res) => {
				if (err || (res && res.error)) {
					console.error(err || res)
					// this.handleActivationError(err || res)
					return
				}
			})
			this.setState({
				filename: ''
			})
		}
	}

	isStudioConfigured () {
		const { studio } = this.props
		if (!studio) return false

		const config = objectPath.get(studio, 'testToolsConfig.recordings')
		if (!config) return false

		if (!config.channelIndex || !config.decklinkDevice || !config.deviceId) return false

		return true
	}

	renderControlPanel () {
		const { t } = this.props

		if (!this.isStudioConfigured()) {
			return <React.Fragment>
				<p>{t('A required setting is not configured')}</p>
			</React.Fragment>
		}

		const active = this.props.files.find(f => !f.stoppedAt)

		let obj = this.state
		return <React.Fragment>
			<p>Status: {active ? t('Active') : t('Ready')}</p>
			<p>Name: {active ? active.name : <EditAttribute
				obj={obj}
				updateFunction={this.onUpdateValue}
				attribute='filename'
				type='text'
			/>}</p>
			<p>Started: {active ? <MomentFromNow>{active.startedAt}</MomentFromNow> : '-'}</p>
			<p>
				{
					active
						? <button onClick={e => this.stopRecording(e)}>{t('Stop')}</button>
						: <button onClick={e => this.startRecording(e)}>{t('Start')}</button>
				}
			</p>
		</React.Fragment>
	}

	render () {
		const { t } = this.props

		// console.log('obj', obj)
		return <React.Fragment>
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('Recordings')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderControlPanel()}
				</div>
				<div className='mod mvl'>
					<table className='table system-status-table expando expando-tight'>
						<thead>
							<tr className='hl'>
								<th className='c3'>
									{t('Name')}
								</th>
								<th className='c2'>
									{t('Started')}
								</th>
								<th className='c2'>
									{t('Stopped')}
								</th>
								<th className='c1'>
								</th>
							</tr>
						</thead>
						<tbody>
							{this.renderRunningOrders()}
						</tbody>
					</table>
				</div>
			</div>
		</React.Fragment>
	}
})

interface IRecordedFilesListItemProps {
	key: string,
	file: RecordedFile
}

export class RecordedFilesListItem extends React.Component<IRecordedFilesListItemProps> {
	render () {
		return (
			<React.Fragment>
				<tr className='recorded-file-list-item'>
					<td className='recorded-file-list-item__name'>
						<Link to={`${this.props.file.studioId}/${this.props.file._id}`}>{this.props.file.name}</Link>
					</td>
					<td className='recorded-file-list-item__started'>
						<MomentFromNow>{this.props.file.startedAt}</MomentFromNow>
					</td>
					<td className='recorded-file-list-item__stopped'>
						{this.props.file.stoppedAt && <MomentFromNow>{this.props.file.stoppedAt}</MomentFromNow>}
					</td>
				</tr>
			</React.Fragment>
		)
	}
}

interface IStudioSelectProps {
}
interface IStudioSelectState {
}
interface IStudioSelectTrackedProps {
	studios: StudioInstallation[]
}
const RecordingsStudioSelect = translateWithTracker<IStudioSelectProps, IStudioSelectState, IStudioSelectTrackedProps>((props: IStudioSelectProps) => {
	return {
		studios: StudioInstallations.find({}, {
			sort: {
				_id: 1
			}
		}).fetch()
	}
})(class StudioSelection extends MeteorReactComponent<Translated<IStudioSelectProps & IStudioSelectTrackedProps>, IStudioSelectState> {
	render () {
		const { t } = this.props

		return (
			<div className='mhl gutter recordings-studio-select'>
				<header className='mbs'>
					<h1>{t('Recordings')}</h1>
				</header>
				<div className='mod mvl'>
					<strong>Studio</strong>
					<ul>

						{
							_.map(this.props.studios, (studio) => {
								return (
									<li key={studio._id}>
										<Link to={`recordings/${studio._id}`}>{studio.name}</Link>
									</li>
								)
							})
						}
					</ul>
				</div>
			</div>
		)
	}
})

export { RecordingsList, RecordingsStudioSelect }
