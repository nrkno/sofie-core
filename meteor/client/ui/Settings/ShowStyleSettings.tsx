import * as React from 'react'
import { ShowStyles, ShowStyle } from '../../../lib/collections/ShowStyles'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as _ from 'underscore'
import { Link } from 'react-router-dom'
import { ModalDialog } from '../../lib/ModalDialog'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import { ClientAPI } from '../../../lib/api/client'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { eventContextForLog } from '../../lib/eventTargetLogHelper'
import { Meteor } from 'meteor/meteor'
import { ShowBlueprint, ShowBlueprints } from '../../../lib/collections/ShowBlueprints'

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
	showStyle?: ShowStyle
	showBlueprint?: ShowBlueprint
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		showStyle: ShowStyles.findOne(props.match.params.showStyleId),
		showBlueprint: ShowBlueprints.findOne({ showStyleId: props.match.params.showStyleId})
	}
})( class ShowStyleSettings extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
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
		if (this.state.uploadFileContents && this.props.showStyle) {
			fetch('/blueprints/restore/' + this.props.showStyle._id, {
				method: 'POST',
				body: this.state.uploadFileContents,
				headers: {
					'content-type': 'text/javascript'
				},
			}).then(res => {
				console.log('Blueprint restore success')
			}).catch(err => {
				console.error('Blueprint restore failure: ', err)
			})
		}
		this.setState({
			showUploadConfirm: false
		})
	}


	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<label className='field'>
						{t('Blueprint Name')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='name'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Blueprint ID')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute='_id'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='input text-input input-l'></EditAttribute>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<p>{t('Version')}: {this.props.showBlueprint ? this.props.showBlueprint.version : t('Unknown')}</p>
					</div>
					<ModalDialog title={t('Update blueprints?')} acceptText={t('Update')} secondaryText={t('Cancel')} show={this.state.showUploadConfirm} onAccept={() => this.handleConfirmUploadFileAccept()} onSecondary={() => this.handleConfirmUploadFileCancel()}>
						<p>{t('Are you sure you want to update the bluerpints from the file "{{fileName}}"?', { fileName: this.state.uploadFileName })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</ModalDialog>
					<div className='mod mvs mhs'>
					<label className='field'>
						{t('Upload Blueprints')}
						<div className='mdi'>
							<input type='file' accept='.js' onChange={this.onUploadFile.bind(this)} key={this.state.uploadFileKey} />
							<span className='mdfx'></span>
						</div>
					</label>
					</div>
					<div className='mod mvs mhs'>
						<p>TODO: Manual edit (with warnings)</p>
					</div>
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.showStyle) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
})
