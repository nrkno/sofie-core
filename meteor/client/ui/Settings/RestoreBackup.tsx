import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { ModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'

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
}
interface ITrackedProps {
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
	}
})( class RestoreBackup extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			uploadFileKey: Date.now(),
			showUploadConfirm: false,
		}
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
				console.log('Backup restore success')
			}).catch(err => {
				console.error('Backup restore failure: ', err)
			})
		}
		this.setState({
			showUploadConfirm: false
		})
	}

	render () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<label className='field'>
						{t('Restore Backup')}
						<div className='mdi'>
							<input type='file' accept='.json' onChange={this.onUploadFile.bind(this)} key={this.state.uploadFileKey} />
							<span className='mdfx'></span>
						</div>
					</label>
					<ModalDialog title={t('Restore this backup?')} acceptText={t('Restore')} secondaryText={t('Cancel')} show={this.state.showUploadConfirm} onAccept={() => this.handleConfirmUploadFileAccept()} onSecondary={() => this.handleConfirmUploadFileCancel()}>
						<p>{t('Are you sure you want to restore the backup file "{{fileName}}"?', { fileName: this.state.uploadFileName })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</ModalDialog>
				</div>
			</div>
		)
	}
})
