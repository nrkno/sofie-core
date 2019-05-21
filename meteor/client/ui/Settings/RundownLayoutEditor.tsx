import * as _ from 'underscore'
import * as React from 'react'
import * as ClassNames from 'classnames'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faDownload from '@fortawesome/fontawesome-free-solid/faDownload'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as faUpload from '@fortawesome/fontawesome-free-solid/faUpload'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { RundownLayouts, RundownLayout, RundownLayoutType, RundownLayoutBase, RundownLayoutFilter, PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { callMethod } from '../../lib/clientAPI'
import { PubSub } from '../../../lib/api/pubsub'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { UploadButton } from '../../lib/uploadButton'
import { doModalDialog } from '../../lib/ModalDialog'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'
// import { Link } from 'react-router-dom'

export interface IProps {
	showStyleBase: ShowStyleBase
}

interface IState {
	editedItems: string[]
	uploadFileKey: number
}

interface ITrackedProps {
	rundownLayouts: RundownLayoutBase[]
}

export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	const rundownLayouts = RundownLayouts.find({
		showStyleBaseId: props.showStyleBase._id,
		userId: { $exists: false }
	}).fetch()

	return {
		rundownLayouts
	}
})(class RundownLayoutEditor extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)

		this.state = {
			editedItems: [],
			uploadFileKey: Date.now()
		}
	}

	componentDidMount () {
		super.componentDidMount && super.componentDidMount()

		this.subscribe(PubSub.rundownLayouts, {
			showStyleBaseId: this.props.showStyleBase._id
		})
	}

	onAddLayout = (e: any) => {
		const { t, showStyleBase } = this.props
		callMethod(
			e,
			RundownLayoutsAPI.methods.createRundownLayout,
			t('New Layout'),
			RundownLayoutType.RUNDOWN_LAYOUT,
			showStyleBase._id
		)
	}

	onAddFilter = (item: RundownLayoutBase) => {
		const { t } = this.props
		RundownLayouts.update(item._id, {
			$push: {
				filters: literal<RundownLayoutFilter>({
					_id: Random.id(),
					name: t('New tab'),
					currentSegment: false,
					displayStyle: PieceDisplayStyle.LIST,
					label: undefined,
					sourceLayerIds: undefined,
					outputLayerIds: undefined,
					sourceLayerTypes: undefined,
					tags: undefined,
					rank: 0,
					rundownBaseline: false
				})
			}
		})
	}

	onRemoveFilter = (item: RundownLayoutBase, filter: RundownLayoutFilter) => {
		RundownLayouts.update(item._id, {
			$pull: {
				filters: {
					_id: filter._id
				}
			}
		})
	}

	isItemEdited = (item: RundownLayoutBase) => {
		return this.state.editedItems.indexOf(item._id) >= 0
	}

	editItem = (item: RundownLayoutBase) => {
		if (!this.isItemEdited(item)) {
			this.state.editedItems.push(item._id)

			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	downloadItem = (item: RundownLayoutBase) => {
		window.location.replace(`/rundownLayouts/${item._id}`)
	}

	finishEditItem = (item: RundownLayoutBase) => {
		if (this.isItemEdited(item)) {
			const idx = this.state.editedItems.indexOf(item._id)
			this.state.editedItems.splice(idx, 1)

			this.setState({
				editedItems: this.state.editedItems
			})
		}
	}

	onDeleteLayout = (e: any, item: RundownLayoutBase) => {
		callMethod(
			e,
			RundownLayoutsAPI.methods.removeRundownLayout,
			item._id
		)
	}

	renderRundownLayoutTabs (item: RundownLayout) {
		const { t } = this.props
		const rundownBaselineOptions = [
			{
				name: t('Yes'),
				value: true
			},
			{
				name: t('No'),
				value: false
			},
			{
				name: t('Only match Global Ad-Libs'),
				value: 'only'
			}
		]

		return <React.Fragment>
			<h4 className='mod mhs'>Tabs</h4>
			{item.filters.map((tab, index) => (
				<div className='rundown-layout-editor-filter mod pan mas' key={tab._id}>
					<button className='action-btn right mod man pas' onClick={(e) => this.onRemoveFilter(item, tab)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Name')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={`filters.${index}.name`}
								obj={item}
								options={RundownLayoutType}
								type='text'
								collection={RundownLayouts}
								className='input text-input input-l' />
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Display Rank')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={`filters.${index}.rank`}
								obj={item}
								options={RundownLayoutType}
								type='float'
								collection={RundownLayouts}
								className='input text-input input-l' />
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Display only Ad-Libs from current Segment')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={`filters.${index}.currentSegment`}
								obj={item}
								type='checkbox'
								collection={RundownLayouts}
								className='mod mas' />
						</label>
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Include Global Ad-Libs')}
						</label>
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.rundownBaseline`}
							obj={item}
							options={rundownBaselineOptions}
							type='dropdown'
							label={t('Filter disabled')}
							collection={RundownLayouts}
							className='input text-input input-l dropdown' />
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Source Layers')}
						</label>
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							type='checkbox'
							collection={RundownLayouts}
							className='mod mas'
							mutateDisplayValue={(v) => (v === undefined || v.length === 0) ? false : true }
							mutateUpdateValue={(v) => undefined } />
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							options={this.props.showStyleBase.sourceLayers.map(l => { return { name: l.name, value: l._id } })}
							type='multiselect'
							label={t('Filter disabled')}
							collection={RundownLayouts}
							className='input text-input input-l dropdown'
							mutateUpdateValue={v => v && v.length > 0 ? v : undefined} />
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Source Layer Types')}
						</label>
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.sourceLayerTypes`}
							obj={item}
							type='checkbox'
							collection={RundownLayouts}
							className='mod mas'
							mutateDisplayValue={(v) => (v === undefined || v.length === 0) ? false : true}
							mutateUpdateValue={(v) => undefined} />
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.sourceLayerTypes`}
							obj={item}
							options={_.map(SourceLayerType as any, (key, value) => { return { name: value, value: key } })}
							type='multiselect'
							label={t('Filter disabled')}
							collection={RundownLayouts}
							className='input text-input input-l dropdown'
							mutateUpdateValue={v => v && v.length > 0 ? v : undefined} />
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Output channels')}
						</label>
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.outputLayerIds`}
							obj={item}
							type='checkbox'
							collection={RundownLayouts}
							className='mod mas'
							mutateDisplayValue={(v) => (v === undefined || v.length === 0) ? false : true}
							mutateUpdateValue={(v) => undefined} />
						<EditAttribute
							modifiedClassName='bghl'
							attribute={`filters.${index}.outputLayerIds`}
							obj={item}
							options={this.props.showStyleBase.outputLayers.map(l => { return { name: l.name, value: l._id } })}
							type='multiselect'
							label={t('Filter disabled')}
							collection={RundownLayouts}
							className='input text-input input-l dropdown'
							mutateUpdateValue={v => v && v.length > 0 ? v : undefined} />
					</div>
					<div className='mod mvs mhs'>
						<label className='field'>
							{t('Label contains')}
							<EditAttribute
								modifiedClassName='bghl'
								attribute={`filters.${index}.label`}
								obj={item}
								type='checkbox'
								collection={RundownLayouts}
								className='mod mas'
								mutateDisplayValue={(v) => (v === undefined || v.length === 0) ? false : true}
								mutateUpdateValue={(v) => undefined} />
							<EditAttribute
								modifiedClassName='bghl'
								attribute={`filters.${index}.label`}
								obj={item}
								type='text'
								collection={RundownLayouts}
								className='input text-input input-l'
								label={t('Filter disabled')}
								mutateDisplayValue={(v) => (v === undefined || v.length === 0) ? undefined : v.join(', ')}
								mutateUpdateValue={(v) => (v === undefined || v.length === 0) ? undefined : v.split(',').map(i => i.trim())} />
						</label>
					</div>
				</div>
			))}
		</React.Fragment>
	}

	renderItems () {
		const { t } = this.props
		return (this.props.rundownLayouts || []).map((item, index) =>
			<React.Fragment key={item._id}>
				<tr className={ClassNames({
					'hl': this.isItemEdited(item)
				})}>
					<th className='settings-studio-rundown-layouts-table__name c3'>
						{item.name || t('Default layout')}
					</th>
					<td className='settings-studio-rundown-layouts-table__value c2'>
						{item.type}
					</td>
					<td className='settings-studio-rundown-layouts-table__actions table-item-actions c3'>
						<button className='action-btn' onClick={(e) => this.downloadItem(item)}>
							<FontAwesomeIcon icon={faDownload} />
						</button>
						<button className='action-btn' onClick={(e) => this.editItem(item)}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</button>
						<button className='action-btn' onClick={(e) => this.onDeleteLayout(e, item)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</td>
				</tr>
				{this.isItemEdited(item) &&
					<tr className='expando-details hl'>
						<td colSpan={4}>
							<div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Name')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'name'}
											obj={item}
											type='text'
											collection={RundownLayouts}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
								<div className='mod mvs mhs'>
									<label className='field'>
										{t('Type')}
										<EditAttribute
											modifiedClassName='bghl'
											attribute={'type'}
											obj={item}
											options={RundownLayoutType}
											type='dropdown'
											collection={RundownLayouts}
											className='input text-input input-l'></EditAttribute>
									</label>
								</div>
							</div>
							<div>
								{item.type === RundownLayoutType.RUNDOWN_LAYOUT ?
									this.renderRundownLayoutTabs(item as RundownLayout)
									: null}
							</div>
							<div className='mod mls'>
								<button className='btn btn-primary right' onClick={(e) => this.finishEditItem(item)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
								<button className='btn btn-secondary' onClick={(e) => this.onAddFilter(item)}>
									<FontAwesomeIcon icon={faPlus} />
								</button>
							</div>
						</td>
					</tr>
				}
			</React.Fragment>
		)
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

			doModalDialog({
				title: t('Update Blueprints?'),
				yes: t('Update'),
				no: t('Cancel'),
				message: <React.Fragment>
					<p>{t('Are you sure you want to upload the rundown layout from the file "{{fileName}}"?',
						{ fileName: file.name })}</p>,
				</React.Fragment>,
				onAccept: () => {
					if (uploadFileContents) {
						fetch('/rundownLayouts', {
							method: 'POST',
							body: uploadFileContents,
							headers: {
								'content-type': 'text/javascript'
							},
						}).then(res => {
							// console.log('Blueprint restore success')
							NotificationCenter.push(new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								t('Rundown layout uploaded successfully.'),
								'RundownLayouts'))
						}).catch(err => {
							// console.error('Blueprint restore failure: ', err)
							NotificationCenter.push(new Notification(
								undefined,
								NoticeLevel.WARNING,
								t('Failed to upload rundown layout: {{errorMessage}}', { errorMessage: err + '' }),
								'RundownLayouts'))
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

	render () {
		const { t } = this.props

		return (
			<div className='studio-edit rundown-layout-editor'>
				<h2 className='mhn'>{t('Rundown Layouts')}</h2>
				<table className='expando settings-studio-rundown-layouts-table'>
					<tbody>
						{this.renderItems()}
					</tbody>
				</table>
				<div className='mod mhs'>
					<button className='btn btn-primary' onClick={this.onAddLayout}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
					<UploadButton className='btn btn-secondary mls' onChange={(e) => console.log(e)} accept='application/json'>
						<FontAwesomeIcon icon={faUpload} />
					</UploadButton>
				</div>
			</div>
		)
	}
})
