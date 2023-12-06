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
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { withTranslation } from 'react-i18next'
import { NextBreakTiming } from '../RundownView/RundownTiming/NextBreakTiming'

interface INextBreakTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutNextBreakTiming
	playlist: DBRundownPlaylist
}

export class NextBreakTimingPanelInner extends React.Component<Translated<INextBreakTimingPanelProps>> {
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
