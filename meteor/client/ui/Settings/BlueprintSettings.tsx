import * as React from 'react'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import * as _ from 'underscore'
import { doModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Blueprint, Blueprints } from '../../../lib/collections/Blueprints'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { Studio, Studios } from '../../../lib/collections/Studios'
import { ShowStyleBases, ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ICoreSystem, CoreSystem } from '../../../lib/collections/CoreSystem'
import { BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'
import { Meteor } from 'meteor/meteor'
import { BlueprintAPI } from '../../../lib/api/blueprint'

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
	assignedStudios: Studio[]
	assignedShowStyles: ShowStyleBase[]
	assignedSystem: ICoreSystem | undefined
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const id = props.match.params.blueprintId

	return {
		blueprint: Blueprints.findOne(id),
		assignedStudios: Studios.find({ blueprintId: id }).fetch(),
		assignedShowStyles: ShowStyleBases.find({ blueprintId: id }).fetch(),
		assignedSystem: CoreSystem.findOne({ blueprintId: id })
	}
})(class BlueprintSettings extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
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
				title: t('Update Blueprints?'),
				yes: t('Update'),
				no: t('Cancel'),
				message: <React.Fragment>
					<p>{t('Are you sure you want to update the blueprints from the file "{{fileName}}"?', { fileName: file.name })}</p>,
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>,
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

	assignSystemBlueprint (id: string | undefined) {
		Meteor.call(BlueprintAPI.methods.assignSystemBlueprint, id)
	}

	renderAssignment (blueprint: Blueprint) {
		const { t } = this.props

		switch (blueprint.blueprintType) {
			case BlueprintManifestType.SHOWSTYLE:
				return (
					<div>
						<p className='mod mhn mvs'>{t('Assigned Show Styles:')}</p>
						<p className='mod mhn mvs'>
							{this.props.assignedShowStyles.length > 0 ?
								this.props.assignedShowStyles.map(i => <span key={i._id} className='pill'><Link className='pill-link' to={`/settings/showStyleBase/${i._id}`}>{i.name}</Link></span>) :
								t('This Blueprint is not being used by any Show Style')}
						</p>
					</div>
				)
			case BlueprintManifestType.STUDIO:
				return (
					<div>
						<p className='mod mhn mvs'>{t('Assigned Studios:')}</p>
						<p className='mod mhn mvs'>
							{this.props.assignedStudios.length > 0 ?
								this.props.assignedStudios.map(i => <span key={i._id} className='pill'><Link className='pill-link' to={`/settings/studio/${i._id}`}>{i.name}</Link></span>) :
								t('This Blueprint is not compatible with any Studio')}
						</p>
					</div>
				)
			case BlueprintManifestType.SYSTEM:
				return (
					<div>
						<p>
							<button className='btn btn-primary' onClick={(e) => this.assignSystemBlueprint(this.props.assignedSystem ? undefined : blueprint._id)}>
								{ this.props.assignedSystem ? t('Unassign') : t('Assign') }
							</button>
						</p>
					</div>
				)
			default:
				return <div></div>
		}
	}

	renderEditForm (blueprint: Blueprint) {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvn'>
				<div>
					<div className='mod mvs mhn'>
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
					<div className='mod mvs mhn'>
						{t('Blueprint Type')} <i>{(blueprint.blueprintType || '').toUpperCase()}</i>
					</div>
					{ this.renderAssignment(blueprint) }
					<div className='mod mvs mhn'>
						<p className='mhn'>{t('Last modified')}: <Moment format='YYYY/MM/DD HH:mm:ss'>{blueprint.modified}</Moment></p>
					</div>
					{
						blueprint.blueprintVersion ?
						<div className='mod mvs mhn'>
							<p className='mhn'>{t('Blueprint Version')}: {blueprint.blueprintVersion}</p>
						</div> : null
					}

					<div className='mod mvs mhn'>
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

		if (this.props.blueprint) {
			return this.renderEditForm(this.props.blueprint)
		} else {
			return <Spinner />
		}
	}
})
