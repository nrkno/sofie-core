import * as React from 'react'
import {
	DashboardLayoutShowStyleDisplay,
	RundownLayoutBase,
	RundownLayoutShowStyleDisplay,
} from '../../../lib/collections/RundownLayouts'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { withTranslation } from 'react-i18next'
import { UIShowStyleBase } from '../../../lib/api/showStyles'

interface IShowStylePanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutShowStyleDisplay
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
}

interface IState {}

class ShowStylePanelInner extends MeteorReactComponent<Translated<IShowStylePanelProps>, IState> {
	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t } = this.props

		return (
			<div
				className="show-style-panel"
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutShowStyleDisplay) : {}}
			>
				<div className="show-style-subpanel">
					<div className="show-style-subpanel__label">{t('Show Style')}</div>
					<div className="show-style-subpanel__name" title={this.props.showStyleBase.name}>
						{this.props.showStyleBase.name}
					</div>
				</div>
				<div className="show-style-subpanel">
					<div className="show-style-subpanel__label">{t('Show Style Variant')}</div>
					<div className="show-style-subpanel__name" title={this.props.showStyleVariant.name}>
						{this.props.showStyleVariant.name}
					</div>
				</div>
			</div>
		)
	}
}

export const ShowStylePanel = withTranslation()(ShowStylePanelInner)
