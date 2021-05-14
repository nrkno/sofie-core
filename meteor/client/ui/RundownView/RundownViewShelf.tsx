import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { SegmentUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { normalizeArray, unprotectString } from '../../../lib/lib'
import { AdlibSegmentUi } from '../Shelf/AdLibPanel'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { DashboardPieceButton } from '../Shelf/DashboardPieceButton'
import { IBlueprintActionTriggerMode, IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { Studio } from '../../../lib/collections/Studios'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { PieceDisplayStyle } from '../../../lib/collections/RundownLayouts'
import { NoticeLevel, Notification, NotificationCenter } from '../../lib/notifications/notifications'
import { memoizedIsolatedAutorun } from '../../lib/reactiveData/reactiveDataHelper'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { PieceId } from '../../../lib/collections/Pieces'
import { doUserAction, UserAction } from '../../lib/userAction'
import { MeteorCall } from '../../../lib/api/methods'
import {
	getUnfinishedPieceInstancesGrouped,
	getNextPieceInstancesGrouped,
	AdLibPieceUi,
	isAdLibOnAir,
} from '../../lib/shelf'

interface IRundownViewShelfProps {
	studio: Studio
	segment: SegmentUi
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	adLibSegmentUi: AdlibSegmentUi
}

interface IRundownViewShelfTrackedProps {
	outputLayers: {
		[key: string]: IOutputLayer
	}
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	unfinishedAdLibIds: PieceId[]
	unfinishedTags: string[]
	nextAdLibIds: PieceId[]
	nextTags: string[]
}

interface IRundownViewShelfState {}

class RundownViewShelfInner extends MeteorReactComponent<
	Translated<IRundownViewShelfProps & IRundownViewShelfTrackedProps>,
	IRundownViewShelfState
> {
	constructor(props) {
		super(props)
		this.state = {}
	}

	isAdLibOnAir(adLib: AdLibPieceUi) {
		return isAdLibOnAir(this.props.unfinishedAdLibIds, this.props.unfinishedTags, adLib)
	}

	onClearAllSourceLayers = (sourceLayers: ISourceLayer[], e: any) => {
		const { t } = this.props
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const playlistId = this.props.playlist._id
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			doUserAction(t, e, UserAction.CLEAR_SOURCELAYER, (e) =>
				MeteorCall.userAction.sourceLayerOnPartStop(
					e,
					playlistId,
					currentPartInstanceId,
					_.map(sourceLayers, (sl) => sl._id)
				)
			)
		}
	}

	onToggleSticky = (sourceLayerId: string, e: any) => {
		if (this.props.playlist && this.props.playlist.currentPartInstanceId && this.props.playlist.active) {
			const { t } = this.props
			doUserAction(t, e, UserAction.START_STICKY_PIECE, (e) =>
				MeteorCall.userAction.sourceLayerStickyPieceStart(e, this.props.playlist._id, sourceLayerId)
			)
		}
	}

	onToggleAdLib = (adlibPiece: AdLibPieceUi, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => {
		const { t } = this.props

		if (adlibPiece.invalid) {
			NotificationCenter.push(
				new Notification(
					t('Invalid AdLib'),
					NoticeLevel.WARNING,
					t('Cannot play this AdLib because it is marked as Invalid'),
					'toggleAdLib'
				)
			)
			return
		}
		if (adlibPiece.floated) {
			NotificationCenter.push(
				new Notification(
					t('Floated AdLib'),
					NoticeLevel.WARNING,
					t('Cannot play this AdLib because it is marked as Floated'),
					'toggleAdLib'
				)
			)
			return
		}

		let sourceLayer = this.props.sourceLayers[adlibPiece.sourceLayerId]

		if (queue && sourceLayer && !sourceLayer.isQueueable) {
			console.log(`Item "${adlibPiece._id}" is on sourceLayer "${adlibPiece.sourceLayerId}" that is not queueable.`)
			queue = false
		}
		if (this.props.playlist && this.props.playlist.currentPartInstanceId) {
			const currentPartInstanceId = this.props.playlist.currentPartInstanceId
			if (!this.isAdLibOnAir(adlibPiece) || !(sourceLayer && sourceLayer.clearKeyboardHotkey)) {
				if (adlibPiece.isAction && adlibPiece.adlibAction) {
					const action = adlibPiece.adlibAction
					doUserAction(t, e, adlibPiece.isGlobal ? UserAction.START_GLOBAL_ADLIB : UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.executeAction(
							e,
							this.props.playlist._id,
							action.actionId,
							action.userData,
							mode?.data
						)
					)
				} else if (!adlibPiece.isGlobal && !adlibPiece.isAction) {
					doUserAction(t, e, UserAction.START_ADLIB, (e) =>
						MeteorCall.userAction.segmentAdLibPieceStart(
							e,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isGlobal && !adlibPiece.isSticky) {
					doUserAction(t, e, UserAction.START_GLOBAL_ADLIB, (e) =>
						MeteorCall.userAction.baselineAdLibPieceStart(
							e,
							this.props.playlist._id,
							currentPartInstanceId,
							adlibPiece._id,
							queue || false
						)
					)
				} else if (adlibPiece.isSticky) {
					this.onToggleSticky(adlibPiece.sourceLayerId, e)
				}
			} else {
				if (sourceLayer && sourceLayer.clearKeyboardHotkey) {
					this.onClearAllSourceLayers([sourceLayer], e)
				}
			}
		}
	}

	render() {
		const { pieces } = this.props.adLibSegmentUi
		if (!pieces.length) return null
		return (
			<div className="rundown-view-shelf dashboard-panel">
				<div className="rundown-view-shelf__identifier">{this.props.segment.identifier}</div>
				<div className="dashboard-panel__panel">
					{pieces.map((adLibPiece) => {
						return (
							// @todo: wrap in ContextMenuTrigger
							<DashboardPieceButton
								key={unprotectString(adLibPiece._id)}
								piece={adLibPiece}
								studio={this.props.studio}
								layer={this.props.sourceLayers[adLibPiece.sourceLayerId]}
								outputLayer={this.props.outputLayers[adLibPiece.outputLayerId]}
								onToggleAdLib={this.onToggleAdLib}
								playlist={this.props.playlist}
								isOnAir={this.isAdLibOnAir(adLibPiece)}
								isNext={false} // @todo
								mediaPreviewUrl={
									this.props.studio
										? ensureHasTrailingSlash(this.props.studio.settings.mediaPreviewsUrl + '' || '') || ''
										: ''
								}
								displayStyle={PieceDisplayStyle.BUTTONS}
								canOverflowHorizontally={true}
								widthScale={3.27} // @todo: css
								isSelected={false}>
								{adLibPiece.name}
							</DashboardPieceButton>
						)
					})}
				</div>
			</div>
		)
	}
}

export const RundownViewShelf = translateWithTracker<
	IRundownViewShelfProps,
	IRundownViewShelfState,
	IRundownViewShelfTrackedProps
>(
	(props: IRundownViewShelfProps & IRundownViewShelfTrackedProps) => {
		const sourceLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.sourceLayers, '_id') // @todo: optimize
		const outputLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.outputLayers, '_id')

		const { unfinishedAdLibIds, unfinishedTags, nextAdLibIds, nextTags } = memoizedIsolatedAutorun(
			(
				currentPartInstanceId: PartInstanceId | null,
				nextPartInstanceId: PartInstanceId | null,
				showStyleBase: ShowStyleBase
			) => {
				const { unfinishedAdLibIds, unfinishedTags } = getUnfinishedPieceInstancesGrouped(currentPartInstanceId)
				const { nextAdLibIds, nextTags } = getNextPieceInstancesGrouped(showStyleBase, nextPartInstanceId)
				return {
					unfinishedAdLibIds,
					unfinishedTags,
					nextAdLibIds,
					nextTags,
				}
			},
			'unfinishedAndNextAdLibsAndTags',
			props.playlist.currentPartInstanceId,
			props.playlist.nextPartInstanceId,
			props.showStyleBase
		)

		return {
			sourceLayers: sourceLayerLookup,
			outputLayers: outputLayerLookup,
			unfinishedAdLibIds,
			unfinishedTags,
			nextAdLibIds,
			nextTags,
		}
	},
	(_data, props: IRundownViewShelfProps, nextProps: IRundownViewShelfProps) => {
		return !_.isEqual(props, nextProps)
	}
)(RundownViewShelfInner)
