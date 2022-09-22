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
	RundownLayoutColoredBox,
	RundownLayoutElementBase,
	RundownLayoutElementType,
	RundownLayoutEndWords,
	RundownLayoutExternalFrame,
	RundownLayoutFilterBase,
	RundownLayoutNextInfo,
	RundownLayoutPartName,
	RundownLayoutPartTiming,
	RundownLayoutPieceCountdown,
	RundownLayoutPlaylistEndTimer,
	RundownLayoutPlaylistName,
	RundownLayoutPlaylistStartTimer,
	RundownLayoutNextBreakTiming,
	RundownLayouts,
	RundownLayoutSegmentName,
	RundownLayoutSegmentTiming,
	RundownLayoutShowStyleDisplay,
	RundownLayoutStudioName,
	RundownLayoutSytemStatus,
	RundownLayoutTextLabel,
	RundownLayoutTimeOfDay,
	RundownLayoutMiniRundown,
	RundownLayoutKeyboardPreview,
} from '../../../../lib/collections/RundownLayouts'
import { EditAttribute } from '../../../lib/EditAttribute'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data'
import { ShowStyleBase } from '../../../../lib/collections/ShowStyleBases'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { withTranslation } from 'react-i18next'
import { defaultColorPickerPalette } from '../../../lib/colorPicker'

interface IProps {
	item: RundownLayoutBase
	filter: RundownLayoutElementBase
	index: number
	showStyleBase: ShowStyleBase
	supportedFilters: RundownLayoutElementType[]
}

