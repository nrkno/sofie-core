import { faTrash, faStar } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import ClassNames from 'classnames'
import _ from 'underscore'
import { RundownLayoutsAPI } from '../../../../lib/api/rundownLayouts'
import {
	PieceDisplayStyle,
	RundownLayout,
	RundownLayoutAdLibRegion,
	RundownLayoutAdLibRegionRole,
	RundownLayoutBase,
	RundownLayoutElementBase,
	RundownLayoutElementType,
	RundownLayoutExternalFrame,
	RundownLayoutFilterBase,
	RundownLayoutPieceCountdown,
	RundownLayouts,
} from '../../../../lib/collections/RundownLayouts'
import { EditAttribute } from '../../../lib/EditAttribute'
import { MeteorReactComponent } from '../../../lib/MeteorReactComponent'
import { Translated, translateWithTracker } from '../../../lib/ReactMeteorData/react-meteor-data'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'

interface IProps {
	item: RundownLayoutBase
	filter: RundownLayoutElementBase
	index: number
	showStyleBase: ShowStyleBase
}

interface ITrackedProps {}

interface IState {}

export default translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {}
})(
	class FilterEditor extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
		onToggleDefault = (item: RundownLayout, index: number, value: boolean) => {
			const obj = _.object(item.filters.map((item, i) => [`filters.${i}.default`, i === index ? value : false]))
			RundownLayouts.update(item._id, {
				$set: obj,
			})
		}

		onRemoveElement = (item: RundownLayoutBase, filter: RundownLayoutElementBase) => {
			RundownLayouts.update(item._id, {
				$pull: {
					filters: {
						_id: filter._id,
					},
				},
			})
		}

		basicFields(item: RundownLayoutBase, tab: RundownLayoutElementBase, index: number) {
			const { t } = this.props
			return {
				checkbox: (prop: string, label: string, title?: string) => (
					<div className="mod mvs mhs" key={prop}>
						<label className="field" title={title}>
							{t(label)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.${prop}`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
				),
				text: (prop: string, label: string) => (
					<div className="mod mvs mhs" key={prop}>
						<label className="field">
							{t(label)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.${prop}`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
				),
				int: (prop: string, label: string) => (
					<div className="mod mvs mhs" key={prop}>
						<label className="field">
							{t(label)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.${prop}`}
								obj={item}
								type="int"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
				),
				float: (prop: string, label: string) => (
					<div className="mod mvs mhs" key={prop}>
						<label className="field">
							{t(label)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.${prop}`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
				),
				dropdown: (prop: string, label: string, options: any, dropdownLabel?: string) => (
					<div className="mod mvs mhs" key={prop}>
						<label className="field">
							{t(label)}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.${prop}`}
								obj={item}
								type="dropdown"
								collection={RundownLayouts}
								options={options}
								className="input text-input input-l dropdown"
							/>
						</label>
					</div>
				),
			}
		}

		renderFilter(
			item: RundownLayoutBase,
			tab: RundownLayoutFilterBase,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean,
			isMiniShelfLayout: boolean
		) {
			const { t } = this.props
			const isList = tab.displayStyle === PieceDisplayStyle.LIST

			const { checkbox, float, text, dropdown } = this.basicFields(item, tab, index)
			const rundownBaselineOptions = [
				{
					name: t('Yes'),
					value: true,
				},
				{
					name: t('No'),
					value: false,
				},
				{
					name: t('Only Match Global AdLibs'),
					value: 'only',
				},
			]

			return (
				<React.Fragment>
					{text('name', 'Name')}
					{isDashboardLayout && (
						<React.Fragment>
							{dropdown('displayStyle', 'Display Style', PieceDisplayStyle)}
							{isList && checkbox('showThumbnailsInList', 'Show thumbnails next to list items')}
							{!isMiniShelfLayout && [
								float('x', 'X'),
								float('y', 'Y'),
								float('width', 'Width'),
								float('height', 'Height'),
							]}
							{!isList && [
								float('buttonWidthScale', 'Button width scale factor'),
								float('buttonHeightScale', 'Button height scale factor'),
							]}
						</React.Fragment>
					)}
					{!isMiniShelfLayout && float('rank', 'Display Rank')}
					{checkbox('currentSegment', 'Only Display AdLibs from Current Segment')}
					{!isMiniShelfLayout && dropdown('rundownBaseline', 'Include Global AdLibs', rundownBaselineOptions)}
					{isDashboardLayout && checkbox('includeClearInRundownBaseline', 'Include Clear Source Layer in Ad-Libs')}
					<div className="mod mvs mhs">
						<label className="field">{t('Source Layers')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={(v) => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							options={this.props.showStyleBase.sourceLayers.map((l) => {
								return { name: l.name, value: l._id }
							})}
							type="multiselect"
							label={t('Filter Disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
							mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
						/>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Source Layer Types')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerTypes`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={(v) => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerTypes`}
							obj={item}
							options={SourceLayerType}
							type="multiselect"
							optionsAreNumbers={true}
							label={t('Filter disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
							mutateUpdateValue={(v: string[] | undefined) =>
								v && v.length > 0 ? v.map((a) => parseInt(a, 10)) : undefined
							}
						/>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Output Channels')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.outputLayerIds`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={(v) => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.outputLayerIds`}
							obj={item}
							options={this.props.showStyleBase.outputLayers.map((l) => {
								return { name: l.name, value: l._id }
							})}
							type="multiselect"
							label={t('Filter Disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
							mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
						/>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Label contains')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.label`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={(v) => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.label`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								label={t('Filter Disabled')}
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join(', '))}
								mutateUpdateValue={(v) =>
									v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
								}
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Tags must contain')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.tags`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={(v) => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.tags`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								label={t('Filter Disabled')}
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join(', '))}
								mutateUpdateValue={(v) =>
									v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
								}
							/>
						</label>
					</div>
					{!isMiniShelfLayout &&
						isDashboardLayout && [
							checkbox('assignHotKeys', 'Register Shortcuts for this Panel'),
							checkbox('hide', 'Hide Panel from view'),
							checkbox('showAsTimeline', 'Show panel as a timeline'),
						]}
					{!isMiniShelfLayout && checkbox('enableSearch', 'Enable search toolbar')}
					{!isMiniShelfLayout &&
						isDashboardLayout && [
							checkbox('includeClearInRundownBaseline', 'Include Clear Source Layer in Ad-Libs'),
							checkbox('overflowHorizontally', 'Overflow horizontally'),
							checkbox('displayTakeButtons', 'Display Take buttons'),
							checkbox('queueAllAdlibs', 'Queue all adlibs'),
							checkbox('toggleOnSingleClick', 'Toggle AdLibs on single mouse click'),
							checkbox('hideDuplicates', 'Hide duplicated AdLibs'),
							checkbox(
								'nextInCurrentPart',
								'Current part can contain next pieces',
								'eg. when pieces in current part serve as data stores for adlibing'
							),
							checkbox('oneNextPerSourceLayer', 'Indicate only one next piece per source layer'),
							<div className="mod mvs mhs" key="lineBreak">
								<label className="field">
									{t('Button label line break')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.lineBreak`}
										obj={item}
										type="text"
										collection={RundownLayouts}
										className="input text-input input-l"
										mutateDisplayValue={(v) => (!v ? '' : JSON.stringify(v).slice(1, -1))}
										mutateUpdateValue={(v) => (v === '' ? undefined : JSON.parse(`"${v}"`))}
									/>
								</label>
							</div>,
						]}
				</React.Fragment>
			)
		}

		renderFrame(
			item: RundownLayoutBase,
			tab: RundownLayoutExternalFrame,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { float, text } = this.basicFields(item, tab, index)
			return (
				<React.Fragment>
					{text('name', 'Name')}
					{text('url', 'URL')}
					{isDashboardLayout && [
						float('x', 'X'),
						float('y', 'Y'),
						float('width', 'Width'),
						float('height', 'Height'),
						float('rank', 'Display Rank'),
					]}
					{float('scale', 'Scale')}
				</React.Fragment>
			)
		}

		renderAdLibRegion(
			item: RundownLayoutBase,
			tab: RundownLayoutAdLibRegion,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			const { checkbox, float, int, text, dropdown } = this.basicFields(item, tab, index)
			return (
				<React.Fragment>
					{text('name', 'Name')}
					{dropdown('role', 'Role', RundownLayoutAdLibRegionRole)}
					{int('adlibRank', 'Adlib Rank')}
					<div className="mod mvs mhs">
						<label className="field">
							{t('Tags must contain')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.tags`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
								mutateUpdateValue={(v) => undefined}
							/>
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.tags`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								label={t('Filter Disabled')}
								mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join(', '))}
								mutateUpdateValue={(v) =>
									v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
								}
							/>
						</label>
					</div>
					{checkbox('labelBelowPanel', 'Place label below panel')}
					{isDashboardLayout && [
						float('x', 'X'),
						float('y', 'Y'),
						float('width', 'Width'),
						float('height', 'Height'),
						checkbox('assignHotKeys', 'Register Shortcuts for this Panel'),
					]}
				</React.Fragment>
			)
		}

		renderPieceCountdown(
			item: RundownLayoutBase,
			tab: RundownLayoutPieceCountdown,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			const { checkbox, float, int, text, dropdown } = this.basicFields(item, tab, index)
			return (
				<React.Fragment>
					{text('name', 'Name')}
					<div className="mod mvs mhs">
						<label className="field">{t('Source Layers')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={(v) => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.sourceLayerIds`}
							obj={item}
							options={this.props.showStyleBase.sourceLayers.map((l) => {
								return { name: l.name, value: l._id }
							})}
							type="multiselect"
							label={t('Disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
							mutateUpdateValue={(v) => (v && v.length > 0 ? v : undefined)}
						/>
					</div>
					{isDashboardLayout && [float('x', 'X'), float('y', 'Y'), float('width', 'Width'), float('scale', 'Scale')]}
				</React.Fragment>
			)
		}

		render() {
			const { t } = this.props

			const isRundownLayout = RundownLayoutsAPI.isRundownLayout(this.props.item)
			const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.item)
			const isMiniShelfLayout = RundownLayoutsAPI.isMiniShelfLayout(this.props.item)

			return (
				<div className="rundown-layout-editor-filter mod pan mas" key={this.props.filter._id}>
					<button
						className="action-btn right mod man pas"
						onClick={(e) => this.onRemoveElement(this.props.item, this.props.filter)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
					{isRundownLayout && (
						<button
							className={ClassNames('action-btn right mod man pas', {
								star: (this.props.filter as any).default,
							})}
							onClick={(e) =>
								this.onToggleDefault(
									this.props.item as RundownLayout,
									this.props.index,
									!(this.props.filter as any).default
								)
							}>
							<FontAwesomeIcon icon={faStar} />
						</button>
					)}
					<div>
						<div className="mod mvs mhs">
							<label className="field">
								{t('Type')}
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${this.props.index}.type`}
									obj={this.props.item}
									options={RundownLayoutElementType}
									type="dropdown"
									mutateDisplayValue={(v) => (v === undefined ? RundownLayoutElementType.FILTER : v)}
									collection={RundownLayouts}
									className="input text-input input-l"></EditAttribute>
							</label>
						</div>
					</div>
					{RundownLayoutsAPI.isFilter(this.props.filter)
						? this.renderFilter(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout,
								isMiniShelfLayout
						  )
						: RundownLayoutsAPI.isExternalFrame(this.props.filter)
						? this.renderFrame(this.props.item, this.props.filter, this.props.index, isRundownLayout, isDashboardLayout)
						: RundownLayoutsAPI.isAdLibRegion(this.props.filter)
						? this.renderAdLibRegion(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
						  )
						: RundownLayoutsAPI.isPieceCountdown(this.props.filter)
						? this.renderPieceCountdown(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
						  )
						: undefined}
				</div>
			)
		}
	}
)
