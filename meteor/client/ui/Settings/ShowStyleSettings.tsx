import * as React from 'react'
import { ShowStyles, ShowStyle } from '../../../lib/collections/ShowStyles'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { RuntimeFunctions, RuntimeFunction } from '../../../lib/collections/RuntimeFunctions'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as _ from 'underscore'
import { Link } from 'react-router-dom'
import { ModalDialog } from '../../lib/ModalDialog'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import { ClientAPI } from '../../../lib/api/client'
import { RuntimeFunctionsAPI } from '../../../lib/api/runtimeFunctions'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { eventContextForLog } from '../../lib/eventTargetLogHelper'
import { Meteor } from 'meteor/meteor'

interface IProps {
	match: {
		params: {
			showStyleId: string
		}
	}
}
interface IState {
	showDeleteLineTemplateConfirm: boolean
	deleteConfirmItem?: RuntimeFunction
}
interface ITrackedProps {
	showStyle?: ShowStyle
	lineTemplates: Array<RuntimeFunction>
}
export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
		showStyle: ShowStyles.findOne(props.match.params.showStyleId),
		lineTemplates: RuntimeFunctions.find({
			showStyleId: props.match.params.showStyleId,
			active: true
		}).fetch()
	}
})( class ShowStyleSettings extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			showDeleteLineTemplateConfirm: false,

		}
	}
	onAddLineTemplate (e: any) {
		Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), RuntimeFunctionsAPI.INSERT, this.props.match.params.showStyleId, (e) => {
			if (e) {
				console.log(e)
			} else {
				console.log('saved')
			}
		})
	}
	handleConfirmDeleteLineTemplateCancel = (e) => {
		this.setState({
			deleteConfirmItem: undefined,
			showDeleteLineTemplateConfirm: false
		})
	}
	onDeleteLineTemplate (item: RuntimeFunction) {
		this.setState({
			deleteConfirmItem: item,
			showDeleteLineTemplateConfirm: true
		})
	}
	handleConfirmDeleteLineTemplateAccept = (e) => {
		if (this.state.deleteConfirmItem) {
			Meteor.call(ClientAPI.methods.execMethod, eventContextForLog(e), RuntimeFunctionsAPI.REMOVE, this.state.deleteConfirmItem._id, true)
			// RuntimeFunctions.remove(this.state.deleteConfirmItem._id)
		}
		this.setState({
			showDeleteLineTemplateConfirm: false
		})
	}

	renderEditForm () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>
					<label className='field'>
						{t('Show Style Name')}
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
							{t('Show Style ID')}
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
						<label className='field'>
							{t('Baseline Blueprint ID')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute='baselineTemplate'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='input text-input input-l'></EditAttribute>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('External Message Blueprint ID')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute='messageTemplate'
								obj={this.props.showStyle}
								type='text'
								collection={ShowStyles}
								className='input text-input input-l'></EditAttribute>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							<a href={`/backup/show/${(this.props.showStyle as any)._id}`} target='_new'>{t('Download Full Backup')}</a>
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							<a href={`/backup/show/${(this.props.showStyle as any)._id}/active`} target='_new'>{t('Download Current State')}</a>
						</label>
					</div>
				</div>
				<div>
					<h2>{t('Blueprints\' logic')}</h2>
					<ModalDialog title={t('Delete this item?')} acceptText={t('Delete')} secondaryText={t('Cancel')} show={this.state.showDeleteLineTemplateConfirm} onAccept={(e) => this.handleConfirmDeleteLineTemplateAccept(e)} onSecondary={(e) => this.handleConfirmDeleteLineTemplateCancel(e)}>
						<p>{t('Are you sure you want to delete line blueprint logic "{{itemId}}"?', {itemId: this.state.deleteConfirmItem && this.state.deleteConfirmItem.templateId})}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</ModalDialog>
					<table className='expando settings-showStyle-lineTemplates'>
						<tbody>
							{this.props.lineTemplates.map((item) => {
								return (
									<tr key={item._id}>
										<td>
											<Link to={'/settings/lineTemplate/' + item._id} >{item.templateId}</Link>
										</td>
										<td>
											{item.isHelper ? t('Helper') : ''}
										</td>
										<td className='actions'>
											<button className='action-btn' onClick={(e) => this.onDeleteLineTemplate(item)}>
												<FontAwesomeIcon icon={faTrash} />
											</button>
										</td>
									</tr>
									// <NavLink activeClassName='selectable-selected' className='settings-menu__settings-menu-item selectable clickable' key={item._id} to={'/settings/lineTemplate/' + item._id}>
									// 	<div className='selectable clickable'>
									// 		<button className='action-btn right' onClick={(e) => e.preventDefault() || e.stopPropagation() || this.onDeleteLineTemplate(item)}>
									// 			<FontAwesomeIcon icon={faTrash} />
									// 		</button>
									// 		<h3>{item._id}</h3>
									// 	</div>
									// 	<hr className='vsubtle man' />
									// </NavLink>
								)
							})}
						</tbody>
					</table>
					<div className='mod mvm mhn'>
						<button className='btn btn-primary right' onClick={(e) => this.onAddLineTemplate(e)}>
							<FontAwesomeIcon icon={faPlus} />
						</button>
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
