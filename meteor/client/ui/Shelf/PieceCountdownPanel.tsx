import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	RundownLayoutPieceCountdown,
	DashboardLayoutPartCountdown,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition, getUnfinishedPieceInstancesReactive } from './DashboardPanel'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { RundownTiming, TimingEvent } from '../RundownView/RundownTiming/RundownTiming'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { VTContent } from '@sofie-automation/blueprints-integration'
interface IPieceCountdownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPieceCountdown
	playlist: RundownPlaylist
}

interface IPieceCountdownPanelTrackedProps {
	livePieceInstance?: PieceInstance
}

interface IState {
	displayTimecode: number
}

export class PieceCountdownPanelInner extends MeteorReactComponent<
	IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps,
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
		window.addEventListener(RundownTiming.Events.timeupdate, this.updateTimecode)
	}

	componentWillUnmount() {
		window.removeEventListener(RundownTiming.Events.timeupdate, this.updateTimecode)
	}

	updateTimecode(e: TimingEvent) {
		let timecode = 0
		if (this.props.livePieceInstance && this.props.livePieceInstance.startedPlayback) {
			const vtContent = this.props.livePieceInstance.piece.content as VTContent | undefined
			const sourceDuration = vtContent?.sourceDuration || 0
			const seek = vtContent?.seek || 0
			const startedPlayback = this.props.livePieceInstance.startedPlayback
			if (startedPlayback && sourceDuration > 0) {
				timecode = e.detail.currentTime - (startedPlayback + sourceDuration - seek)
			}
		}
		if (this.state.displayTimecode != timecode) {
			this.setState({
				displayTimecode: timecode,
			})
		}
	}

	render() {
		return (
			<div
				className="piece-countdown-panel"
				style={_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout)
						? dashboardElementPosition(this.props.panel as DashboardLayoutPartCountdown)
						: {},
					{
						visibility: this.props.visible ? 'visible' : 'hidden',
					}
				)}>
				<span
					className={ClassNames('piece-countdown-panel__timecode', {
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
			</div>
		)
	}
}

export const PieceCountdownPanel = withTracker<IPieceCountdownPanelProps, IState, IPieceCountdownPanelTrackedProps>(
	(props: IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps) => {
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId)
		const livePieceInstance: PieceInstance | undefined =
			props.panel.sourceLayerIds && props.panel.sourceLayerIds.length
				? _.flatten(Object.values(unfinishedPieces)).find((piece: PieceInstance) => {
						return (
							(props.panel.sourceLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
							piece.partInstanceId === props.playlist.currentPartInstanceId
						)
				  })
				: undefined
		return { livePieceInstance }
	},
	(_data, props: IPieceCountdownPanelProps, nextProps: IPieceCountdownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(PieceCountdownPanelInner)
