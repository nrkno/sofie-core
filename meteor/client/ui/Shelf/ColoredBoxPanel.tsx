import * as React from 'react'
import {
	DashboardLayoutColoredBox,
	RundownLayoutBase,
	RundownLayoutColoredBox,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { withTranslation } from 'react-i18next'

interface IColoredBoxPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutColoredBox
	playlist: DBRundownPlaylist
}

interface IState {}
class ColoredBoxPanelInner extends MeteorReactComponent<Translated<IColoredBoxPanelProps>, IState> {
	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)

		return (
			<div
				className="colored-box-panel"
				style={{
					backgroundColor: this.props.panel.iconColor ?? 'transparent',
					...(isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutColoredBox) : {}),
				}}
			>
				<div className="wrapper"></div>
			</div>
		)
	}
}

export const ColoredBoxPanel = withTranslation()(ColoredBoxPanelInner)
