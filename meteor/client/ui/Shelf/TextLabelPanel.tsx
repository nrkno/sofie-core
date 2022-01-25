import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutTextLabel,
	RundownLayoutBase,
	RundownLayoutTextLabel,
} from '../../../lib/collections/RundownLayouts'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementPosition } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'

interface ITextLabelPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutTextLabel
	playlist: RundownPlaylist
}

interface IState {}

export class TextLabelPanel extends MeteorReactComponent<ITextLabelPanelProps, IState> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { panel } = this.props

		return (
			<div
				className={ClassNames(
					'text-label-panel',
					isDashboardLayout ? (panel as DashboardLayoutTextLabel).customClasses : undefined
				)}
				style={_.extend(
					isDashboardLayout
						? {
								...dashboardElementPosition({ ...(this.props.panel as DashboardLayoutTextLabel) }),
								fontSize: ((panel as DashboardLayoutTextLabel).scale || 1) * 1.5 + 'em',
						  }
						: {}
				)}
			>
				<div className="wrapper">
					<span className="text">{this.props.panel.text}</span>
				</div>
			</div>
		)
	}
}
