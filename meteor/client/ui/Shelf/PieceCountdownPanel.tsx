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
import { PieceInstance } from '../../../lib/collections/PieceInstances'
import { VTContent } from 'tv-automation-sofie-blueprints-integration'
import { MediaObject, MediaObjects } from '../../../lib/collections/MediaObjects'
import { Meteor } from 'meteor/meteor'
import { PubSub } from '../../../lib/api/pubsub'

interface IPieceCountdownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPartCountdown
	playlist: RundownPlaylist
}

interface IPieceCountdownPanelTrackedProps {
	livePieceInstance?: PieceInstance
	metadata?: MediaObject
}

interface IState {
	displayTimecode: number
}

export class PieceCountdownPanelInner extends MeteorReactComponent<
	IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps,
	IState
> {
	private objId: string

	constructor(props) {
		super(props)
		this.state = {
			displayTimecode: 0,
		}
		this.updateTimecode = this.updateTimecode.bind(this)
	}

	componentDidMount() {
		window.addEventListener(RundownTiming.Events.timeupdate, this.updateTimecode)
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	componentWillUnmount() {
		window.removeEventListener(RundownTiming.Events.timeupdate, this.updateTimecode)
	}

	updateTimecode(e: TimingEvent) {
		let timecode = 0
		if (this.props.livePieceInstance && this.props.livePieceInstance.startedPlayback) {
			const vtContent = this.props.livePieceInstance.piece.content as VTContent | undefined
			const sourceDuration =
				Math.max(
					(this.props.metadata?.mediainfo?.format?.duration || 0) * 1000 - (vtContent?.postrollDuration || 0),
					0
				) ||
				vtContent?.sourceDuration ||
				0
			const startedPlayback = this.props.livePieceInstance.startedPlayback
			if (startedPlayback && sourceDuration > 0) {
				timecode = e.detail.currentTime - (startedPlayback + sourceDuration)
			}
		}
		if (this.state.displayTimecode != timecode) {
			this.setState({
				displayTimecode: timecode,
			})
		}
	}

	componentDidUpdate() {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
	}

	updateMediaObjectSubscription() {
		if (this.props.livePieceInstance) {
			const piece = this.props.livePieceInstance.piece
			let objId: string | undefined = undefined

			if (piece.content && piece.content.fileName) {
				objId = (piece.content as VTContent | undefined)?.fileName?.toUpperCase()
			}

			if (objId && objId !== this.objId) {
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.playlist.studioId, {
					mediaId: this.objId,
				})
			}
		}
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
			</div>
		)
	}
}

export const PieceCountdownPanel = withTracker<IPieceCountdownPanelProps, IState, IPieceCountdownPanelTrackedProps>(
	(props: IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps) => {
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(props.playlist.currentPartInstanceId, false)
		const { unfinishedAdLibIds, unfinishedTags, unfinishedPieceInstances } = getUnfinishedPieceInstancesGrouped(
			props.playlist.currentPartInstanceId
		)
		const livePieceInstance: PieceInstance | undefined =
			props.panel.sourceLayerIds && props.panel.sourceLayerIds.length
				? _.find(_.flatten(_.values(unfinishedPieces)), (piece: PieceInstance) => {
						return (
							(props.panel.sourceLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
							piece.partInstanceId === props.playlist.currentPartInstanceId
						)
				  })
				: undefined
		const mediaId = (livePieceInstance?.piece.content as VTContent | undefined)?.fileName?.toUpperCase()
		const metadata = mediaId ? MediaObjects.findOne({ mediaId }) : undefined
		return {
			livePieceInstance,
			metadata,
		}
	},
	(_data, props: IPieceCountdownPanelProps, nextProps: IPieceCountdownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(PieceCountdownPanelInner)
