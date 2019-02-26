import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { ModalDialog, doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { SnapshotItem, Snapshots, SnapshotType } from '../../../lib/collections/Snapshots'
import { getCurrentTime } from '../../../lib/lib'
import * as _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { SnapshotFunctionsAPI } from '../../../lib/api/shapshot'
import { logger } from '../../../lib/logging'
import { EditAttribute } from '../../lib/EditAttribute'
import { faWindowClose } from '@fortawesome/fontawesome-free-solid'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'
import { multilineText } from '../../lib/lib'

interface IProps {
	match: {
		params: {
			showStyleId: string
		}
	}
}
interface IState {
	uploadFileKey: number // Used to force clear the input after use
	showUploadConfirm: boolean
	uploadFileName?: string
	uploadFileContents?: string
	editSnapshotId: string | null
	removeSnapshots: boolean
}
interface ITrackedProps {
	snapshots: Array<SnapshotItem>
	studios: Array<StudioInstallation>
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {

	return {
		snapshots: Snapshots.find({}, {
			sort: {
				created: -1
			}
		}).fetch(),
		studios: StudioInstallations.find({}, {}).fetch()
	}
})( class SnapshotsView extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			uploadFileKey: Date.now(),
			showUploadConfirm: false,
			editSnapshotId: null,
			removeSnapshots: false
		}
	}
	componentWillMount () {
		this.subscribe('snapshots', {
			created: {
				$gt: getCurrentTime() - 30 * 24 * 3600 * 1000 // last 30 days
			}
		})
		this.subscribe('studioInstallations', {})
	}

	onUploadFile (e) {
		const file = e.target.files[0]
		if (!file) {
			return
		}

		const reader = new FileReader()
		reader.onload = (e2) => {
			this.setState({
				uploadFileKey: Date.now(),
				showUploadConfirm: true,
				uploadFileName: file.name,
				uploadFileContents: (e2.target as any).result
			})
		}

		reader.readAsText(file)
	}
	handleConfirmUploadFileCancel = () => {
		this.setState({
			uploadFileKey: Date.now(),
			uploadFileName: undefined,
			uploadFileContents: undefined,
			showUploadConfirm: false
		})
	}
	handleConfirmUploadFileAccept = () => {
		if (this.state.uploadFileContents) {
			fetch('/backup/restore', {
				method: 'POST',
				body: this.state.uploadFileContents,
				headers: {
					'content-type': 'application/json'
				},
			}).then(res => {
				console.log('Snapshot restore success')
			}).catch(err => {
				console.error('Snapshot restore failure: ', err)
			})
		}
		this.setState({
			showUploadConfirm: false
		})
	}
	restoreStoredSnapshot = (snapshotId) => {
		let snapshot = Snapshots.findOne(snapshotId)
		if (snapshot) {
			doModalDialog({
				title: 'Restore Snapshot',
				message: `Do you really want to restore the Snapshot ${snapshot.name}?`,
				onAccept: () => {
					Meteor.call(SnapshotFunctionsAPI.RESTORE_SNAPSHOT, snapshotId, (err) => {
						if (err) {
							// todo: notify user
							logger.error(err)
							doModalDialog({
								title: 'Restore Snapshot',
								message: `Error: ${err.toString()}`,
								acceptOnly: true,
								onAccept: () => {
									// nothing
								}
							})
						} else {
							// todo: replace this with something else
							doModalDialog({
								title: 'Restore Snapshot',
								message: `Snapshot restored!`,
								acceptOnly: true,
								onAccept: () => {
									// nothing
								}
							})
						}
					})
				}
			})
		}
	}
	takeSystemSnapshot = (studioId: string | null) => {
		Meteor.call(SnapshotFunctionsAPI.STORE_SYSTEM_SNAPSHOT, studioId, `Requested by user`, (err) => {
			if (err) {
				// todo: notify user
				logger.error(err)
				doModalDialog({
					title: 'Restore Snapshot',
					message: `Error: ${err.toString()}`,
					acceptOnly: true,
					onAccept: () => {
						// nothing
					}
				})
			}
		})
	}
	takeDebugSnapshot = (studioId: string) => {
		Meteor.call(SnapshotFunctionsAPI.STORE_DEBUG_SNAPSHOT, studioId, `Requested by user`, (err) => {
			if (err) {
				// todo: notify user
				logger.error(err)
				doModalDialog({
					title: 'Restore Snapshot',
					message: `Error: ${err.toString()}`,
					acceptOnly: true,
					onAccept: () => {
						// nothing
					}
				})
			}
		})
	}
	editSnapshot = (snapshotId) => {
		if (this.state.editSnapshotId === snapshotId) {
			this.setState({
				editSnapshotId: null
			})
		} else {
			this.setState({
				editSnapshotId: snapshotId
			})
		}
	}
	toggleRemoveView = () => {
		this.setState({
			removeSnapshots: !this.state.removeSnapshots
		})
	}
	removeStoredSnapshot = (snapshotId: string) => {
		let snapshot = Snapshots.findOne(snapshotId)
		if (snapshot) {
			doModalDialog({
				title: 'Remove Snapshot',
				message: `Are you sure, do you really want to REMOVE the Snapshot ${snapshot.name}?\r\nThis cannot be undone!!`,
				onAccept: () => {
					Meteor.call(SnapshotFunctionsAPI.REMOVE_SNAPSHOT, snapshotId, (err) => {
						if (err) {
							// todo: notify user
							logger.error(err)
							doModalDialog({
								title: 'Remove Snapshot',
								message: `Error: ${err.toString()}`,
								acceptOnly: true,
								onAccept: () => {
									// nothing
								}
							})
						}
					})
				}
			})
		}
	}
	render () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<div>
						<h3 className='mhs'>{t('Take a Snapshot')}</h3>
						<div>
							<h4>{t('Full System Snapshot')}</h4>
							<i>
								{t('A Full System Snapshot contains all system settings (studios, showstyles, blueprints, devices, etc.)')}
							</i>
							<div>
								<button className='btn btn-primary' onClick={() => { this.takeSystemSnapshot(null) }}>{t('Take a Full System Snapshot')}</button>
							</div>
							{
								this.props.studios.length > 1 ?
								<div>
									<h4>{t('Studio Snapshot')}</h4>
									<i>
										{t('A Studio Snapshot contains all system settings related to that studio')}
									</i>
									{
										_.map(this.props.studios, (studio) => {
											return <div key={studio._id}>
												<button className='btn btn-primary' onClick={() => { this.takeSystemSnapshot(studio._id) }}>{t('Take a Snapshot for studio "{{studioName}}" only', {studioName: studio.name})}</button>
											</div>
										})
									}
								</div> : null
							}
						</div>
					</div>
					<h3 className='mhs'>{t('Restore from Snapshot File')}</h3>
					<label className='field'>
						<div className='mdi'>
							<input type='file' accept='.json' onChange={this.onUploadFile.bind(this)} key={this.state.uploadFileKey} />
							<span className='mdfx'></span>
						</div>
					</label>
					<ModalDialog title={t('Restore from this Snapshot file?')} acceptText={t('Restore')} secondaryText={t('Cancel')} show={this.state.showUploadConfirm} onAccept={() => this.handleConfirmUploadFileAccept()} onSecondary={() => this.handleConfirmUploadFileCancel()}>
						<p>{t('Are you sure you want to restore the system from the Snapshot file "{{fileName}}"?', { fileName: this.state.uploadFileName })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</ModalDialog>
					<h3 className='mhs'>{t('Restore from Stored Snapshots')}</h3>
					<div>
						<table className='table'>
							<tbody>
								<tr>
									<th></th>
									<th>Type</th>
									<th>Name</th>
									<th>Comment</th>
								</tr>
								{_.map(this.props.snapshots, (snapshot) => {
									return (
										<tr key={snapshot._id}>
											<td>
												<button className='btn mod mhm' onClick={() => { this.restoreStoredSnapshot(snapshot._id) }}>{t('Restore')}</button>
											</td>
											<td>
												{snapshot.type}
											</td>
											<td>
												<a href={`/snapshot/retrieve/${snapshot._id}`} target='_blank'>
													{snapshot.name}
												</a>
											</td>
											<td>
												{
													this.state.editSnapshotId === snapshot._id ?
														[
															<EditAttribute
																collection={Snapshots}
																obj={snapshot}
																attribute='comment'
																type='multiline'
															/>,
															<button className='action-btn' onClick={() => this.editSnapshot(snapshot._id)}>
																<FontAwesomeIcon icon={faWindowClose} />
															</button>
														]
													:
													<a href='#' onClick={(e) => { e.preventDefault(); this.editSnapshot(snapshot._id) }}>
														<i>{multilineText(snapshot.comment)}</i>
													</a>
												}
											</td>
											{
												this.state.removeSnapshots ?
												<td>
													<button className='btn btn-secondary' onClick={() => { this.removeStoredSnapshot(snapshot._id) }}>{t('Remove')}</button>
												</td> : null
											}
										</tr>
									)
								})}
							</tbody>
						</table>
						<div>
							<a href='#' onClick={(e) => { e.preventDefault(); this.toggleRemoveView() }}>{t('Show "Remove snapshots"-buttons')}</a>
						</div>
					</div>
				</div>
			</div>
		)
	}
})
