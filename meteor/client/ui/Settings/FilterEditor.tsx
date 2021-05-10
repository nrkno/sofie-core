import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import React from 'react'
import { withTranslation } from 'react-i18next'
import {
	RundownLayoutBase,
	RundownLayoutFilterBase,
	PieceDisplayStyle,
	RundownLayouts,
} from '../../../lib/collections/RundownLayouts'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { EditAttribute } from '../../lib/EditAttribute'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'

interface IFilterEditorProps {
	showStyleBase: ShowStyleBase
	item: RundownLayoutBase
	tab: RundownLayoutFilterBase
	index: number
	isRundownLayout: boolean
	isDashboardLayout: boolean
}

export const FilterEditor = withTranslation()(
	class FilterEditor extends React.Component<Translated<IFilterEditorProps>, {}> {
		constructor(props: Translated<IFilterEditorProps>) {
			super(props)
		}

		render() {
			const { t, item, tab, index, isDashboardLayout, isRundownLayout, showStyleBase } = this.props
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
							options={showStyleBase.sourceLayers.map((l) => {
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
							options={showStyleBase.outputLayers.map((l) => {
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
									{t('Hide duplicated AdLibs')}
									<EditAttribute
										modifiedClassName="bghl"
										attribute={`filters.${index}.hideDuplicates`}
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
							</div>
						</React.Fragment>
					)}
				</React.Fragment>
			)
		}
	}
)
