import * as React from 'react'
import {
	DashboardLayoutShowStyleDisplay,
	RundownLayoutBase,
	RundownLayoutShowStyleDisplay,
} from '../../../lib/collections/RundownLayouts'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { withTranslation } from 'react-i18next'

interface IShowStylePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutShowStyleDisplay
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	showStyleVariant: ShowStyleVariant
}

interface IState {}

class ShowStylePanelInner extends MeteorReactComponent<Translated<IShowStylePanelProps>, IState> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t } = this.props

		return (
			<div
				className="show-style-panel timing"
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutShowStyleDisplay) : {}}
			>
				<span className="timing-clock left">
					<span className="timing-clock-label">{t('Show Style')}</span>
					<span className="name">{this.props.showStyleBase.name}</span>
				</span>
				<span className="timing-clock left">
					<span className="timing-clock-label">{t('Show Style Variant')}</span>
					<span className="name">{this.props.showStyleVariant.name}</span>
				</span>
			</div>
		)
	}
}

export const ShowStylePanel = withTranslation()(ShowStylePanelInner)