export default withTranslation()(
	class FilterEditor extends React.Component<Translated<IProps>> {
		onToggleDefault = (item: RundownLayout, index: number, value: boolean) => {
			const obj = _.object(item.filters.map((_item, i) => [`filters.${i}.default`, i === index ? value : false]))
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

		renderRundownLayoutFilter(
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
							{this.renderDashboardLayoutSettings(item, index)}
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
							mutateUpdateValue={() => undefined}
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
							mutateUpdateValue={() => undefined}
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
							mutateUpdateValue={() => undefined}
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
								mutateUpdateValue={() => undefined}
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
								mutateUpdateValue={() => undefined}
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
								<label className="field">
									{t('Disable the hover Inspector when hovering over the button')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.disableHoverInspector`}
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
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
								mutateUpdateValue={() => undefined}
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
							mutateUpdateValue={() => undefined}
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

		renderNextInfo(
			item: RundownLayoutBase,
			tab: RundownLayoutNextInfo,
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
							{t('Show segment name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.showSegmentName`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Show part title')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.showPartTitle`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide for dynamically inserted parts')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideForDynamicallyInsertedParts`}
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
							{t('Planned Start Text')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.plannedStartText`}
								obj={this.props.item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
							<span className="text-s dimmed">{t('Text to show above show start time')}</span>
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
							{t('Hide Planned Start')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hidePlannedStart`}
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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Planned End text')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.plannedEndText`}
								obj={this.props.item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
							<span className="text-s dimmed">{t('Text to show above show end time')}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Planned End Label')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hidePlannedEndLabel`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Diff Label')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideDiffLabel`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
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
						<div className="mod mvs mhs">
							<label className="field">
								{t('Hide Label')}
								<EditAttribute
									modifiedClassName="bghl"
									attribute={`filters.${index}.hideLabel`}
									obj={item}
									type="checkbox"
									collection={RundownLayouts}
									className="mod mas"
								/>
							</label>
						</div>
					</div>
					{this.renderRequiresActiveLayerSettings(
						item,
						index,
						t('Script Source Layers'),
						t('Source layers containing script')
					)}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderSegmentTiming(
			item: RundownLayoutBase,
			tab: RundownLayoutSegmentTiming,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props

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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Label')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideLabel`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{this.renderRequiresActiveLayerSettings(item, index, t('Require Piece on Source Layer'), '')}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
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
			const { t } = this.props

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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Label')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideLabel`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{this.renderRequiresActiveLayerSettings(item, index, t('Require Piece on Source Layer'), '')}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderPartTiming(
			item: RundownLayoutBase,
			tab: RundownLayoutPartTiming,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			const { t } = this.props

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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Label')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideLabel`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
						</label>
					</div>
					{this.renderRequiresActiveLayerSettings(item, index, t('Require Piece on Source Layer'), '')}
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderTextLabel(
			item: RundownLayoutBase,
			tab: RundownLayoutTextLabel,
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
							{t('Text')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.text`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
							/>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderPlaylistName(
			item: RundownLayoutBase,
			tab: RundownLayoutPlaylistName,
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
							{t('Show Rundown Name')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.showCurrentRundownName`}
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

		renderStudioName(
			item: RundownLayoutBase,
			tab: RundownLayoutStudioName,
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderSegmentName(
			item: RundownLayoutBase,
			tab: RundownLayoutSegmentName,
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
							{t('Segment')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${this.props.index}.segment`}
								obj={this.props.item}
								options={['current', 'next']}
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

		renderPartName(
			item: RundownLayoutBase,
			tab: RundownLayoutPartName,
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
							{t('Part')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${this.props.index}.part`}
								obj={this.props.item}
								options={['current', 'next']}
								type="dropdown"
								collection={RundownLayouts}
								className="input text-input input-l"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Show Piece Icon Color')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.showPieceIconColor`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
							<span className="text-s dimmed">{t('Use color of primary piece as background of panel')}</span>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderColoredBox(
			item: RundownLayoutBase,
			tab: RundownLayoutColoredBox,
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
							{t('Box color')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.iconColor`}
								obj={item}
								options={defaultColorPickerPalette}
								type="colorpicker"
								collection={RundownLayouts}
								className="input text-input input-s"
							></EditAttribute>
						</label>
					</div>
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderShowStyleDisplay(
			item: RundownLayoutBase,
			tab: RundownLayoutShowStyleDisplay,
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderSystemStatus(
			item: RundownLayoutBase,
			tab: RundownLayoutSytemStatus,
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderTimeOfDay(
			item: RundownLayoutBase,
			tab: RundownLayoutTimeOfDay,
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
							{t('Hide Label')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.hideLabel`}
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

		renderRequiresActiveLayerSettings(
			item: RundownLayoutBase,
			index: number,
			activeLayerTitle: string,
			activeLayersLabel
		) {
			const { t } = this.props
			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">{activeLayerTitle}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.requiredLayerIds`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.requiredLayerIds`}
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
						<span className="text-s dimmed">{activeLayersLabel}</span>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Also Require Source Layers')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.additionalLayers`}
							obj={item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`filters.${index}.additionalLayers`}
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
							{t('Specify additional layers where at least one layer must have an active piece')}
						</span>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Require All Additional Source Layers')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.requireAllAdditionalSourcelayers`}
								obj={item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
							<span className="text-s dimmed">{t('All additional source layers must have active pieces')}</span>
						</label>
					</div>
				</React.Fragment>
			)
		}

		renderDashboardLayoutSettings(item: RundownLayoutBase, index: number, scalable?: boolean) {
			const { t } = this.props

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
					<div className="mod mvs mhs">
						<label className="field">
							{t('Custom Classes')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`filters.${index}.customClasses`}
								obj={item}
								type="text"
								collection={RundownLayouts}
								className="input text-input input-l"
								mutateDisplayValue={(v: string[] | undefined) => v?.join(',')}
								mutateUpdateValue={(v: string | undefined) => v?.split(',')}
							/>
							<span className="text-s dimmed">
								Add custom css classes for customization. Separate classes with a &lsquo;,&rsquo;
							</span>
						</label>
					</div>
				</React.Fragment>
			)
		}

		renderKeyboardLayout(
			item: RundownLayoutBase,
			tab: RundownLayoutKeyboardPreview,
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderNextBreakTiming(
			item: RundownLayoutBase,
			tab: RundownLayoutNextBreakTiming,
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}
		renderMiniRundown(
			item: RundownLayoutBase,
			tab: RundownLayoutMiniRundown,
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
					{isDashboardLayout && this.renderDashboardLayoutSettings(item, index, true)}
				</React.Fragment>
			)
		}

		renderFilter(
			item: RundownLayoutBase,
			filter: RundownLayoutElementBase,
			index: number,
			isRundownLayout: boolean,
			isDashboardLayout: boolean
		) {
			if (RundownLayoutsAPI.isFilter(filter)) {
				return this.renderRundownLayoutFilter(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isExternalFrame(filter)) {
				return this.renderFrame(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isAdLibRegion(filter)) {
				return this.renderAdLibRegion(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPieceCountdown(filter)) {
				return this.renderPieceCountdown(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isKeyboardMap(filter)) {
				return this.renderKeyboardLayout(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isNextInfo(filter)) {
				return this.renderNextInfo(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPlaylistStartTimer(filter)) {
				return this.renderPlaylistStartTimer(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPlaylistEndTimer(filter)) {
				return this.renderPlaylistEndTimer(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isEndWords(filter)) {
				return this.renderEndWords(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isSegmentTiming(filter)) {
				return this.renderSegmentTiming(item, filter, index, isRundownLayout, isDashboardLayout)
				// return this.this.renderSegmentCountDown(item, filter, index, isRundownLayout, isDashboardLayout) // TODOSYNC: TV2 uses a different methid for this
			} else if (RundownLayoutsAPI.isPartTiming(filter)) {
				return this.renderPartTiming(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isTextLabel(filter)) {
				return this.renderTextLabel(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPlaylistName(filter)) {
				return this.renderPlaylistName(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isStudioName(filter)) {
				return this.renderStudioName(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isSegmentName(filter)) {
				return this.renderSegmentName(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isPartName(filter)) {
				return this.renderPartName(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isColoredBox(filter)) {
				return this.renderColoredBox(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isTimeOfDay(filter)) {
				return this.renderTimeOfDay(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isShowStyleDisplay(filter)) {
				return this.renderShowStyleDisplay(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isSystemStatus(filter)) {
				return this.renderSystemStatus(item, filter, index, isRundownLayout, isDashboardLayout)
			} else if (RundownLayoutsAPI.isMiniRundown(filter)) {
				return this.renderMiniRundown(item, filter, index, isRundownLayout, isDashboardLayout)
			}
		}

		render() {
			const { t } = this.props

			const isRundownLayout = RundownLayoutsAPI.isRundownLayout(this.props.item)
			const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.item)

			return (
				<div className="rundown-layout-editor-filter mod pan mas" key={this.props.filter._id}>
					<button
						className="action-btn right mod man pas"
						onClick={() => this.onRemoveElement(this.props.item, this.props.filter)}
					>
						<FontAwesomeIcon icon={faTrash} />
					</button>
					{isRundownLayout && (
						<button
							className={ClassNames('action-btn right mod man pas', {
								star: (this.props.filter as any).default,
							})}
							onClick={() =>
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
									options={this.props.supportedFilters}
									type="dropdown"
									mutateDisplayValue={(v) => (v === undefined ? this.props.supportedFilters[0] : v)}
									collection={RundownLayouts}
									className="input text-input input-l"
								></EditAttribute>
							</label>
						</div>
					</div>
					{this.renderFilter(this.props.item, this.props.filter, this.props.index, isRundownLayout, isDashboardLayout)}
				</div>
			)
		}
	}
)
