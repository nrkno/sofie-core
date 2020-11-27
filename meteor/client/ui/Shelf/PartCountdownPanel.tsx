import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	RundownLayoutPartCountdown,
	DashboardLayoutPartCountdown,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import {
	dashboardElementPosition,
	getUnfinishedPieceInstancesReactive,
	IDashboardPanelTrackedProps,
	getUnfinishedPieceInstancesGrouped,
	getNextPieceInstancesGrouped,
} from './DashboardPanel'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { RundownTiming, TimingEvent, RundownTimingProvider } from '../RundownView/RundownTiming'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstances, PartInstance } from '../../../lib/collections/PartInstances'
import { PieceInstance } from '../../../lib/collections/PieceInstances'

interface IPartCountdownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartCountdown
	playlist: RundownPlaylist
}

interface IPartCountdownPanelTrackedProps extends IDashboardPanelTrackedProps {
	livePiece?: PieceInstance
	livePart?: PartInstance
}

interface IState {
	displayTimecode: number
}

export class PartCountdownPanelInner extends MeteorReactComponent<
	IPartCountdownPanelProps & IPartCountdownPanelTrackedProps,
	IState
> {
	constructor(props) {
		super(props)
		this.state = {
			displayTimecode: 0,
		}
		this.updateTimecode = this.updateTimecode.bind(this)
	}

	componentDidMount() {
		window.addEventListener(RundownTiming.Events.timeupdateHR, this.updateTimecode)
	}

	componentWillUnmount() {
		window.removeEventListener(RundownTiming.Events.timeupdateHR, this.updateTimecode)
	}

	updateTimecode(e: TimingEvent) {
		let timecode = 0
		if (
			this.props.livePiece &&
			this.props.livePart &&
			this.props.livePart.part.startedPlayback &&
			this.props.livePiece.partInstanceId === this.props.livePart._id
		) {
			const partDuration = this.props.livePart.part.duration || this.props.livePart.part.expectedDuration || 0
			const startedPlayback = this.props.livePart.part.getLastStartedPlayback()
			if (startedPlayback) {
				timecode = e.detail.currentTime - (startedPlayback + partDuration)
			}
		}
		this.setState({
			displayTimecode: timecode,
		})
	}

	render() {
		return (
			<div
				className="part-countdown-panel"
				style={_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout)
						? dashboardElementPosition(this.props.panel as DashboardLayoutPartCountdown)
						: {},
					{
						visibility: this.props.visible ? 'visible' : 'hidden',
					}
				)}>
				<RundownTimingProvider playlist={this.props.playlist}>
					<span
						className={ClassNames('part-countdown-panel__timecode', {
							overtime: !!(Math.floor(this.state.displayTimecode / 1000) > 0),
						})}>
						{RundownUtils.formatDiffToTimecode(
							this.state.displayTimecode || 0,
							true,
							false,
							true,
							false,
							true,
							'',
							false,
							true
						)}
					</span>
				</RundownTimingProvider>
			</div>
		)
	}
}

export const PartCountdownPanel = withTracker<IPartCountdownPanelProps, IState, IPartCountdownPanelTrackedProps>(
	(props: IPartCountdownPanelProps & IPartCountdownPanelTrackedProps) => {
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId, false)
		const { unfinishedAdLibIds, unfinishedTags, unfinishedPieceInstances } = getUnfinishedPieceInstancesGrouped(
			props.playlist.currentPartInstanceId
		)
		const { nextAdLibIds, nextTags } = getNextPieceInstancesGrouped(props.playlist.nextPartInstanceId)
		const livePiece: PieceInstance | undefined =
			props.panel.sourceLayerIds && props.panel.sourceLayerIds.length
				? _.find(_.flatten(_.values(unfinishedPieces)), (piece: PieceInstance) => {
						return (props.panel.sourceLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1
				  })
				: undefined
		const livePart = props.playlist.currentPartInstanceId
			? PartInstances.findOne(props.playlist.currentPartInstanceId)
			: undefined
		return {
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
			livePiece,
			livePart,
		}
	},
	(_data, props: IPartCountdownPanelProps, nextProps: IPartCountdownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(PartCountdownPanelInner)
