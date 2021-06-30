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
	RundownLayoutEndWords,
	RundownLayoutExternalFrame,
	RundownLayoutFilterBase,
	RundownLayoutPartTiming,
	RundownLayoutPieceCountdown,
	RundownLayoutPlaylistEndTimer,
	RundownLayoutPlaylistStartTimer,
	RundownLayouts,
	RundownLayoutSegmentTiming,
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
	supportedElements: RundownLayoutElementType[]
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

		renderFilter(
			item: RundownLayoutBase,
			tab: RundownLayoutFilterBase,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			const isList = tab.displayStyle === PieceDisplayStyle.LIST
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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.name`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Display Style')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.displayStyle`}
										obj={item}
										type="dropdown"
										collection={RundownLayouts}
										options={PieceDisplayStyle}
										className="input text-input input-l"
									/>
								</label>
							</div>
							{isList && (
								<div className="mod mvs mhs">
									<label className="field">
										{t('Show thumbnails next to list items')}
										<EditAttribute
											modifiedClassName="bghl"
											attribute={`filters.${index}.showThumbnailsInList`}
											obj={item}
											type="checkbox"
											collection={RundownLayouts}
											className="mod mas"
										/>
									</label>
								</div>
							)}
							<div className="mod mvs mhs">
								<label className="field">
									{t('X')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.x`}
										obj={item}
										type="int"
										collection={RundownLayouts}
										className="input text-input input-l"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Y')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.y`}
										obj={item}
										type="int"
										collection={RundownLayouts}
										className="input text-input input-l"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Width')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.width`}
										obj={item}
										type="int"
										collection={RundownLayouts}
										className="input text-input input-l"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Height')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.height`}
										obj={item}
										type="int"
										collection={RundownLayouts}
										className="input text-input input-l"
									/>
								</label>
							</div>
							{!isList && (
								<React.Fragment>
									<div className="mod mvs mhs">
										<label className="field">
											{t('Button width scale factor')}
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`filters.${index}.buttonWidthScale`}
												obj={item}
												type="float"
												collection={RundownLayouts}
												className="input text-input input-l"
											/>
										</label>
									</div>
									<div className="mod mvs mhs">
										<label className="field">
											{t('Button height scale factor')}
											<EditAttribute
												modifiedClassName="bghl"
												attribute={`filters.${index}.buttonHeightScale`}
												obj={item}
												type="float"
												collection={RundownLayouts}
												className="input text-input input-l"
											/>
										</label>
									</div>
								</React.Fragment>
							)}
						</React.Fragment>
					)}
					<div className="mod mvs mhs">
						<label className="field">
							{t('Display Rank')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.rank`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Only Display AdLibs from Current Segment')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.currentSegment`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Include Global AdLibs')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.rundownBaseline`}
							obj={item}
							options={rundownBaselineOptions}
							type="dropdown"
							label={t('Filter Disabled')}
							collection={RundownLayouts}
							className="input text-input input-l dropdown"
						/>
					</div>
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Include Clear Source Layer in Ad-Libs')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.includeClearInRundownBaseline`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
						</React.Fragment>
					)}
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
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Register Shortcuts for this Panel')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.assignHotKeys`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Hide Panel from view')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.hide`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
						</React.Fragment>
					)}
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Show panel as a timeline')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.showAsTimeline`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
						</React.Fragment>
					)}
					<div className="mod mvs mhs">
						<label className="field">
							{t('Enable search toolbar')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.enableSearch`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Include Clear Source Layer in Ad-Libs')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.includeClearInRundownBaseline`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
						</React.Fragment>
					)}
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Overflow horizontally')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.overflowHorizontally`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Display Take buttons')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.displayTakeButtons`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Queue all adlibs')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.queueAllAdlibs`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Toggle AdLibs on single mouse click')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.toggleOnSingleClick`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field" title="eg. when pieces in current part serve as data stores for adlibing">
									{t('Current part can contain next pieces')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.nextInCurrentPart`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Indicate only one next piece per source layer')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.oneNextPerSourceLayer`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Hide duplicated AdLibs')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.hideDuplicates`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
									<span className="text-s dimmed">
										{t('Picks the first instance of an adLib per rundown, identified by uniqueness Id')}
									</span>
								</label>
							</div>
						</React.Fragment>
					)}
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
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.name`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('URL')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.url`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Display Rank')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.rank`}
										obj={item}
										type="float"
										collection={RundownLayouts}
										className="input text-input input-l"
									/>
								</label>
							</div>
						</React.Fragment>
					)}
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
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.name`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Role')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.role`}
								obj={item}
								type="dropdown"
								collection={RundownLayouts}
								options={RundownLayoutAdLibRegionRole}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Adlib Rank')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.adlibRank`}
								obj={item}
								type="int"
								collection={RundownLayouts}
								className="input text-input input-l"
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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Place label below panel')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.labelBelowPanel`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index)}
					{isDashboardLayout && (
						<React.Fragment>
							<div className="mod mvs mhs">
								<label className="field">
									{t('Register Shortcuts for this Panel')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.assignHotKeys`}
										obj={item}
										type="checkbox"
										collection={RundownLayouts}
										className="mod mas"
									/>
								</label>
							</div>
						</React.Fragment>
					)}
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
			return (
				<React.Fragment>
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderPlaylistStartTimer(
			item: RundownLayoutBase,
			tab: RundownLayoutPlaylistStartTimer,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.name`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Diff')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideDiff`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Expected Start')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideExpectedStart`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderPlaylistEndTimer(
			item: RundownLayoutBase,
			tab: RundownLayoutPlaylistEndTimer,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.name`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<label className="field">
						{t('Expected End text')}
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.expectedEndText`}
							obj={this.props.item}
							type="text"
							collection={RundownLayouts}
							className="input text-input input-l"
						></EditAttribute>
						<span className="text-s dimmed">{t('Text to show above countdown to end of show')}</span>
					</label>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Diff')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideDiff`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Countdown')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideCountdown`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide End Time')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hidePlannedEnd`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderEndWords(
			item: RundownLayoutBase,
			tab: RundownLayoutEndWords,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.name`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Script Source Layers')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.scriptSourceLayerIds`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={(v) => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.scriptSourceLayerIds`}
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
						<span className="text-s dimmed">{t('Source layers containing script')}</span>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Required Source Layers')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.requiredLayers`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={(v) => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.requiredLayers`}
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
						<span className="text-s dimmed">
							{t('Specify layers where at least one layer must have an active piece for end words to be shown')}
						</span>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Require All Sourcelayers')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.requireAllSourcelayers`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
							<span className="text-s dimmed">
								{t('All required source layers must have active pieces to show end words')}
							</span>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderDashboardLayoutSettings(item: RundownLayoutBase, index: number, scalable?: boolean) {
			let { t } = this.props

			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('X')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.x`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Y')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.y`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Width')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.width`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Height')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.height`}
								obj={item}
								type="float"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					{scalable && (
						<div className="mod mvs mhs">
							<label className="field">
								{t('Scale')}
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.scale`}
									obj={item}
									type="float"
									collection={RundownLayouts}
									className="input text-input input-l"
								/>
							</label>
						</div>
					)}
				</React.Fragment>
			)
		}

		renderSegmentCountDown(
			item: RundownLayoutBase,
			tab: RundownLayoutSegmentTiming,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			let { t } = this.props

			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Type')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${this.props.index}.timingType`}
								obj={this.props.item}
								options={['count_down', 'count_up']}
								type="dropdown"
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderPartCountDown(
			item: RundownLayoutBase,
			tab: RundownLayoutPartTiming,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			let { t } = this.props

			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Type')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${this.props.index}.timingType`}
								obj={this.props.item}
								options={['count_down', 'count_up']}
								type="dropdown"
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		render() {
			const { t } = this.props

			const isRundownLayout = RundownLayoutsAPI.isRundownLayout(this.props.item)
			const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.item)

			return (
				<div className="rundown-layout-editor-filter mod pan mas" key={this.props.filter._id}>
					<button
						className="action-btn right mod man pas"
						onClick={(e) => this.onRemoveElement(this.props.item, this.props.filter)}
					>
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
							}
						>
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
									options={this.props.supportedElements}
									type="dropdown"
									mutateDisplayValue={(v) => (v === undefined ? this.props.supportedElements[0] : v)}
									collection={RundownLayouts}
									className="input text-input input-l"
								></EditAttribute>
							</label>
						</div>
					</div>
					{RundownLayoutsAPI.isFilter(this.props.filter)
						? this.renderFilter(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
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
						: RundownLayoutsAPI.isPlaylistStartTimer(this.props.filter)
						? this.renderPlaylistStartTimer(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
						  )
						: RundownLayoutsAPI.isPlaylistEndTimer(this.props.filter)
						? this.renderPlaylistEndTimer(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
						  )
						: RundownLayoutsAPI.isEndWords(this.props.filter)
						? this.renderEndWords(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
						  )
						: RundownLayoutsAPI.isSegmentTiming(this.props.filter)
						? this.renderSegmentCountDown(
								this.props.item,
								this.props.filter,
								this.props.index,
								isRundownLayout,
								isDashboardLayout
						  )
						: RundownLayoutsAPI.isPartTiming(this.props.filter)
						? this.renderPartCountDown(
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
