import React from 'react'
import { withTranslation } from 'react-i18next'
import { RundownLayoutsAPI } from '../../../../../lib/api/rundownLayouts'
import { RundownLayoutBase, RundownLayouts } from '../../../../../lib/collections/RundownLayouts'
import { ShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { unprotectString } from '../../../../../lib/lib'
import { EditAttribute } from '../../../../lib/EditAttribute'
import { MeteorReactComponent } from '../../../../lib/MeteorReactComponent'
import { Translated } from '../../../../lib/ReactMeteorData/ReactMeteorData'

function filterLayouts(
	rundownLayouts: RundownLayoutBase[],
	testFunc: (l: RundownLayoutBase) => boolean
): Array<{ name: string; value: string }> {
	return rundownLayouts.filter(testFunc).map((l) => ({ name: l.name, value: unprotectString(l._id) }))
}

interface IProps {
	item: RundownLayoutBase
	layouts: RundownLayoutBase[]
	showStyleBase: ShowStyleBase
}

interface IState {}

export default withTranslation()(
	class RundownViewLayoutSettings extends MeteorReactComponent<Translated<IProps>, IState> {
		render() {
			const { t } = this.props

			return (
				<React.Fragment>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Expose as user selectable layout')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'exposeAsSelectableLayout'}
								obj={this.props.item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Shelf Layout')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'shelfLayout'}
								obj={this.props.item}
								options={filterLayouts(this.props.layouts, RundownLayoutsAPI.isLayoutForShelf)}
								type="dropdown"
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Mini Shelf Layout')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'miniShelfLayout'}
								obj={this.props.item}
								options={filterLayouts(this.props.layouts, RundownLayoutsAPI.isLayoutForMiniShelf)}
								type="dropdown"
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Rundown Header Layout')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'rundownHeaderLayout'}
								obj={this.props.item}
								options={filterLayouts(this.props.layouts, RundownLayoutsAPI.isLayoutForRundownHeader)}
								type="dropdown"
								collection={RundownLayouts}
								className="input text-input input-l dropdown"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Live line countdown requires sourcelayer')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`liveLineProps.activeLayerIds`}
							obj={this.props.item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`liveLineProps.activeLayerIds`}
							obj={this.props.item}
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
							{t('One of these sourcelayers must have an active piece for the live line countdown to be show')}
						</span>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Also Require Source Layers')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`liveLineProps.requiredLayers`}
							obj={this.props.item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`liveLineProps.requiredLayers`}
							obj={this.props.item}
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
							{t('Require All Sourcelayers')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={`liveLineProps.requireAllSourcelayers`}
								obj={this.props.item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							/>
							<span className="text-s dimmed">{t('All required source layers must have active pieces')}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Hide Rundown Divider')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'hideRundownDivider'}
								obj={this.props.item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
							<span className="text-s dimmed">{t('Hide rundown divider between rundowns in a playlist')}</span>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">
							{t('Show Breaks as Segments')}
							<EditAttribute
								modifiedClassName="bghl"
								attribute={'showBreaksAsSegments'}
								obj={this.props.item}
								type="checkbox"
								collection={RundownLayouts}
								className="mod mas"
							></EditAttribute>
						</label>
					</div>
					<div className="mod mvs mhs">
						<label className="field">{t('Segment countdown requires sourcelayer')}</label>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`countdownToSegmentRequireLayers`}
							obj={this.props.item}
							type="checkbox"
							collection={RundownLayouts}
							className="mod mas"
							mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? false : true)}
							mutateUpdateValue={() => undefined}
						/>
						<EditAttribute
							modifiedClassName="bghl"
							attribute={`countdownToSegmentRequireLayers`}
							obj={this.props.item}
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
							{t('One of these sourcelayers must have a piece for the countdown to segment on-air to be show')}
						</span>
					</div>
				</React.Fragment>
			)
		}
	}
)
