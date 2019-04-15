import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { RecordedFile, RecordedFiles } from '../../../lib/collections/RecordedFiles'
import { Link } from 'react-router-dom'
import { MomentFromNow } from '../../lib/Moment'
import Moment from 'react-moment'
import { EditAttribute } from '../../lib/EditAttribute'
import * as objectPath from 'object-path'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/fontawesome-free-solid'
import { ModalDialog } from '../../lib/ModalDialog'
import { doUserAction } from '../../lib/userAction'
import { UserActionAPI } from '../../../lib/api/userActions'

interface IRecordingListProps {
	match?: {
		params?: {
			studioId: string
		}
	}
}
interface IRecordingListState {
	filename: string

	showDeleteConfirm: boolean
	deleteConfirmItem?: RecordedFile
}
interface IRecordingListTrackedProps {
	studio?: Studio
	files: RecordedFile[]
}

const RecordingsList = translateWithTracker<IRecordingListProps, IRecordingListState, IRecordingListTrackedProps>((props: IRecordingListProps) => {
	return {
		studio: Studios.findOne(),
		files: RecordedFiles.find({}, { sort: { startedAt: -1 } }).fetch()
	}
})(class RecordedFilesList extends MeteorReactComponent<Translated<IRecordingListProps & IRecordingListTrackedProps>, IRecordingListState> {

	constructor (props: Translated<IRecordingListProps & IRecordingListTrackedProps>) {
		super(props)

		this.state = {
			filename: '',
			showDeleteConfirm: false
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

	componentWillMount () {
		if (this.props.match && this.props.match.params) {
			// Subscribe to data:
			this.subscribe('recordedFiles', {
				studioId: this.props.match.params.studioId
			})
			this.subscribe('studios', {
				_id: this.props.match.params.studioId
			})
		}
	}

	stopRecording (e) {
		if (this.props.match && this.props.match.params) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.recordStop, [this.props.match.params.studioId])

		}
	}
	startRecording (e) {
		if (this.props.match && this.props.match.params) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.recordStart, [this.props.match.params.studioId, this.state.filename], () => {
				this.setState({
					filename: ''
				})
			})
		}
	}

	handleConfirmDeleteCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteConfirm: false
		})
	}
	onDelete (item: RecordedFile) {
		this.setState({
			deleteConfirmItem: item,
			showDeleteConfirm: true
		})
	}
	handleConfirmDeleteAccept = (e) => {
		if (this.state.deleteConfirmItem) {
			const { t } = this.props
			doUserAction(t, e, UserActionAPI.methods.recordDelete, [this.state.deleteConfirmItem._id])
		}
		this.setState({
			showDeleteConfirm: false
		})
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
			return <p>{t('A required setting is not configured')}</p>
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
	renderRecordingList () {
		return this.props.files.map((file) => (
			<RecordedFilesListItem key={file._id} file={file} onDeleteRecording={i => this.onDelete(i)} />
		))
	}

	render () {
		const { t } = this.props

		// console.log('obj', obj)
		return (
			<div className='mtl gutter'>
				<header className='mvs'>
					<h1>{t('Recordings')}</h1>
				</header>
				<div className='mod mvl'>
					{this.renderControlPanel()}
				</div>
				<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteConfirm} onAccept={(e) => this.handleConfirmDeleteAccept(e)} onSecondary={(e) => this.handleConfirmDeleteCancel(e)}>
					<p>{t('Are you sure you want to delete recording "{{name}}"?', { name: this.state.deleteConfirmItem && this.state.deleteConfirmItem.name })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</ModalDialog>
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
							{this.renderRecordingList()}
						</tbody>
					</table>
				</div>
			</div>
		)
	}
})

interface IRecordedFilesListItemProps {
	key: string
	file: RecordedFile
	onDeleteRecording: (file: RecordedFile) => void
}

export class RecordedFilesListItem extends React.Component<IRecordedFilesListItemProps> {
	render () {
		return (
			<tr className='recorded-file-list-item'>
				<td className='recorded-file-list-item__name'>
					<Link to={`${this.props.file.studioId}/${this.props.file._id}`}>{this.props.file.name}</Link>
				</td>
				<td className='recorded-file-list-item__started'>
					<Moment format='YYYY/MM/DD HH:mm:ss'>{this.props.file.startedAt}</Moment>
				</td>
				<td className='recorded-file-list-item__stopped'>
					{this.props.file.stoppedAt && <Moment format='YYYY/MM/DD HH:mm:ss'>{this.props.file.stoppedAt}</Moment>}
				</td>
				<td className='actions'>
					<button className='action-btn' onClick={(e) => this.props.onDeleteRecording(this.props.file)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
		)
	}
}

interface IStudioSelectProps {
}
interface IStudioSelectState {
}
interface IStudioSelectTrackedProps {
	studios: Studio[]
}
const RecordingsStudioSelect = translateWithTracker<IStudioSelectProps, IStudioSelectState, IStudioSelectTrackedProps>((props: IStudioSelectProps) => {
	return {
		studios: Studios.find({}, {
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
