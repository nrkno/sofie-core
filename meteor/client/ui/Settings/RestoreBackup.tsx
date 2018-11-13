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
}
interface ITrackedProps {
	snapshots: Array<SnapshotItem>
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {

	return {
		snapshots: Snapshots.find({}, {
			sort: {
				created: -1
			}
		}).fetch()
	}
})( class RestoreBackup extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			uploadFileKey: Date.now(),
			showUploadConfirm: false,
			editSnapshotId: null
		}
	}
	componentWillMount () {
		this.subscribe('snapshots', {
			created: {
				$gt: getCurrentTime() - 30 * 24 * 3600 * 1000 // last 30 days
			}
		})
	}
	// componentWillUnmount () {
	// 	this._cleanUp()
	// }

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
				console.log('Backup restore success')
			}).catch(err => {
				console.error('Backup restore failure: ', err)
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
				message: `Do you really want to restore the snapshot ${snapshot.name}?`,
				onAccept: () => {
					Meteor.call(SnapshotFunctionsAPI.RESTORE_SNAPSHOT, snapshotId, (err) => {
						if (err) {
							// todo: notify user
							logger.error(err)
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
	takeSystemSnapshot = () => {
		Meteor.call(SnapshotFunctionsAPI.STORE_SYSTEM_SNAPSHOT, null, `Requested by user`, (err) => {
			if (err) {
				// todo: notify user
				logger.error(err)
			}
		})
	}
	takeDebugSnapshot = (studioId: string) => {
		Meteor.call(SnapshotFunctionsAPI.STORE_DEBUG_SNAPSHOT, studioId, `Requested by user`, (err) => {
			if (err) {
				// todo: notify user
				logger.error(err)
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
	render () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<div>
						<h3>{t('Take snapshot')}</h3>
							<div>
								<button className='btn btn-primary' onClick={() => { this.takeSystemSnapshot() }}>{t('Take system snapshot')}</button>
								<i>
									{t('A system snapshot contains all settings of the system (studio, showstyles, devices etc)')}
								</i>
							</div>
							{/* <div>
								<button className='btn btn-primary' onClick={() => { this.takeDebugSnapshot() }}>{t('Take debug snapshot')}</button>
								<i>
									{t('A debug snapshot contains info about the system and the active running order(s)')}
								</i>
							</div> */}
					</div>
					<h3>{t('Restore from File')}</h3>
					<label className='field'>
						<div className='mdi'>
							<input type='file' accept='.json' onChange={this.onUploadFile.bind(this)} key={this.state.uploadFileKey} />
							<span className='mdfx'></span>
						</div>
					</label>
					<ModalDialog title={t('Restore this backup?')} acceptText={t('Restore')} secondaryText={t('Cancel')} show={this.state.showUploadConfirm} onAccept={() => this.handleConfirmUploadFileAccept()} onSecondary={() => this.handleConfirmUploadFileCancel()}>
						<p>{t('Are you sure you want to restore the backup file "{{fileName}}"?', { fileName: this.state.uploadFileName })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</ModalDialog>
					<h3>{t('Restore from stored snapshots')}</h3>
					<div>
						<table className='table'>
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
												<i onClick={() => { this.editSnapshot(snapshot._id) }}>
													{snapshot.comment}
												</i>
											}
										</td>
									</tr>
								)
							})}
						</table>
					</div>
				</div>
			</div>
		)
	}
})
