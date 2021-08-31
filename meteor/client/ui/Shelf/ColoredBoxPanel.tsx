import * as React from 'react'
import * as _ from 'underscore'
import {
	DashboardLayoutColoredBox,
	RundownLayoutBase,
	RundownLayoutColoredBox,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { withTranslation } from 'react-i18next'

interface IColoredBoxPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutColoredBox
	playlist: RundownPlaylist
}

interface IState {}

interface IColoredBoxPanelTrackedProps {
	name?: string
}

export class ColoredBoxPanelInner extends MeteorReactComponent<
	Translated<IColoredBoxPanelProps & IColoredBoxPanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { panel } = this.props

		return (
			<div
				className="colored-box-panel"
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutColoredBox) }),
								fontSize: ((panel as DashboardLayoutColoredBox).scale || 1) * 1.5 + 'em',
								backgroundColor: this.props.panel.iconColor ?? 'transparent',
						  }
						: {
								backgroundColor: this.props.panel.iconColor ?? 'transparent',
						  }
				)}
			>
				<div className="wrapper"></div>
			</div>
		)
	}
}

export const ColoredBoxPanel = withTranslation()(ColoredBoxPanelInner)
