import * as React from 'react'
import * as _ from 'underscore'
import { Timeline } from '../../../lib/collections/Timeline'
import { SourceLayerItem } from './SourceLayerItem'
import { getCurrentTime, unprotectObject } from '../../../lib/lib'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { SourceLayerType, VTContent, LiveSpeakContent, getPieceGroupId } from 'tv-automation-sofie-blueprints-integration'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
// @ts-ignore Meteor package not recognized by Typescript
import { ComputedField } from 'meteor/peerlibrary:computed-field'
import { Meteor } from 'meteor/meteor'
import { checkPieceContentStatus } from '../../../lib/mediaObjects'
import {
	ISourceLayerUi,
	IOutputLayerUi,
	SegmentUi,
	PartUi,
	PieceUi
} from './SegmentTimelineContainer'
import { Tracker } from 'meteor/tracker'
import { PubSub } from '../../../lib/api/pubsub'

interface IPropsHeader {
	layer: ISourceLayerUi
	outputLayer: IOutputLayerUi
	mediaPreviewUrl: string
	// segment: SegmentUi
	part: PartUi
	partStartsAt: number
	partDuration: number
	piece: PieceUi
	playlist: RundownPlaylist
	timeScale: number
	isLiveLine: boolean
	isNextLine: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	relative?: boolean
	outputGroupCollapsed: boolean
	followLiveLine: boolean
	autoNextPart: boolean
	liveLineHistorySize: number
	livePosition: number | null
	liveLinePadding: number
	scrollLeft: number
	scrollWidth: number
}
/** This is a container component that allows ractivity with the Timeline collection */
export const SourceLayerItemContainer = class extends MeteorReactComponent<IPropsHeader> {
	private mediaObjectSub: Meteor.SubscriptionHandle
	private statusComp: Tracker.Computation
	private objId: string
	private overrides: Partial<IPropsHeader>
	private destroyed: boolean

	updateMediaObjectSubscription () {
		if (this.destroyed) return

		if (this.props.piece && this.props.piece.sourceLayer) {
			const piece = this.props.piece
			let objId: string | undefined = undefined

			switch (this.props.piece.sourceLayer.type) {
				case SourceLayerType.VT:
					objId = (piece.instance.piece.content as VTContent).fileName.toUpperCase()
					break
				case SourceLayerType.LIVE_SPEAK:
					objId = (piece.instance.piece.content as LiveSpeakContent).fileName.toUpperCase()
					break
			}

			if (objId && objId !== this.objId) {
				// if (this.mediaObjectSub) this.mediaObjectSub.stop()
				this.objId = objId
				this.subscribe(PubSub.mediaObjects, this.props.playlist.studioId, {
					mediaId: this.objId
				})
			}
		} else {
			console.error('One of the Piece\'s is invalid:', this.props.piece)
		}
	}

	shouldDataTrackerUpdate (prevProps: IPropsHeader): boolean {
		if (this.props.piece !== prevProps.piece) return true
		if (this.props.isLiveLine !== prevProps.isLiveLine) return true
		return false
	}

	updateDataTracker () {
		if (this.destroyed) return

		this.statusComp = this.autorun(() => {
			const props = this.props
			this.overrides = {}
			const overrides = this.overrides

			// console.log(`${this.props.piece._id}: running data tracker`)

			if (props.isLiveLine) {
				// Check in Timeline collection for any changes to the related object
				// TODO - this query appears to be unable to load any data
				let timelineObj = Timeline.findOne({ id: getPieceGroupId(unprotectObject(props.piece.instance.piece)) })

				if (timelineObj) {
					// Deep clone the required bits
					const origPiece = (overrides.piece || props.piece) as PieceUi
					const pieceCopy = {
						...(overrides.piece || props.piece),
						instance: {
							...origPiece.instance,
							piece: {
								...origPiece.instance.piece,
								enable: timelineObj.enable
							}
						}
					}

					if (_.isNumber(timelineObj.enable.start)) { // this is a normal absolute trigger value
						pieceCopy.renderedInPoint = timelineObj.enable.start
					} else if (timelineObj.enable.start === 'now') { // this is a special absolute trigger value
						if (props.part && props.part.instance.part.startedPlayback && props.part.instance.part.getLastStartedPlayback()) {
							pieceCopy.renderedInPoint = getCurrentTime() - (props.part.instance.part.getLastStartedPlayback() || 0)
						} else {
							pieceCopy.renderedInPoint = 0
						}
					} else {
						pieceCopy.renderedInPoint = 0
					}

					if (typeof timelineObj.enable.duration === 'number' && !pieceCopy.cropped) {
						pieceCopy.renderedDuration = (
							timelineObj.enable.duration !== 0 ?
							timelineObj.enable.duration :
							(props.partDuration - (pieceCopy.renderedInPoint || 0))
						) || null
					}
					// console.log(segmentCopy.renderedDuration)

					overrides.piece = _.extend(overrides.piece || {}, pieceCopy)
				}
			}

			// Check item status
			if (props.piece.sourceLayer) {

				const { metadata, status } = checkPieceContentStatus(props.piece.instance.piece, props.piece.sourceLayer, props.playlist.getStudio().settings)
				if (status !== props.piece.instance.piece.status || metadata) {
					// Deep clone the required bits
					const origPiece = (overrides.piece || props.piece) as PieceUi
					const pieceCopy: PieceUi = {
						...(overrides.piece || props.piece),
						instance: {
							...origPiece.instance,
							piece: {
								...origPiece.instance.piece,
								status: status
							}
						},
						contentMetaData: metadata
					}

					overrides.piece = _.extend(overrides.piece || {}, pieceCopy)
				}
			} else {
				console.error(`Piece "${props.piece.instance.piece._id}" has no sourceLayer:`, props.piece)
			}

			this.forceUpdate()
		})
	}

	componentDidMount () {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
			this.updateDataTracker()
		})
	}

	componentDidUpdate (prevProps: IPropsHeader) {
		Meteor.defer(() => {
			this.updateMediaObjectSubscription()
		})
		if (this.shouldDataTrackerUpdate(prevProps)) {
			// console.log('Invalidating computation!', this.statusComp.stopped, this.statusComp.invalidated)
			if (this.statusComp) this.statusComp.invalidate()
		}
	}

	componentWillUnmount () {
		this.destroyed = true
		super.componentWillUnmount()
	}

	render () {
		return (
			<SourceLayerItem {...this.props} {...this.overrides} />
		)
	}
}
