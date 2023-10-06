import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutNextBreakTiming,
	RundownLayoutBase,
	RundownLayoutNextBreakTiming,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { withTranslation } from 'react-i18next'
import { NextBreakTiming } from '../RundownView/RundownTiming/NextBreakTiming'

interface INextBreakTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutNextBreakTiming
	playlist: RundownPlaylist
}

export class NextBreakTimingPanelInner extends MeteorReactComponent<Translated<INextBreakTimingPanelProps>> {
	render(): JSX.Element {
		const { playlist, panel, layout } = this.props

		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

		return (
			<div
				className={ClassNames(
					'playlist-end-time-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutNextBreakTiming).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle({ ...(panel as DashboardLayoutNextBreakTiming) }) : {}}
			>
				<NextBreakTiming loop={playlist.loop} breakText={panel.name} />
			</div>
		)
	}
}

export const NextBreakTimingPanel = withTranslation()(NextBreakTimingPanelInner)
