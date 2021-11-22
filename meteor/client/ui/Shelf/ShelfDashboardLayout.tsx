import * as React from 'react'
import { DashboardLayout, DashboardLayoutFilter } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { TimelineDashboardPanel } from './TimelineDashboardPanel'
import { DashboardPanel } from './DashboardPanel'
import { ExternalFramePanel } from './ExternalFramePanel'
import { DashboardActionButtonGroup } from './DashboardActionButtonGroup'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { AdLibRegionPanel } from './AdLibRegionPanel'
import { KeyboardPreviewPanel } from './KeyboardPreviewPanel'
import { Studio } from '../../../lib/collections/Studios'
import { PieceCountdownPanel } from './PieceCountdownPanel'
import { NextInfoPanel } from './NextInfoPanel'
import { BucketAdLibItem } from './RundownViewBuckets'
import { IAdLibListItem } from './AdLibListItem'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { PlaylistStartTimerPanel } from './PlaylistStartTimerPanel'
import { EndWordsPanel } from './EndWordsPanel'
import { PlaylistEndTimerPanel } from './PlaylistEndTimerPanel'
import { SegmentTimingPanel } from './SegmentTimingPanel'
import { PartTimingPanel } from './PartTimingPanel'
import { TextLabelPanel } from './TextLabelPanel'
import { PlaylistNamePanel } from './PlaylistNamePanel'
import { TimeOfDayPanel } from './TimeOfDayPanel'
import { SystemStatusPanel } from './SystemStatusPanel'
import { ShowStylePanel } from './ShowStylePanel'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { StudioNamePanel } from './StudioNamePanel'
import { SegmentNamePanel } from './SegmentNamePanel'
import { PartNamePanel } from './PartNamePanel'
import { ColoredBoxPanel } from './ColoredBoxPanel'
import { AdLibPieceUi } from '../../lib/shelf'

export interface IShelfDashboardLayoutProps {
	rundownLayout: DashboardLayout
	playlist: RundownPlaylist
	// buckets: Bucket[] | undefined
	showStyleBase: ShowStyleBase
	showStyleVariant: ShowStyleVariant
	studioMode: boolean
	shouldQueue: boolean
	studio: Studio
	onChangeQueueAdLib?: (isQueue: boolean, e: any) => void

	selectedPiece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

export function ShelfDashboardLayout(props: IShelfDashboardLayoutProps) {
	const { rundownLayout } = props
	return (
		<div className="dashboard">
			{rundownLayout.filters &&
				rundownLayout.filters
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
									studio={props.studio}
									selectedPiece={props.selectedPiece}
									onSelectPiece={props.onSelectPiece}
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
									studio={props.studio}
									selectedPiece={props.selectedPiece}
									onSelectPiece={props.onSelectPiece}
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
								selectedPiece={props.selectedPiece}
								onSelectPiece={props.onSelectPiece}
								studio={props.studio}
								hotkeyGroup={panel.name.replace(/\W/, '_')}
							/>
						) : RundownLayoutsAPI.isPieceCountdown(panel) ? (
							<PieceCountdownPanel
								key={panel._id}
								panel={panel}
								layout={rundownLayout}
								playlist={props.playlist}
								showStyleBase={props.showStyleBase}
								visible={true}
							/>
						) : RundownLayoutsAPI.isPlaylistStartTimer(panel) ? (
							<PlaylistStartTimerPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : RundownLayoutsAPI.isPlaylistEndTimer(panel) ? (
							<PlaylistEndTimerPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : RundownLayoutsAPI.isEndWords(panel) ? (
							<EndWordsPanel
								key={panel._id}
								playlist={props.playlist}
								showStyleBase={props.showStyleBase}
								layout={rundownLayout}
								panel={panel}
							/>
						) : RundownLayoutsAPI.isSegmentTiming(panel) ? (
							<SegmentTimingPanel
								key={panel._id}
								playlist={props.playlist}
								layout={rundownLayout}
								panel={panel}
								showStyleBase={props.showStyleBase}
							/>
						) : RundownLayoutsAPI.isPartTiming(panel) ? (
							<PartTimingPanel
								key={panel._id}
								playlist={props.playlist}
								showStyleBase={props.showStyleBase}
								layout={rundownLayout}
								panel={panel}
							/>
						) : RundownLayoutsAPI.isTextLabel(panel) ? (
							<TextLabelPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : RundownLayoutsAPI.isPlaylistName(panel) ? (
							<PlaylistNamePanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : RundownLayoutsAPI.isStudioName(panel) ? (
							<StudioNamePanel
								key={panel._id}
								studio={props.studio}
								playlist={props.playlist}
								layout={rundownLayout}
								panel={panel}
							/>
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
								selectedPiece={props.selectedPiece}
								onSelectPiece={props.onSelectPiece}
								studio={props.studio}
								hotkeyGroup={panel.name.replace(/\W/, '_')}
							/>
						) : RundownLayoutsAPI.isKeyboardMap(panel) ? (
							<KeyboardPreviewPanel
								key={panel._id}
								visible={true}
								showStyleBase={props.showStyleBase}
								layout={rundownLayout}
								panel={panel}
							/>
						) : RundownLayoutsAPI.isNextInfo(panel) ? (
							<NextInfoPanel
								key={panel._id}
								panel={panel}
								layout={rundownLayout}
								playlist={props.playlist}
								visible={true}
							/>
						) : RundownLayoutsAPI.isSegmentName(panel) ? (
							<SegmentNamePanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : RundownLayoutsAPI.isPartName(panel) ? (
							<PartNamePanel
								key={panel._id}
								playlist={props.playlist}
								layout={rundownLayout}
								panel={panel}
								showStyleBase={props.showStyleBase}
							/>
						) : RundownLayoutsAPI.isTimeOfDay(panel) ? (
							<TimeOfDayPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : RundownLayoutsAPI.isSystemStatus(panel) ? (
							<SystemStatusPanel
								key={panel._id}
								playlist={props.playlist}
								layout={rundownLayout}
								panel={panel}
								studio={props.studio}
							/>
						) : RundownLayoutsAPI.isShowStyleDisplay(panel) ? (
							<ShowStylePanel
								key={panel._id}
								playlist={props.playlist}
								layout={rundownLayout}
								panel={panel}
								showStyleBase={props.showStyleBase}
								showStyleVariant={props.showStyleVariant}
							/>
						) : RundownLayoutsAPI.isColoredBox(panel) ? (
							<ColoredBoxPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						) : null
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
