import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	RundownLayoutPieceCountdown,
	DashboardLayoutPieceCountdown,
} from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementStyle } from './DashboardPanel'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { RundownTiming, TimingEvent } from '../RundownView/RundownTiming/RundownTiming'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { getUnfinishedPieceInstancesReactive } from '../../lib/rundownLayouts'
import { DBShowStyleBase } from '../../../lib/collections/ShowStyleBases'
interface IPieceCountdownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPieceCountdown
	playlist: RundownPlaylist
	showStyleBase: DBShowStyleBase
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
		window.addEventListener(RundownTiming.Events.timeupdateLowResolution, this.updateTimecode)
	}

	componentWillUnmount() {
		window.removeEventListener(RundownTiming.Events.timeupdateLowResolution, this.updateTimecode)
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
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		return (
			<div
				className="piece-countdown-panel"
				style={{
					visibility: this.props.visible ? 'visible' : 'hidden',
					...(isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutPieceCountdown) : {}),
				}}
			>
				<span
					className={ClassNames('piece-countdown-panel__timecode', 'dashboard__panel--font-scaled', {
						overtime: Math.floor(this.state.displayTimecode / 1000) > 0,
					})}
				>
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
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(props.playlist, props.showStyleBase)
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
