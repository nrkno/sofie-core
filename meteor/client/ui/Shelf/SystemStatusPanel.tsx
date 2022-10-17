import * as React from 'react'
import ClassNames from 'classnames'
import {
	DashboardLayoutSystemStatus,
	RundownLayoutBase,
	RundownLayoutSytemStatus,
} from '../../../lib/collections/RundownLayouts'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownPlaylist, RundownPlaylistCollectionUtil } from '../../../lib/collections/RundownPlaylists'
import { dashboardElementStyle } from './DashboardPanel'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { RundownSystemStatus } from '../RundownView/RundownSystemStatus'
import { DBRundown, Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { UIStudio } from '../../../lib/api/studios'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface ISystemStatusPanelProps {
	studio: UIStudio
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutSytemStatus
	playlist: RundownPlaylist
}

interface IState {}

interface ISystemStatusPanelTrackedProps {
	firstRundown: Rundown | undefined
	rundownIds: RundownId[]
}

class SystemStatusPanelInner extends MeteorReactComponent<
	Translated<ISystemStatusPanelProps & ISystemStatusPanelTrackedProps>,
	IState
> {
	constructor(props) {
		super(props)
	}

	render() {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const { t, panel } = this.props

		return (
			<div
				className={ClassNames(
					'system-status-panel timing',
					isDashboardLayout ? (panel as DashboardLayoutSystemStatus).customClasses : undefined
				)}
				style={isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutSystemStatus) : {}}
			>
				<span className="timing-clock left">
					<span className="timing-clock-label">{t('System Status')}</span>
					<RundownSystemStatus
						studio={this.props.studio}
						playlist={this.props.playlist}
						rundownIds={this.props.rundownIds}
						firstRundown={this.props.firstRundown}
					/>
				</span>
			</div>
		)
	}
}

export const SystemStatusPanel = translateWithTracker<ISystemStatusPanelProps, IState, ISystemStatusPanelTrackedProps>(
	(props: ISystemStatusPanelProps) => {
		const rundownIds = RundownPlaylistCollectionUtil.getRundownOrderedIDs(props.playlist)
		let firstRundown: DBRundown | undefined

		if (props.playlist.rundownIdsInOrder.length > 0) {
			firstRundown = Rundowns.findOne({
				playlistId: props.playlist._id,
				_id: props.playlist.rundownIdsInOrder[0],
			})
		} else if (rundownIds.length > 0) {
			firstRundown = Rundowns.findOne({
				playlistId: props.playlist._id,
				_id: rundownIds[0],
			})
		}
		return {
			rundownIds,
			firstRundown,
		}
	}
)(SystemStatusPanelInner)
