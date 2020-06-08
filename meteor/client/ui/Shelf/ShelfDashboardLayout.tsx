import * as React from 'react'
import { DashboardLayout, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { TimelineDashboardPanel } from './TimelineDashboardPanel'
import { DashboardPanel } from './DashboardPanel'
import { ExternalFramePanel } from './ExternalFramePanel'
import { DashboardActionButtonGroup } from './DashboardActionButtonGroup'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { Rundown } from '../../../lib/collections/Rundowns'
import { Bucket } from '../../../lib/collections/Buckets'
import { unprotectString } from '../../../lib/lib'
import { AdLibRegionPanel } from './AdLibRegionPanel'

export interface IShelfDashboardLayoutProps {
	rundownLayout: DashboardLayout
	playlist: RundownPlaylist
	buckets: Bucket[] | undefined
	showStyleBase: ShowStyleBase
	studioMode: boolean
	shouldQueue: boolean
	onChangeQueueAdLib: (isQueue: boolean, e: any) => void
}

export function ShelfDashboardLayout(props: IShelfDashboardLayoutProps) {
	const { rundownLayout, buckets } = props
	return (
		<div className="dashboard">
			{rundownLayout.filters
				.sort((a, b) => a.rank - b.rank)
				.map((panel) =>
					RundownLayoutsAPI.isFilter(panel) ? (
						(panel as DashboardLayoutFilter).showAsTimeline ? (
							<TimelineDashboardPanel
								key={panel._id}
								includeGlobalAdLibs={true}
								filter={panel}
								visible={!(panel as DashboardLayoutFilter).hide}
								registerHotkeys={(panel as DashboardLayoutFilter).assignHotKeys}
								hotkeyGroup={panel.name.replace(/\W/, '_')}
								playlist={props.playlist}
								showStyleBase={props.showStyleBase}
								studioMode={props.studioMode}
								shouldQueue={props.shouldQueue}
								selectedPiece={undefined}
							/>
						) : (
							<DashboardPanel
								key={panel._id}
								includeGlobalAdLibs={true}
								filter={panel}
								visible={!(panel as DashboardLayoutFilter).hide}
								registerHotkeys={(panel as DashboardLayoutFilter).assignHotKeys}
								hotkeyGroup={panel.name.replace(/\W/, '_')}
								playlist={props.playlist}
								showStyleBase={props.showStyleBase}
								studioMode={props.studioMode}
								shouldQueue={props.shouldQueue}
								selectedPiece={undefined}
							/>
						)
					) : RundownLayoutsAPI.isExternalFrame(panel) ? (
						<ExternalFramePanel
							key={panel._id}
							panel={panel}
							layout={rundownLayout}
							visible={true}
							playlist={props.playlist}
						/>
					) : RundownLayoutsAPI.isAdLibRegion(panel) ? (
						<AdLibRegionPanel
							key={panel._id}
							includeGlobalAdLibs={true}
							filter={RundownLayoutsAPI.adLibRegionToFilter(panel)}
							panel={panel}
							adlibRank={panel.adlibRank}
							layout={rundownLayout}
							visible={true}
							playlist={props.playlist}
							showStyleBase={props.showStyleBase}
							studioMode={props.studioMode}
							selectedPiece={undefined}
						/>
					) : (
						undefined
					)
				)}
			{rundownLayout.actionButtons && (
				<DashboardActionButtonGroup
					playlist={props.playlist}
					buttons={rundownLayout.actionButtons}
					onChangeQueueAdLib={props.onChangeQueueAdLib}
					studioMode={props.studioMode}
				/>
			)}
		</div>
	)
}
