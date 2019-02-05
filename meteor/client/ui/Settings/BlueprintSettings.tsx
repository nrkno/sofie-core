import * as React from 'react'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import * as _ from 'underscore'
import { doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Blueprint, Blueprints } from '../../../lib/collections/Blueprints'
import Moment from 'react-moment';

interface IProps {
	match: {
		params: {
			blueprintId: string
		}
	}
}
interface IState {
	uploadFileKey: number // Used to force clear the input after use
}
interface ITrackedProps {
	blueprint?: Blueprint
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		blueprint: Blueprints.findOne(props.match.params.blueprintId)
	}
})( class BlueprintSettings extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			uploadFileKey: Date.now()
		}
	}

	onUploadFile (e) {
		const { t } = this.props

		const file = e.target.files[0]
		if (!file) {
			return
		}

		const reader = new FileReader()
		reader.onload = (e2) => {
			// On file upload

			this.setState({
				uploadFileKey: Date.now()
			})

			let uploadFileContents = (e2.target as any).result
			let blueprint = this.props.blueprint

			doModalDialog({
				title: t('Update blueprints?'),
				message: [
					<p>{t('Are you sure you want to update the bluerpints from the file "{{fileName}}"?', { fileName: file.name })}</p>,
					<p>{t('Please note: This action is irreversible!')}</p>
				],
				onAccept: () => {
					if (uploadFileContents && blueprint) {
						fetch('/blueprints/restore/' + blueprint._id, {
							method: 'POST',
							body: uploadFileContents,
							headers: {
								'content-type': 'text/javascript'
							},
						}).then(res => {
							console.log('Blueprint restore success')
						}).catch(err => {
							console.error('Blueprint restore failure: ', err)
						})
					}
				},
				onSecondary: () => {
					this.setState({
						uploadFileKey: Date.now()
					})
				}
			})
		}
		reader.readAsText(file)
	}

	renderEditForm (blueprint: Blueprint) {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<div className='mod mvs mhs'>
						{t('Blueprint ID')} <i>{blueprint._id}</i>
					</div>
					<label className='field'>
						{t('Blueprint Name')}
						<div className='mdi'>
							<EditAttribute
								modifiedClassName='bghl'
								attribute='name'
								obj={blueprint}
								type='text'
								collection={Blueprints}
								className='mdinput'></EditAttribute>
							<span className='mdfx'></span>
						</div>
					</label>
					<div className='mod mvs mhs'>
						<p>{t('Last modified')}: <Moment format='YYYY/MM/DD HH:mm:ss'>{blueprint.modified}</Moment></p>
					</div>
					{
						blueprint.blueprintVersion ?
						<div className='mod mvs mhs'>
							<p>{t('Blueprint Version')}: {blueprint.blueprintVersion}</p>
						</div> : null
					}

					<div className='mod mvs mhs'>
					<label className='field'>
						{t('Upload Blueprints')}
						<div className='mdi'>
							<input type='file' accept='.js' onChange={e => this.onUploadFile(e)} key={this.state.uploadFileKey} />
							<span className='mdfx'></span>
						</div>
					</label>
					</div>
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.blueprint) {
			return this.renderEditForm(this.props.blueprint)
		} else {
			return <Spinner />
		}
	}
})
